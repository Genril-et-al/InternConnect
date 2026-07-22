-- applicant_profiles view was frozen to seven columns in 20260719062139 before
-- profiles.cover_letter_url existed (added in 20260720000001). companyQueries.ts
-- now selects cover_letter_url from the view, which fails since the view never
-- projected it. Recreate the view with cover_letter_url added; predicate and
-- grants are unchanged from 20260719062139.
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
    p.cover_letter_url,
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
