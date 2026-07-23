-- Migration 20260724060000_backfill_initial_student_course_year.sql
--
-- The first batch of registered student accounts predate the course/year_level
-- fields, so their approved_students roster rows were left null and the signup
-- trigger had nothing to copy into their profiles. They belong to the BSCPE
-- 3rd Year section — set their roster rows, then re-run the roster -> profiles
-- backfill so the student profile page displays course and year level.

update public.approved_students
set course = 'BSCPE', year_level = '3rd Year'
where lower(email) in (
  'adrianseth.tabotabo@cit.edu','altheamaeve.kinaadman@cit.edu','chielsea.napoles@cit.edu',
  'ejkate.alcover@cit.edu','gabriel.castaneda@cit.edu','jamesnino.mandawe@cit.edu',
  'lukemiguel.dongque@cit.edu','zedric.camilotes@cit.edu'
);

update public.profiles p
set course = a.course, year_level = a.year_level
from public.approved_students a
where lower(p.email) = lower(a.email)
  and p.role = 'student'
  and (p.course is null or p.year_level is null);
