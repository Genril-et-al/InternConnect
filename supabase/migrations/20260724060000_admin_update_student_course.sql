-- Migration 20260724060000_admin_update_student_course.sql
--
-- Provides an admin-only RPC to correct a student's course and year_level.
--
-- Why an RPC rather than a direct UPDATE grant?
--   profiles.course / year_level are read-only from the student's perspective
--   (they come from the approved_students roster and are locked in the UI).
--   A SECURITY DEFINER function lets the admin portal write both tables without
--   opening a broad UPDATE grant on profiles to authenticated users.
--
-- The function syncs both tables so the roster and the live profile stay in
-- agreement — if the student ever re-registers from a fresh account the trigger
-- will pull the corrected values from approved_students.

create or replace function public.admin_update_student_course(
  p_profile_id  uuid,
  p_email       text,
  p_course      text,
  p_year_level  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only admins may call this function.
  if not public.is_admin() then
    raise exception 'Permission denied'
      using errcode = 'insufficient_privilege';
  end if;

  -- Update the live profile (what the student and company portal see).
  update public.profiles
  set
    course     = nullif(trim(p_course), ''),
    year_level = nullif(trim(p_year_level), ''),
    updated_at = now()
  where id = p_profile_id;

  -- Keep the roster in sync so future re-registrations inherit the fix.
  update public.approved_students
  set
    course     = nullif(trim(p_course), ''),
    year_level = nullif(trim(p_year_level), '')
  where lower(email) = lower(trim(p_email));
end;
$$;

comment on function public.admin_update_student_course(uuid, text, text, text) is
  'Admin-only RPC. Corrects course and year_level on a registered student''s
   profile and keeps the approved_students roster row in sync.';

-- Restrict to authenticated users; is_admin() inside the body enforces the role.
revoke execute on function public.admin_update_student_course(uuid, text, text, text) from public, anon;
grant  execute on function public.admin_update_student_course(uuid, text, text, text) to authenticated;
