-- Migration: Application Cover Letter
-- Moves cover letter from profiles to applications.

-- 1) Add cover_letter_url to applications
alter table public.applications
  add column if not exists cover_letter_url text;

-- 2) Recreate applicant_profiles view without cover_letter_url
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

-- 3) Drop cover_letter_url from profiles
alter table public.profiles
  drop column if exists cover_letter_url;
