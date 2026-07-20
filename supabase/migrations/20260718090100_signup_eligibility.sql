-- InternConnect — Signup eligibility pre-check (UC-S01)
-- Lets the signup form ask the database whether an email is cleared to register
-- *before* requesting an OTP, so a non-rostered email gets a clear message
-- instead of a generic 500 from the create-user trigger. Run after 0007.
--
-- Returns the resolved role ('student' | 'company') or NULL if the email is not
-- on the approved_students roster nor the nlo_approved_companies allowlist.
-- SECURITY DEFINER so it can call resolve_signup_role (whose EXECUTE is revoked
-- from client roles); it exposes only a yes/no-ish role, no other data.
create or replace function public.check_signup_eligibility(p_email text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select public.resolve_signup_role(lower(p_email))::text;
$$;

-- Callable before login (during signup the user is anonymous). This reveals
-- roster membership for a guessed email — the same thing the signup attempt
-- itself already reveals — which is acceptable for this NLO-managed roster.
revoke execute on function public.check_signup_eligibility(text) from public;
grant  execute on function public.check_signup_eligibility(text) to anon, authenticated;
