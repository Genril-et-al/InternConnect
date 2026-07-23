-- Migration 20260724050000_add_course_to_applicant_profiles.sql
--
-- Adds course and year_level to the applicant_profiles view so the company
-- portal can display the student's registered programme alongside their resume.
-- These columns were added to profiles in 20260723090000_course_year_university
-- but were never included in the applicant_profiles projection.

create or replace view public.applicant_profiles as
  select
    p.id,
    p.full_name,
    p.email,
    p.skills,
    p.specializations,
    p.resume_url,
    p.portfolio_link,
    p.portfolio_file_url,
    p.photo_url,
    p.course,
    p.year_level
  from public.profiles p
  where exists (
    select 1
    from public.applications a
    join public.listings l on l.id = a.listing_id
    where a.student_id = p.id
      and l.company_id = public.my_company_id()
  );

comment on view public.applicant_profiles is
  'Safe applicant projection for company-portal reads. Exposes only the fields
   the UI actually renders; sensitive personal data (age, address, contact, etc.)
   is deliberately excluded. RLS on the view restricts rows to applicants of
   the calling company (my_company_id()).';

-- Grants are inherited from the previous definition on this view, but restating
-- them here is harmless and makes the migration self-documenting.
revoke all on public.applicant_profiles from public, anon;
grant select on public.applicant_profiles to authenticated;
