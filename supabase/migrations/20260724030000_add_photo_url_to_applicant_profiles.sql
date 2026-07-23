-- Migration: Add photo_url to applicant_profiles view

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
    p.photo_url
  from public.profiles p
  where exists (
    select 1
    from public.applications a
    join public.listings l on l.id = a.listing_id
    where a.student_id = p.id
      and l.company_id = public.my_company_id()
  );
