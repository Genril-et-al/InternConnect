-- Migration 20260723000001_simplify_student_signup.sql
-- Updates handle_new_user to pull the student's name from the allowlist roster,
-- bypassing the need to ask for it during signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- The address the account authenticates with: personal for students on the
  -- new flow, the contact/university address for everyone else.
  v_auth       text := lower(new.email);
  -- Present only on the personal-email signup path.
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
  v_roster_first text;
  v_roster_mi    text;
  v_roster_last  text;
begin
  v_role := public.resolve_signup_role(v_lookup);

  if v_role is null then
    raise exception
      'Email % is not permitted to register. Students must be pre-registered by the NLO, and companies must be NLO-approved, before creating an account.',
      v_lookup
      using errcode = 'check_violation';
  end if;

  -- Single-use enforcement for the personal-email path.
  if v_univ is not null then
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
  end if;

  if v_role = 'student' then
    update public.approved_students
      set is_registered = true
      where lower(email) = v_lookup
      returning first_name, middle_initial, last_name into v_roster_first, v_roster_mi, v_roster_last;
      
    v_first := coalesce(nullif(v_first, ''), coalesce(v_roster_first, ''));
    v_mi := coalesce(nullif(v_mi, ''), coalesce(v_roster_mi, ''));
    v_last := coalesce(nullif(v_last, ''), coalesce(v_roster_last, ''));
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
    suffix, age, gender, address, personal_email, contact_number
  )
  values (
    new.id,
    -- Institutional address stays the profile identity, so the roster, admin
    -- views and company-facing queries are unaffected by where mail was sent.
    v_lookup,
    v_role, v_full,
    nullif(v_first, ''), nullif(v_mi, ''), nullif(v_last, ''),
    v_suffix, v_age, v_gender, v_address,
    -- Record the delivery address when it differs from the identity, unless
    -- the profile form already supplied one.
    coalesce(v_pemail, case when v_univ is not null then v_auth end),
    v_contact
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
  'Creates the profiles (and companies) row on auth.users insert, capturing metadata like names. Assigns roles based on the NLO allowlists. Flags the address as registered in the roster.';
