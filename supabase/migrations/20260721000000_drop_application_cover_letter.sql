-- Drop applications.cover_letter.
--
-- Cover letters are files on the student's profile (profiles.cover_letter_url,
-- see 20260720000001) rather than text typed into the apply modal. The modal's
-- textarea is gone, so nothing writes this column and nothing reads it: the
-- student's application list and the company's applicant detail both render the
-- uploaded file now.
--
-- This destroys whatever text pre-existing rows still hold. That text is
-- already invisible in the UI, and there is no path to surface it again.

-- 1) Rebuild the update guard from 20260719061624 first. It names
--    new.cover_letter / old.cover_letter, and plpgsql resolves column
--    references at execution time -- dropping the column out from under the
--    live function would leave every student/company UPDATE on applications
--    failing at runtime rather than at migration time. The remaining frozen
--    columns and the error message are unchanged.
create or replace function public.guard_application_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and (new.id         is distinct from old.id
          or new.student_id  is distinct from old.student_id
          or new.listing_id  is distinct from old.listing_id
          or new.created_at  is distinct from old.created_at) then
    raise exception
      'Only status, next_step, and feedback may be changed on an application';
  end if;
  return new;
end;
$$;

-- Re-assert the grant revocation: create or replace keeps the existing ACL, but
-- restating it keeps this file correct if the function is ever created fresh.
revoke execute on function public.guard_application_update()
  from public, anon, authenticated;

-- 2) Now the column is unreferenced.
alter table public.applications
  drop column if exists cover_letter;
