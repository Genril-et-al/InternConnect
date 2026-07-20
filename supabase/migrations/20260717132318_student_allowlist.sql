-- InternConnect — Student allowlist (UC-A03 extension)
-- Gate student self-registration on an NLO-managed roster, mirroring how
-- nlo_approved_companies gates company registration. A @cit.edu email can no
-- longer register unless the NLO has pre-loaded it into approved_students.
-- Run in the Supabase SQL editor after 0005_security_hardening.sql.

-- ---------------------------------------------------------------------------
-- approved_students: NLO roster of students cleared to self-register.
-- ---------------------------------------------------------------------------
create table if not exists public.approved_students (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  student_number  text unique,            -- school ID, optional
  first_name      text,
  middle_initial  text,
  last_name       text,
  added_by        uuid references auth.users (id) on delete set null,
  is_registered   boolean not null default false,
  created_at      timestamptz not null default now()
);

comment on table public.approved_students is
  'NLO roster: students cleared to self-register (gates UC-S01 signup).';

alter table public.approved_students enable row level security;

drop policy if exists "approved_students_admin_all" on public.approved_students;
create policy "approved_students_admin_all" on public.approved_students
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- resolve_signup_role: single source of truth for who may register and as
-- what. Pure lookup (no side effects) so it can be unit-tested directly.
-- SECURITY DEFINER to read the allowlists past RLS; internal-only, so EXECUTE
-- is revoked from client roles below.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_signup_role(p_email text)
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.approved_students
      where lower(email) = lower(p_email)
    ) then 'student'::public.user_role
    when exists (
      select 1 from public.nlo_approved_companies
      where lower(contact_email) = lower(p_email)
    ) then 'company'::public.user_role
    else null
  end;
$$;

revoke execute on function public.resolve_signup_role(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- handle_new_user v5: resolve role from the allowlists (roster or NLO). No
-- more blanket @cit.edu acceptance. Marks the matching allowlist row
-- registered and auto-creates the companies row for company signups.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email      text := lower(new.email);
  v_role       public.user_role;
  v_first      text := coalesce(new.raw_user_meta_data ->> 'first_name', '');
  v_mi         text := coalesce(new.raw_user_meta_data ->> 'middle_initial', '');
  v_last       text := coalesce(new.raw_user_meta_data ->> 'last_name', '');
  v_suffix     text := nullif(coalesce(new.raw_user_meta_data ->> 'suffix', ''), '');
  v_age        integer := nullif(coalesce(new.raw_user_meta_data ->> 'age', ''), '')::integer;
  v_gender     text := nullif(coalesce(new.raw_user_meta_data ->> 'gender', ''), '');
  v_address    text := nullif(coalesce(new.raw_user_meta_data ->> 'address', ''), '');
  v_pemail     text := nullif(coalesce(new.raw_user_meta_data ->> 'personal_email', ''), '');
  v_contact    text := nullif(coalesce(new.raw_user_meta_data ->> 'contact_number', ''), '');
  v_full       text;
begin
  v_role := public.resolve_signup_role(v_email);

  if v_role is null then
    raise exception
      'Email % is not permitted to register. Students must be pre-registered by the NLO, and companies must be NLO-approved, before creating an account.',
      new.email
      using errcode = 'check_violation';
  end if;

  if v_role = 'student' then
    update public.approved_students
      set is_registered = true
      where lower(email) = v_email;
  elsif v_role = 'company' then
    update public.nlo_approved_companies
      set is_registered = true
      where lower(contact_email) = v_email;
  end if;

  -- Prefer structured name parts; fall back to a single full_name if provided.
  v_full := nullif(trim(
    concat_ws(' ', nullif(v_first, ''), nullif(v_mi, ''), nullif(v_last, ''))
  ), '');
  if v_full is null then
    v_full := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  end if;

  insert into public.profiles (
    id, email, role, full_name, first_name, middle_initial, last_name,
    suffix, age, gender, address, personal_email, contact_number
  )
  values (
    new.id, v_email, v_role, v_full,
    nullif(v_first, ''), nullif(v_mi, ''), nullif(v_last, ''),
    v_suffix, v_age, v_gender, v_address, v_pemail, v_contact
  )
  on conflict (id) do nothing;

  if v_role = 'company' then
    insert into public.companies (owner_id, name)
    select new.id, c.company_name
    from public.nlo_approved_companies c
    where lower(c.contact_email) = v_email
    limit 1
    on conflict (owner_id) do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed the roster. Existing students (already have accounts) are marked
-- registered; Gabriel still needs to sign up.
-- ---------------------------------------------------------------------------
insert into public.approved_students (email, first_name, middle_initial, last_name, is_registered) values
  ('lukemiguel.dongque@cit.edu',  'Luke Miguel', 'M', 'Dongque',   true),
  ('zedric.camilotes@cit.edu',    'Zedric',      'A', 'Camilotes',  true),
  ('adrianseth.tabotabo@cit.edu', 'Adrian Seth', 'M', 'Tabotabo',   true),
  ('gabriel.castaneda@cit.edu',   'Gabriel',     null, 'Castaneda', false)
on conflict (email) do nothing;
