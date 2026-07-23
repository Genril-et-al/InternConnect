-- Migration 20260724051000_backfill_profile_course_and_year.sql
--
-- Backfills course and year_level for existing student profiles.
-- Migration 20260723090000 added these columns and updated the signup trigger
-- to populate them for new users, but it left existing users with null values.
-- This pulls the values from their approved_students roster row.

update public.profiles p
set
  course = a.course,
  year_level = a.year_level
from public.approved_students a
where lower(p.email) = lower(a.email)
  and p.role = 'student'
  and (p.course is null or p.year_level is null);
