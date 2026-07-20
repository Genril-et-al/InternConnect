-- Students lose sight of a listing the moment it stops being 'open'.
--
-- "listings_select" (0004) lets a student read a listing only while
-- status = 'open'. Once a company closes, fills, or archives it, the embedded
-- join in fetchMyApplications() returns null and the student's own application
-- renders as "—  ·  Unknown company" — including applications they were
-- ACCEPTED into, which is exactly when the details matter most.
--
-- Fix: a student may also read any listing they have applied to, whatever its
-- status. This grants no new rows beyond listings they already interacted with.
--
-- Why the helper function: "applications_select" already subqueries
-- public.listings. Referencing public.applications directly inside
-- "listings_select" would make the two policies evaluate each other and
-- Postgres would abort with "infinite recursion detected in policy". A
-- SECURITY DEFINER function bypasses RLS on applications, breaking the cycle.

create or replace function public.has_applied_to(p_listing uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.applications a
    where a.listing_id = p_listing
      and a.student_id = (select auth.uid())
  );
$$;

revoke all on function public.has_applied_to(uuid) from public;
grant execute on function public.has_applied_to(uuid) to authenticated;

drop policy if exists "listings_select" on public.listings;
create policy "listings_select" on public.listings
  for select to authenticated
  using (
    status = 'open'
    or company_id = public.my_company_id()
    or public.is_admin()
    or public.has_applied_to(id)
  );
