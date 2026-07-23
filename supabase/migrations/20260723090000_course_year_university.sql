-- Migration 20260723090000_course_year_university.sql
--
-- Adds course, year_level and university to approved_students and profiles, and
-- teaches admin_list_students / handle_new_user about them.
--
-- Why this exists instead of 20260723000002_add_course_year_university:
--
-- That migration was written but never applied to the linked project, so the
-- admin "Add Student" form failed with `Could not find the 'course' column of
-- 'approved_students' in the schema cache`. It cannot simply be pushed now: its
-- timestamp sorts BEFORE 20260723062543_verify_at_university_email, which IS
-- applied, and both redefine handle_new_user. Replaying it out of order would
-- reinstate the older function body and silently revert 0625's fix that made
-- the "already registered" check unconditional -- the guard that stops a roster
-- row claimed under the personal-email era from being claimed a second time.
--
-- So the column work is re-stated here on top of the live schema, and the
-- function below is 0625's body plus the roster columns. 20260723000001 and
-- 20260723000002 are superseded by this file and are marked applied in the
-- history table rather than run.

-- 1. Columns on the roster.
alter table public.approved_students
  add column if not exists course text,
  add column if not exists year_level text,
  add column if not exists university text default 'Cebu Institute of Technology – University';

-- 2. Same three on the profile the student ends up with.
alter table public.profiles
  add column if not exists course text,
  add column if not exists year_level text,
  add column if not exists university text default 'Cebu Institute of Technology – University';

-- 3. Admin student list carries course and year level (src/admin/adminQueries.ts
--    reads r.course / r.year_level off this RPC).
--
--    Dropped first, not replaced: adding OUT columns changes the function's
--    return row type, which `create or replace` rejects with 42P13. The drop
--    takes the existing grants with it, so they are restated below.
drop function if exists public.admin_list_students();

create function public.admin_list_students()
returns table (
  email               text,
  full_name           text,
  first_name          text,
  last_name           text,
  student_number      text,
  is_registered       boolean,
  profile_id          uuid,
  is_active           boolean,
  deactivation_reason text,
  deactivated_at      timestamptz,
  application_count   bigint,
  joined              timestamptz,
  course              text,
  year_level          text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.email,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(concat_ws(' ', a.first_name, a.middle_initial, a.last_name)), ''),
      a.email
    )                                                    as full_name,
    a.first_name,
    a.last_name,
    a.student_number,
    a.is_registered,
    p.id                                                 as profile_id,
    coalesce(p.is_active, true)                          as is_active,
    p.deactivation_reason,
    p.deactivated_at,
    coalesce(ac.cnt, 0)                                  as application_count,
    coalesce(p.created_at, a.created_at)                 as joined,
    a.course,
    a.year_level
  from public.approved_students a
  left join public.profiles p
    on lower(p.email) = lower(a.email) and p.role = 'student'
  left join (
    select student_id, count(*) as cnt
    from public.applications
    group by student_id
  ) ac on ac.student_id = p.id
  where public.is_admin()          -- returns nothing to non-admins
  order by a.created_at desc;
$$;

-- Restore the grants the drop removed (see 20260718090000_admin_panel_data).
revoke execute on function public.admin_list_students() from public, anon;
grant  execute on function public.admin_list_students() to authenticated;

-- 4. Signup trigger: 20260723062543's body, plus the roster's name/course/year/
--    university copied onto the new profile. The unconditional single-use check
--    from 0625 is preserved exactly.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- The address the account authenticates with. Same as the lookup address for
  -- new signups; still the personal address for 0013-era accounts.
  v_auth       text := lower(new.email);
  -- Present only on accounts created during the personal-email era.
  v_univ       text := lower(nullif(coalesce(new.raw_user_meta_data ->> 'university_email', ''), ''));
  -- What the allowlists are keyed on -- always the institutional address.
  v_lookup     text := coalesce(v_univ, lower(new.email));
  v_role       public.user_role;
  v_claimed    boolean;
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
  v_roster_first  text;
  v_roster_mi     text;
  v_roster_last   text;
  v_roster_course text;
  v_roster_year   text;
  v_roster_univ   text;
begin
  v_role := public.resolve_signup_role(v_lookup);

  if v_role is null then
    raise exception
      'Email % is not permitted to register. Students must be pre-registered by the NLO, and companies must be NLO-approved, before creating an account.',
      v_lookup
      using errcode = 'check_violation';
  end if;

  -- Single-use enforcement, unconditional -- see 20260723062543's header note.
  if v_role = 'student' then
    select is_registered into v_claimed
    from public.approved_students where lower(email) = v_lookup;
  else
    select is_registered into v_claimed
    from public.nlo_approved_companies where lower(contact_email) = v_lookup;
  end if;

  if coalesce(v_claimed, false) then
    raise exception
      'Email % has already been registered. If this is your account, log in instead or reset your password.',
      v_lookup
      using errcode = 'check_violation';
  end if;

  if v_role = 'student' then
    -- Claim the roster row and take what the NLO recorded on it in one pass.
    update public.approved_students
      set is_registered = true
      where lower(email) = v_lookup
      returning first_name, middle_initial, last_name, course, year_level, university
      into v_roster_first, v_roster_mi, v_roster_last, v_roster_course, v_roster_year, v_roster_univ;

    -- Signup no longer asks for the name; fall back to the roster when the form
    -- did not supply one. Anything the form did send still wins.
    v_first := coalesce(nullif(v_first, ''), coalesce(v_roster_first, ''));
    v_mi    := coalesce(nullif(v_mi, ''), coalesce(v_roster_mi, ''));
    v_last  := coalesce(nullif(v_last, ''), coalesce(v_roster_last, ''));
  elsif v_role = 'company' then
    update public.nlo_approved_companies
      set is_registered = true
      where lower(contact_email) = v_lookup;
  end if;

  v_full := nullif(trim(
    concat_ws(' ', nullif(v_first, ''), nullif(v_mi, ''), nullif(v_last, ''))
  ), '');
  if v_full is null then
    v_full := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  end if;

  insert into public.profiles (
    id, email, role, full_name, first_name, middle_initial, last_name,
    suffix, age, gender, address, personal_email, contact_number,
    course, year_level, university
  )
  values (
    new.id,
    -- Institutional address stays the profile identity. For new signups it now
    -- equals auth.users.email.
    v_lookup,
    v_role, v_full,
    nullif(v_first, ''), nullif(v_mi, ''), nullif(v_last, ''),
    v_suffix, v_age, v_gender, v_address,
    -- Whatever the signup form supplied; the 0013 fallback of recording the
    -- delivery address only applies to accounts that still carry the split.
    coalesce(v_pemail, case when v_univ is not null then v_auth end),
    v_contact,
    -- Null for companies, which have no roster row.
    v_roster_course, v_roster_year,
    case when v_role = 'student'
      then coalesce(v_roster_univ, 'Cebu Institute of Technology – University')
    end
  )
  on conflict (id) do nothing;

  if v_role = 'company' then
    insert into public.companies (owner_id, name)
    select new.id, c.company_name
    from public.nlo_approved_companies c
    where lower(c.contact_email) = v_lookup
    limit 1
    on conflict (owner_id) do nothing;
  end if;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates the profile for a new auth user. Signup verifies at the institutional address, so auth.users.email is the roster address; raw_user_meta_data.university_email is still honoured for accounts created during the personal-email era (migration 0013). Name, course, year level and university are copied from the approved_students roster row when the signup form did not supply them.';
