-- InternConnect — Signup delivers the verification code to a personal email
--
-- Why: @cit.edu accepts our signup mail and then filters it (admin quarantine
-- or Junk), so students never see the code. Sending is not the problem --
-- Gmail transmits successfully and no bounce comes back -- so no change to
-- send-email-hook can fix it. Delivery has to move to an inbox the student
-- can actually read.
--
-- New flow: the student enters their UNIVERSITY email (checked against the
-- approved_students roster via check_signup_eligibility), then enters a
-- PERSONAL email. The auth user is created with the personal address, so
-- Supabase mails the code there, and the university address rides along in
-- raw_user_meta_data.university_email.
--
-- Identity therefore comes from the roster, not from the address that receives
-- the code. profiles.email keeps the university address (matching the roster,
-- and what admin views show); profiles.personal_email records the delivery
-- address. Note the consequence: auth.users.email is now the personal address,
-- so these students LOG IN with their personal email.
--
-- Security note, recorded deliberately: because the student supplies the
-- delivery address, receiving the code no longer proves control of the
-- university mailbox. Anyone who can guess a rostered @cit.edu address
-- (firstname.lastname@cit.edu is formulaic) could claim that roster row. The
-- mitigations that remain are (a) is_registered makes each row single-use --
-- enforced below, and newly necessary because auth.users.email no longer
-- collides on a second claim -- and (b) the NLO controls who is on the roster
-- at all. Backfilling approved_students.student_number and requiring it at
-- step 1 would close this properly; only 1 of 6 rows has one today.

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
begin
  v_role := public.resolve_signup_role(v_lookup);

  if v_role is null then
    raise exception
      'Email % is not permitted to register. Students must be pre-registered by the NLO, and companies must be NLO-approved, before creating an account.',
      v_lookup
      using errcode = 'check_violation';
  end if;

  -- Single-use enforcement for the personal-email path.
  --
  -- On the direct path this was free: auth.users.email is unique, so a second
  -- attempt on the same rostered address simply could not create a user. Once
  -- the auth address is a PERSONAL email that no longer holds -- two different
  -- personal addresses could each claim the same roster row -- so check it
  -- explicitly. (profiles.email is unique and would also reject the second
  -- insert, but with an opaque constraint error rather than this message.)
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
  'Creates the profile for a new auth user. Resolves role from the allowlists using raw_user_meta_data.university_email when present (personal-email signup), else auth.users.email.';
