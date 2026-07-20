-- InternConnect — RLS least-privilege pass (audit findings 2 and 3)
-- (1) Repairs "documents_company_read_applicants", which an identifier-shadowing
--     bug left matching zero rows -- companies could not open ANY applicant file
--     -- and re-scopes it so a company sees only its own applicants' documents.
-- (2) Restricts which columns a company may edit on an application.
-- Run in the Supabase SQL editor after 0010_applied_listing_visibility.sql.
--
-- (Audit finding 1 — companies can read applicants' address/age/gender/
-- personal_email/contact_number, because "profiles_select_applicants" is
-- row-level and so grants every column — is NOT fixed here. Dropping that
-- policy breaks the profiles embed in fetchApplicants(), so it needs a paired
-- frontend change and ships separately.)

-- ---------------------------------------------------------------------------
-- 1) Storage: repair a policy that currently grants nothing, without
--    re-opening the cross-company leak it was meant to avoid.
--
-- "documents_company_read_applicants" (0004) wrote an UNQUALIFIED `name`:
--     a.student_id::text = (storage.foldername(name))[1]
-- inside a subquery that joins public.companies AS c. Postgres binds `name`
-- to the innermost scope, so it resolved to companies.name, NOT
-- storage.objects.name -- pg_policy stores it as storage.foldername(c.name).
-- Company names contain no '/', so foldername() returns {} and [1] is NULL;
-- the comparison is NULL for every row and the policy matches NOTHING.
-- Companies currently cannot read applicant resumes or requirement
-- submissions at all. It failed closed, so nothing leaked -- but the
-- Applicants view has been unable to open files.
--
-- Every column reference below is schema-qualified so the same shadowing
-- cannot recur.
--
-- The scoping matters on the way back up, because the obvious repair
-- (qualify it as storage.objects.name) grants the student's ENTIRE folder:
-- a student who applies to company A and company B would hand each read
-- access to what the other collected -- medical certificates, clearances,
-- IDs submitted for the other company's requirements.
--
-- Scope it to the two things a company legitimately needs:
--   (a) top-level files -- {student_uid}/resume.pdf, portfolio uploads -- of a
--       student who applied to one of our listings; and
--   (b) requirement files submitted against one of OUR applications, matched
--       by path rather than by folder.
-- Requirement files for another company's listing now fall outside both arms.
-- ---------------------------------------------------------------------------
drop policy if exists "documents_company_read_applicants" on storage.objects;
create policy "documents_company_read_applicants" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      -- (a) resume / portfolio: files directly under {student_uid}/
      (
        array_length(storage.foldername(storage.objects.name), 1) = 1
        and exists (
          select 1
          from public.applications a
          join public.listings l on l.id = a.listing_id
          where l.company_id = public.my_company_id()
            and a.student_id::text = (storage.foldername(storage.objects.name))[1]
        )
      )
      -- (b) requirement submissions tied to an application on our own listing
      or exists (
        select 1
        from public.requirement_submissions s
        join public.applications a on a.id = s.application_id
        join public.listings l on l.id = a.listing_id
        where s.file_path = storage.objects.name
          and l.company_id = public.my_company_id()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2) applications: hold the company to the columns it is meant to edit.
--
-- "applications_update_company" (0004) restricts WHICH ROWS a company may
-- update but not WHICH COLUMNS -- RLS cannot express that. Its comment says
-- the intent is status / next_step / feedback, so a company can currently
-- reassign student_id, move an application between its own listings, or
-- backdate created_at. Same guard-trigger pattern as guard_profile_privileges
-- (0005) and guard_notification_update (0009).
--
-- cover_letter is frozen too: no UPDATE policy grants the student write access
-- after insert, so nothing legitimately edits it.
--
-- auth.uid() is null on the service_role / SQL-editor path, which stays
-- unrestricted for admin repair work -- matching the other guards.
-- ---------------------------------------------------------------------------
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
          or new.cover_letter is distinct from old.cover_letter
          or new.created_at  is distinct from old.created_at) then
    raise exception
      'Only status, next_step, and feedback may be changed on an application';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_application_update on public.applications;
create trigger trg_guard_application_update
  before update on public.applications
  for each row execute function public.guard_application_update();

-- Trigger function; never called directly (house convention, cf. 0009).
revoke execute on function public.guard_application_update()
  from public, anon, authenticated;
