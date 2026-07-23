-- InternConnect — Core domain (UC-S03..S05, UC-C02..C05, UC-A02..A04)
-- Companies, internship listings, applications, bookmarks, and the
-- pre-employment requirements flow. Replaces the mock data in
-- src/lib/mockData.ts, src/company/companyData.ts, src/admin/adminData.ts.
-- Run in the Supabase SQL editor after 0003_profile_personal_details.sql.

-- ---------------------------------------------------------------------------
-- Enums
-- Lowercase snake_case in the DB; the UI maps them to display labels
-- (e.g. 'under_review' -> 'Under review', 'onsite' -> 'Onsite').
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_status') then
    create type public.verification_status as enum ('pending', 'verified', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'work_setup') then
    create type public.work_setup as enum ('onsite', 'remote', 'hybrid');
  end if;
  if not exists (select 1 from pg_type where typname = 'listing_status') then
    create type public.listing_status as enum ('draft', 'open', 'closed');
  end if;
  if not exists (select 1 from pg_type where typname = 'application_status') then
    create type public.application_status as enum
      ('pending', 'under_review', 'shortlisted', 'interview_scheduled', 'accepted', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'requirement_type') then
    create type public.requirement_type as enum ('file', 'text');
  end if;
  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type public.submission_status as enum ('pending', 'approved', 'rejected');
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- companies: one row per company account, owned by a 'company' profile.
-- Auto-created at signup from the NLO allowlist (see handle_new_user below).
-- `verification` is the admin document-review status (UC-A02) — separate from
-- the NLO allowlist, which only gates who may register at all.
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null unique references public.profiles (id) on delete cascade,
  name          text not null,
  industry      text,
  location      text,
  website       text,
  description   text,
  logo_url      text,
  verification  public.verification_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.companies is 'Company account profile; owner is a company-role auth user.';

-- Verification documents submitted for admin review (UC-A02).
-- Files live in the private `documents` bucket under the owner''s uid folder.
create table if not exists public.company_documents (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null,
  file_path   text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- listings: internship postings (UC-C02)
-- ---------------------------------------------------------------------------
create table if not exists public.listings (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  title           text not null,
  description     text,
  department      text,
  location        text,
  setup           public.work_setup not null default 'onsite',
  duration_hours  integer check (duration_hours is null or duration_hours > 0),
  slots           integer not null default 1 check (slots > 0),
  deadline        date,
  status          public.listing_status not null default 'draft',
  is_flagged      boolean not null default false,   -- admin moderation (UC-A04)
  skills          text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.listings is 'Internship listings posted by verified companies.';

-- Pre-employment requirements a company defines per listing (UC-C05).
create table if not exists public.listing_requirements (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings (id) on delete cascade,
  name          text not null,
  kind          public.requirement_type not null default 'file',
  is_printable  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- applications: a student applying to a listing (UC-S04)
-- The match % is computed in the app from skills overlap — not stored.
-- ---------------------------------------------------------------------------
create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings (id) on delete cascade,
  student_id    uuid not null references public.profiles (id) on delete cascade,
  status        public.application_status not null default 'pending',
  cover_letter  text,
  next_step     text,   -- shown on the student dashboard ("Interview on Jul 18…")
  feedback      text,   -- rejection feedback from the company
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (listing_id, student_id)
);

comment on table public.applications is 'Student applications; one per student per listing.';

-- A student''s submission for one listing requirement (after acceptance).
-- `file_path` for kind=file (documents bucket), `text_value` for kind=text.
create table if not exists public.requirement_submissions (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications (id) on delete cascade,
  requirement_id  uuid not null references public.listing_requirements (id) on delete cascade,
  file_path       text,
  text_value      text,
  status          public.submission_status not null default 'pending',
  submitted_at    timestamptz not null default now(),
  reviewed_at     timestamptz,
  updated_at      timestamptz not null default now(),
  unique (application_id, requirement_id)
);

-- Files a company sends to an accepted applicant (UC-C05 extension),
-- e.g. a contract to sign. Stored under the company owner''s uid folder.
create table if not exists public.application_files (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications (id) on delete cascade,
  name            text not null,
  file_path       text not null,
  size_bytes      bigint,
  note            text,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- bookmarks: student-saved listings (UC-S03)
-- ---------------------------------------------------------------------------
create table if not exists public.bookmarks (
  student_id  uuid not null references public.profiles (id) on delete cascade,
  listing_id  uuid not null references public.listings (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (student_id, listing_id)
);

-- ---------------------------------------------------------------------------
-- Indexes (FK columns + common filters)
-- ---------------------------------------------------------------------------
create index if not exists idx_company_documents_company   on public.company_documents (company_id);
create index if not exists idx_listings_company            on public.listings (company_id);
create index if not exists idx_listings_status             on public.listings (status);
create index if not exists idx_listing_requirements_listing on public.listing_requirements (listing_id);
create index if not exists idx_applications_listing        on public.applications (listing_id);
create index if not exists idx_applications_student        on public.applications (student_id);
create index if not exists idx_req_submissions_application on public.requirement_submissions (application_id);
create index if not exists idx_req_submissions_requirement on public.requirement_submissions (requirement_id);
create index if not exists idx_application_files_application on public.application_files (application_id);
create index if not exists idx_bookmarks_listing           on public.bookmarks (listing_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance (reuses set_updated_at from 0001)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

drop trigger if exists trg_listings_updated_at on public.listings;
create trigger trg_listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_applications_updated_at on public.applications;
create trigger trg_applications_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

drop trigger if exists trg_req_submissions_updated_at on public.requirement_submissions;
create trigger trg_req_submissions_updated_at
  before update on public.requirement_submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guards: only admins may change admin-owned fields.
-- ---------------------------------------------------------------------------
create or replace function public.guard_company_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.verification is distinct from old.verification and not public.is_admin() then
    raise exception 'Only the admin can change company verification status';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_company_verification on public.companies;
create trigger trg_guard_company_verification
  before update on public.companies
  for each row execute function public.guard_company_verification();

create or replace function public.guard_listing_flag()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_flagged is distinct from old.is_flagged and not public.is_admin() then
    raise exception 'Only the admin can flag or unflag a listing';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_listing_flag on public.listings;
create trigger trg_guard_listing_flag
  before update on public.listings
  for each row execute function public.guard_listing_flag();

-- ---------------------------------------------------------------------------
-- Helper: the company owned by the current user (null for students/admins).
-- SECURITY INVOKER — relies on the companies select policy below.
-- ---------------------------------------------------------------------------
create or replace function public.my_company_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select id from public.companies where owner_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- handle_new_user v4: also auto-create the companies row for company signups,
-- named from the NLO allowlist entry.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email      text := lower(new.email);
  v_role       public.user_role;
  v_is_nlo     boolean;
  v_first      text := coalesce(new.raw_user_meta_data ->> 'first_name', '');
  v_mi         text := coalesce(new.raw_user_meta_data ->> 'middle_initial', '');
  v_last       text := coalesce(new.raw_user_meta_data ->> 'last_name', '');
  v_suffix     text := nullif(coalesce(new.raw_user_meta_data ->> 'suffix', ''), '');
  v_age        integer := nullif(coalesce(new.raw_user_meta_data ->> 'age', ''), '')::integer;
  v_gender     text := nullif(coalesce(new.raw_user_meta_data ->> 'gender', ''), '');
  v_address    text := nullif(coalesce(new.raw_user_meta_data ->> 'address', ''), '');
  v_pemail     text := nullif(coalesce(new.raw_user_meta_data ->> 'personal_email', ''), '');
  v_contact    text := nullif(coalesce(new.raw_user_meta_data ->> 'contact_number', ''), '');
  v_full       text;
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

  -- Prefer structured parts; fall back to a single full_name if provided.
  v_full := nullif(trim(
    concat_ws(' ', nullif(v_first, ''), nullif(v_mi, ''), nullif(v_last, ''))
  ), '');
  if v_full is null then
    v_full := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  end if;

  insert into public.profiles (
    id, email, role, full_name, first_name, middle_initial, last_name,
    suffix, age, gender, address, personal_email, contact_number
  )
  values (
    new.id, v_email, v_role, v_full,
    nullif(v_first, ''), nullif(v_mi, ''), nullif(v_last, ''),
    v_suffix, v_age, v_gender, v_address, v_pemail, v_contact
  )
  on conflict (id) do nothing;

  if v_role = 'company' then
    insert into public.companies (owner_id, name)
    select new.id, c.company_name
    from public.nlo_approved_companies c
    where lower(c.contact_email) = v_email
    limit 1
    on conflict (owner_id) do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.companies               enable row level security;
alter table public.company_documents       enable row level security;
alter table public.listings                enable row level security;
alter table public.listing_requirements    enable row level security;
alter table public.applications            enable row level security;
alter table public.requirement_submissions enable row level security;
alter table public.application_files       enable row level security;
alter table public.bookmarks               enable row level security;

-- companies: any signed-in user can read (names/logos shown on listings);
-- owner edits own row (verification change blocked by trigger); admin manages all.
drop policy if exists "companies_select" on public.companies;
create policy "companies_select" on public.companies
  for select to authenticated
  using (true);

drop policy if exists "companies_update_own_or_admin" on public.companies;
create policy "companies_update_own_or_admin" on public.companies
  for update to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin())
  with check (owner_id = (select auth.uid()) or public.is_admin());

-- company_documents: owner company manages; admin reviews.
drop policy if exists "company_docs_owner_or_admin" on public.company_documents;
create policy "company_docs_owner_or_admin" on public.company_documents
  for all to authenticated
  using (company_id = public.my_company_id() or public.is_admin())
  with check (company_id = public.my_company_id() or public.is_admin());

-- listings: students see open listings; company sees its own (any status); admin all.
drop policy if exists "listings_select" on public.listings;
create policy "listings_select" on public.listings
  for select to authenticated
  using (
    status = 'open'
    or company_id = public.my_company_id()
    or public.is_admin()
  );

-- Only a *verified* company can post (UC-A02 gating).
drop policy if exists "listings_insert_verified_company" on public.listings;
create policy "listings_insert_verified_company" on public.listings
  for insert to authenticated
  with check (
    exists (
      select 1 from public.companies c
      where c.id = company_id
        and c.owner_id = (select auth.uid())
        and c.verification = 'verified'
    )
  );

drop policy if exists "listings_update_own_or_admin" on public.listings;
create policy "listings_update_own_or_admin" on public.listings
  for update to authenticated
  using (company_id = public.my_company_id() or public.is_admin())
  with check (company_id = public.my_company_id() or public.is_admin());

drop policy if exists "listings_delete_own_or_admin" on public.listings;
create policy "listings_delete_own_or_admin" on public.listings
  for delete to authenticated
  using (company_id = public.my_company_id() or public.is_admin());

-- listing_requirements: visible wherever the parent listing is visible
-- (the subquery re-applies the listings select policy); managed by the owner.
drop policy if exists "listing_reqs_select" on public.listing_requirements;
create policy "listing_reqs_select" on public.listing_requirements
  for select to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));

drop policy if exists "listing_reqs_manage" on public.listing_requirements;
create policy "listing_reqs_manage" on public.listing_requirements
  for all to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.company_id = public.my_company_id()
    ) or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.company_id = public.my_company_id()
    ) or public.is_admin()
  );

-- applications: student applies to open listings and reads own; the listing's
-- company reads/updates (status, next_step, feedback); admin reads all.
drop policy if exists "applications_insert_student" on public.applications;
create policy "applications_insert_student" on public.applications
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and status = 'pending'
    and exists (select 1 from public.listings l where l.id = listing_id and l.status = 'open')
  );

drop policy if exists "applications_select" on public.applications;
create policy "applications_select" on public.applications
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.company_id = public.my_company_id()
    )
    or public.is_admin()
  );

drop policy if exists "applications_update_company" on public.applications;
create policy "applications_update_company" on public.applications
  for update to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.company_id = public.my_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.company_id = public.my_company_id()
    )
  );

-- Students may withdraw an application that hasn't been acted on yet.
drop policy if exists "applications_withdraw_student" on public.applications;
create policy "applications_withdraw_student" on public.applications
  for delete to authenticated
  using (student_id = (select auth.uid()) and status = 'pending');

-- requirement_submissions: the applicant submits/replaces while not yet
-- approved (writes are forced to status='pending'); the company reviews.
drop policy if exists "req_submissions_insert_student" on public.requirement_submissions;
create policy "req_submissions_insert_student" on public.requirement_submissions
  for insert to authenticated
  with check (
    status = 'pending'
    and exists (
      select 1
      from public.applications a
      join public.listing_requirements r on r.listing_id = a.listing_id
      where a.id = application_id
        and r.id = requirement_id
        and a.student_id = (select auth.uid())
    )
  );

drop policy if exists "req_submissions_select" on public.requirement_submissions;
create policy "req_submissions_select" on public.requirement_submissions
  for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id and a.student_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = application_id and l.company_id = public.my_company_id()
    )
    or public.is_admin()
  );

drop policy if exists "req_submissions_update_student" on public.requirement_submissions;
create policy "req_submissions_update_student" on public.requirement_submissions
  for update to authenticated
  using (
    status <> 'approved'
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.student_id = (select auth.uid())
    )
  )
  with check (
    status = 'pending'
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.student_id = (select auth.uid())
    )
  );

drop policy if exists "req_submissions_review_company" on public.requirement_submissions;
create policy "req_submissions_review_company" on public.requirement_submissions
  for update to authenticated
  using (
    exists (
      select 1
      from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = application_id and l.company_id = public.my_company_id()
    )
  )
  with check (
    exists (
      select 1
      from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = application_id and l.company_id = public.my_company_id()
    )
  );

-- application_files: the company attaches; the applicant (and admin) can read.
drop policy if exists "app_files_company_manage" on public.application_files;
create policy "app_files_company_manage" on public.application_files
  for all to authenticated
  using (
    exists (
      select 1
      from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = application_id and l.company_id = public.my_company_id()
    )
  )
  with check (
    exists (
      select 1
      from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = application_id and l.company_id = public.my_company_id()
    )
  );

drop policy if exists "app_files_student_read" on public.application_files;
create policy "app_files_student_read" on public.application_files
  for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id and a.student_id = (select auth.uid())
    )
    or public.is_admin()
  );

-- bookmarks: strictly the student's own.
drop policy if exists "bookmarks_own" on public.bookmarks;
create policy "bookmarks_own" on public.bookmarks
  for all to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- profiles: let a company read the profiles of its applicants
-- (CompanyApplicants view needs name, skills, specializations, resume, etc.)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_applicants" on public.profiles;
create policy "profiles_select_applicants" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.student_id = profiles.id
        and l.company_id = public.my_company_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage policies (documents bucket, created in 0002)
-- Layout stays {uid}/... so the owner policies from 0002 keep working:
--   {student_uid}/resume.pdf, {student_uid}/requirements/{req_id}.pdf
--   {company_owner_uid}/applications/{application_id}/contract.pdf
-- ---------------------------------------------------------------------------

-- A company may read files owned by students who applied to its listings.
drop policy if exists "documents_company_read_applicants" on storage.objects;
create policy "documents_company_read_applicants" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1
      from public.applications a
      join public.listings l on l.id = a.listing_id
      join public.companies c on c.id = l.company_id
      where c.owner_id = (select auth.uid())
        and a.student_id::text = (storage.foldername(name))[1]
    )
  );

-- A student may read company-sent files attached to their application.
drop policy if exists "documents_student_read_app_files" on storage.objects;
create policy "documents_student_read_app_files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1
      from public.application_files f
      join public.applications a on a.id = f.application_id
      where f.file_path = storage.objects.name
        and a.student_id = (select auth.uid())
    )
  );

-- Admins may read all private documents (verification review, moderation).
drop policy if exists "documents_admin_read" on storage.objects;
create policy "documents_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.is_admin());
