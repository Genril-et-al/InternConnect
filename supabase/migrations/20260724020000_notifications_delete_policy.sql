-- Notifications: let a user delete their own rows.
--
-- The bell has always had per-row Remove (X) and Remove all (trash) controls,
-- and notificationsApi issues real DELETEs for them — but the original
-- notifications migration shipped only SELECT and UPDATE policies. With RLS on
-- and no DELETE policy, every delete was silently denied: the row disappeared
-- from the screen (optimistic local removal) yet stayed in the table, so it
-- came back on the next fetch. Live refresh made that immediate rather than
-- once-per-reload. Scope deletes to the owner, exactly like the other policies.

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));
