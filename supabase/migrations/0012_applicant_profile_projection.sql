-- InternConnect — Stop companies reading applicants' personal details (audit finding 1)
-- Run in the Supabase SQL editor after 0011_rls_least_privilege.sql.
-- MUST ship together with the fetchApplicants() change in
-- src/company/companyQueries.ts -- see the note at the bottom.
--
-- "profiles_select_applicants" (0004) lets a company read the profiles rows of
-- students who applied to its listings. The intent is right, but RLS is
-- row-level: it cannot restrict columns, so it hands over the WHOLE row.
-- Since 0003 that row includes address, age, gender, personal_email and
-- contact_number -- all populated in production.
--
-- The app only ever asks for seven fields (full_name, email, skills,
-- specializations, resume_url, portfolio_link, portfolio_file_url), so the UI
-- is the only thing hiding the rest. A company owner can read a student's home
-- address straight from the browser console. The UI is not a security boundary.
--
-- Fix: drop the row policy and expose exactly those seven columns through a
-- view that does its own gating. Columns absent from the projection cannot be
-- selected at all, so this is a structural fix rather than another predicate
-- that has to be kept correct.

-- ---------------------------------------------------------------------------
-- applicant_profiles: the seven fields the Applicants view actually renders.
--
-- security_invoker = false (definer semantics): the view runs as its owner and
-- so bypasses RLS on profiles -- which is the point, since the policy granting
-- companies access to those rows is being dropped below. The WHERE clause is
-- what gates access, and it is the same predicate the dropped policy used.
--
-- my_company_id() resolves from auth.uid(), which is the CALLER's claim even
-- though the view body runs as owner, so each company sees only its own
-- applicants. For a student or an admin (no company row) it returns NULL and
-- the view yields nothing -- admins read student data via admin_list_students()
-- instead.
--
-- This will raise the `security_definer_view` advisor lint (0010). That is
-- intentional and is the mechanism, not an oversight: the whole point is to
-- read past RLS while exposing a strictly narrower set of columns.
-- ---------------------------------------------------------------------------
drop view if exists public.applicant_profiles;
create view public.applicant_profiles
with (security_invoker = false) as
  select
    p.id,
    p.full_name,
    p.email,
    p.skills,
    p.specializations,
    p.resume_url,
    p.portfolio_link,
    p.portfolio_file_url
  from public.profiles p
  where exists (
    select 1
    from public.applications a
    join public.listings l on l.id = a.listing_id
    where a.student_id = p.id
      and l.company_id = public.my_company_id()
  );

comment on view public.applicant_profiles is
  'Column-limited projection of profiles for the companies an applicant applied to. Replaces the profiles_select_applicants RLS policy, which could not restrict columns and so exposed address/age/gender/personal_email/contact_number.';

revoke all on public.applicant_profiles from public, anon;
grant select on public.applicant_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Drop the over-broad policy this view replaces.
--
-- Companies keep reading applicant names/skills/resumes -- through the view.
-- Students still read their own row (profiles_select_own_or_admin, 0005) and
-- admins still read every row through the same policy, so nothing else needs it.
--
-- Coordination: fetchApplicants() embedded profiles:student_id(...) directly.
-- That embed resolves against public.profiles and returns null once this policy
-- is gone, rendering every applicant as "Unknown student". The companion commit
-- switches it to query applicant_profiles. Apply this migration and deploy that
-- change together.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_applicants" on public.profiles;
