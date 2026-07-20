-- InternConnect — Student profile personal details (name suffix + contact info)
-- Adds suffix, age, gender, address, personal email, and contact number to
-- profiles, and captures them from signup metadata (like first/middle/last
-- name already are). Run in the Supabase SQL editor after 0002_profile_fields.sql.

-- ---------------------------------------------------------------------------
-- New profile columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists suffix          text,
  add column if not exists age             integer,
  add column if not exists gender          text,
  add column if not exists address         text,
  add column if not exists personal_email  text,
  add column if not exists contact_number  text;

alter table public.profiles
  drop constraint if exists profiles_age_check;
alter table public.profiles
  add constraint profiles_age_check check (age is null or (age >= 0 and age <= 150));

-- ---------------------------------------------------------------------------
-- Extend handle_new_user to also populate the new personal-detail columns
-- from signup metadata (mirrors how first/middle/last name are captured).
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
  v_is_nlo     boolean;
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
  if v_email like '%@cit.edu' then
    v_role := 'student';
  else
    select true into v_is_nlo
    from public.nlo_approved_companies
    where lower(contact_email) = v_email
    limit 1;

    if v_is_nlo then
      v_role := 'company';
      update public.nlo_approved_companies
        set is_registered = true
        where lower(contact_email) = v_email;
    else
      raise exception
        'Email % is not permitted to register. Students must use a @cit.edu address; companies must be approved by the NLO first.',
        new.email
        using errcode = 'check_violation';
    end if;
  end if;

  -- Prefer structured parts; fall back to a single full_name if provided.
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

  return new;
end;
$$;
