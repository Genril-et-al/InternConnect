-- Students could not accept/decline offers or withdraw acceptance: the only
-- UPDATE policy on applications was company-scoped, so student-side updates
-- (acceptOffer / rejectOffer / withdrawAcceptance in listingsApi.ts) matched
-- zero rows and failed silently.
--
-- Allow students to update their own applications, except ones already in a
-- final state (rejected / withdrawn). This covers:
--   offered   -> accepted | rejected        (accept / decline offer)
--   accepted  -> withdrawn                  (withdraw acceptance)
--   any live  -> discarded                  (auto-discard on accepting another offer)
--   discarded -> previous_status            (restore on withdrawal)
drop policy if exists applications_update_student on public.applications;
create policy applications_update_student on public.applications
  for update
  using (
    student_id = (select auth.uid())
    and status not in ('rejected'::application_status, 'withdrawn'::application_status)
  )
  with check (
    student_id = (select auth.uid())
  );
