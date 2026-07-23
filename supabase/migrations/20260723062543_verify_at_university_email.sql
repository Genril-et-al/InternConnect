-- InternConnect — Signup verification moves back to the university email
--
-- Reverses the delivery split from 20260719141121_personal_email_signup. The
-- code is now mailed to the institutional address itself: the student enters
-- their university email, the auth user is created with that address, and
-- Supabase sends the code there. A personal email is still collected at signup
-- but is contact detail on the profile only — it receives no mail, and it is
-- no longer what the student logs in with.
--
-- What this restores: receiving the code proves control of the university
-- mailbox again, so a rostered address can only be claimed by whoever actually
-- reads it. The 0013 note called this out as the cost of the split — anyone
-- who could guess a formulaic firstname.lastname@cit.edu could claim that
-- roster row by pointing it at their own inbox.
--
-- What it re-exposes: @cit.edu accepted our mail and then quarantined it,
-- which is the reason 0013 existed at all. If that filtering is still in
-- place, students will not receive the code and no application-side change can
-- fix it — it has to be solved at the mail layer (institutional allowlisting
-- of the sender, or moving off Gmail SMTP to an authenticated provider domain).
--
-- The function keeps reading raw_user_meta_data.university_email so accounts
-- created while 0013 was live continue to resolve; nothing in this migration
-- touches existing rows. Those students still authenticate with their personal
-- address, which is why password-reset's university -> auth email lookup stays.
--
-- The only behavioural change below is that the "already registered" check no
-- longer hides behind `if v_univ is not null`. On the direct path that guard
-- used to be redundant because auth.users.email is unique, but a roster row
-- claimed under 0013 has a PERSONAL auth email, so a second claim on the same
-- university address would sail past the unique constraint and fail later on
-- profiles.email with an opaque error instead of a readable one.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- The address the account authenticates with. Now the same as the lookup
  -- address for new signups; still the personal address for 0013-era accounts.
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
begin
  v_role := public.resolve_signup_role(v_lookup);

  if v_role is null then
    raise exception
      'Email % is not permitted to register. Students must be pre-registered by the NLO, and companies must be NLO-approved, before creating an account.',
      v_lookup
      using errcode = 'check_violation';
  end if;

  -- Single-use enforcement, now unconditional -- see the header note.
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
    update public.approved_students
      set is_registered = true
      where lower(email) = v_lookup;
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
    -- Institutional address stays the profile identity, as before. For new
    -- signups it now equals auth.users.email.
    v_lookup,
    v_role, v_full,
    nullif(v_first, ''), nullif(v_mi, ''), nullif(v_last, ''),
    v_suffix, v_age, v_gender, v_address,
    -- Whatever the signup form supplied; the 0013 fallback of recording the
    -- delivery address only applies to accounts that still carry the split.
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
  'Creates the profile for a new auth user. Signup verifies at the institutional address, so auth.users.email is the roster address; raw_user_meta_data.university_email is still honoured for accounts created during the personal-email era (migration 0013).';
