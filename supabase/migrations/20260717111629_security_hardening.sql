-- InternConnect — Security hardening (advisor findings + role-escalation fix)
-- Run in the Supabase SQL editor after 0004_core_domain.sql.
-- (Applied to the remote project via MCP on 2026-07-17.)

-- 1) Pin search_path on the shared trigger function (advisor: 0011).
alter function public.set_updated_at() set search_path = public;

-- 2) handle_new_user is a trigger function; it must not be callable via
--    /rest/v1/rpc (advisor: 0028/0029). Triggers still fire regardless.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 3) avatars: public-URL access doesn't need a SELECT policy; the broad one
--    let anyone list the whole bucket (advisor: 0025). Owner keeps SELECT so
--    upsert (INSERT+SELECT+UPDATE) still works.
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_owner_read" on storage.objects;
create policy "avatars_owner_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 4) profiles: scope policies to authenticated, use the initplan-friendly
--    (select auth.uid()) form, and add an explicit WITH CHECK.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- 5) CRITICAL: users could update their own profiles row *including role*,
--    letting a student self-promote to admin. Guard privileged columns.
--    auth.uid() is null for the postgres/service_role paths (SQL editor,
--    server-side jobs), which stay allowed for admin seeding.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and (new.role is distinct from old.role
          or new.is_active is distinct from old.is_active
          or new.email is distinct from old.email) then
    raise exception 'Only the admin can change role, active status, or email';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_privileges on public.profiles;
create trigger trg_guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- 6) is_admin(): RLS policies evaluate it as the calling role, so
--    authenticated must keep EXECUTE. anon never needs it (all policies are
--    TO authenticated).
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 7) Same service-path bypass for the other guards, so dashboard/SQL-editor
--    administration (auth.uid() is null) isn't blocked.
create or replace function public.guard_company_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and new.verification is distinct from old.verification then
    raise exception 'Only the admin can change company verification status';
  end if;
  return new;
end;
$$;

create or replace function public.guard_listing_flag()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and new.is_flagged is distinct from old.is_flagged then
    raise exception 'Only the admin can flag or unflag a listing';
  end if;
  return new;
end;
$$;
