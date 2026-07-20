-- InternConnect — Auth foundation (UC-S01, UC-A01, UC-A03)
-- Roles, profiles, NLO company allowlist, domain enforcement, and RLS.
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'company', 'admin');
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user, linked to auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'student',
  email       text not null unique,
  full_name   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Application profile + role for each auth user.';

-- ---------------------------------------------------------------------------
-- nlo_approved_companies: admin-managed allowlist (UC-A03).
-- A company email must appear here before it may self-register (UC-C01).
-- ---------------------------------------------------------------------------
create table if not exists public.nlo_approved_companies (
  id             uuid primary key default gen_random_uuid(),
  company_name   text not null,
  contact_email  text not null unique,
  identifier     text,                      -- DTI / SEC / business permit no.
  added_by       uuid references auth.users (id) on delete set null,
  is_registered  boolean not null default false,
  created_at     timestamptz not null default now()
);

comment on table public.nlo_approved_companies is
  'NLO allowlist: companies an admin has cleared to self-register.';

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Signup gatekeeper + profile creation.
-- Runs in the same transaction as the auth.users insert, so RAISE aborts
-- the signup entirely. Enforces:
--   * @cit.edu email  -> student            (UC-S01 business rule)
--   * email on NLO allowlist -> company     (UC-A03 / UC-C01)
--   * anything else   -> rejected
-- Admins are seeded manually (see below), never self-registered.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email   text := lower(new.email);
  v_role    public.user_role;
  v_is_nlo  boolean;
begin
  if v_email like '%@cit.edu' then
    v_role := 'student';
  else
    select true into v_is_nlo
    from public.nlo_approved_companies
    where lower(contact_email) = v_email
    limit 1;

    if v_is_nlo then
      v_role := 'company';
      update public.nlo_approved_companies
        set is_registered = true
        where lower(contact_email) = v_email;
    else
      raise exception
        'Email % is not permitted to register. Students must use a @cit.edu address; companies must be approved by the NLO first.',
        new.email
        using errcode = 'check_violation';
    end if;
  end if;

  insert into public.profiles (id, email, role, full_name)
  values (
    new.id,
    v_email,
    v_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helper: is the current caller an admin? (SECURITY DEFINER avoids RLS
-- recursion when policies reference profiles.)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.nlo_approved_companies enable row level security;

-- profiles: read/update own row; admins read/update all.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- nlo_approved_companies: only admins manage the allowlist.
drop policy if exists "nlo_admin_all" on public.nlo_approved_companies;
create policy "nlo_admin_all" on public.nlo_approved_companies
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Seeding notes (run manually, not part of automatic migration):
--
-- 1) Create an admin: sign the user up through Supabase Auth (Dashboard >
--    Authentication > Add user) with any email, then:
--       update public.profiles set role = 'admin'
--       where email = 'admin@example.com';
--
-- 2) Approve a company so it can self-register:
--       insert into public.nlo_approved_companies (company_name, contact_email, identifier)
--       values ('Arcway Labs', 'hr@arcwaylabs.com', 'SEC-123456');
-- ---------------------------------------------------------------------------
