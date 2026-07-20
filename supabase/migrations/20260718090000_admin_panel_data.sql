-- InternConnect — Admin panel live data (UC-A01 / UC-A02)
-- Backs the admin Manage Students / Manage Companies tables with real data
-- instead of frontend seed constants. Run after 0006_student_allowlist.sql.

-- ---------------------------------------------------------------------------
-- Persist deactivation context on the account (UC-A01 requires a recorded
-- reason). Previously the reason lived only in the browser and was lost on
-- refresh.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists deactivation_reason text,
  add column if not exists deactivated_at      timestamptz;

-- ---------------------------------------------------------------------------
-- admin_list_students: one row per rostered student, joined to their account
-- (if they have registered) and their application count. The roster is the
-- source of truth for "who is a student in the system", so students appear
-- here the moment an admin adds them — before they have signed up.
--
-- SECURITY DEFINER so it can read across profiles/applications past RLS, but it
-- hard-fails for anyone who is not an admin, and EXECUTE is restricted to
-- authenticated below.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_students()
returns table (
  email               text,
  full_name           text,
  first_name          text,
  last_name           text,
  student_number      text,
  is_registered       boolean,
  profile_id          uuid,
  is_active           boolean,
  deactivation_reason text,
  deactivated_at      timestamptz,
  application_count   bigint,
  joined              timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.email,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(concat_ws(' ', a.first_name, a.middle_initial, a.last_name)), ''),
      a.email
    )                                                    as full_name,
    a.first_name,
    a.last_name,
    a.student_number,
    a.is_registered,
    p.id                                                 as profile_id,
    coalesce(p.is_active, true)                          as is_active,
    p.deactivation_reason,
    p.deactivated_at,
    coalesce(ac.cnt, 0)                                  as application_count,
    coalesce(p.created_at, a.created_at)                 as joined
  from public.approved_students a
  left join public.profiles p
    on lower(p.email) = lower(a.email) and p.role = 'student'
  left join (
    select student_id, count(*) as cnt
    from public.applications
    group by student_id
  ) ac on ac.student_id = p.id
  where public.is_admin()          -- returns nothing to non-admins
  order by a.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- admin_list_companies: one row per NLO-allowlisted company, joined to their
-- account (if registered) with document and listing counts. Mirrors the
-- students function.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_companies()
returns table (
  contact_email  text,
  name           text,
  industry       text,
  verification   text,
  is_registered  boolean,
  company_id     uuid,
  docs           bigint,
  listings       bigint,
  submitted      timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.contact_email,
    coalesce(nullif(trim(c.name), ''), a.company_name)   as name,
    coalesce(nullif(trim(c.industry), ''), '—')          as industry,
    coalesce(c.verification::text, 'pending')            as verification,
    a.is_registered,
    c.id                                                 as company_id,
    coalesce(d.cnt, 0)                                   as docs,
    coalesce(l.cnt, 0)                                   as listings,
    coalesce(c.created_at, a.created_at)                 as submitted
  from public.nlo_approved_companies a
  left join public.profiles p
    on lower(p.email) = lower(a.contact_email) and p.role = 'company'
  left join public.companies c on c.owner_id = p.id
  left join (
    select company_id, count(*) as cnt
    from public.company_documents group by company_id
  ) d on d.company_id = c.id
  left join (
    select company_id, count(*) as cnt
    from public.listings group by company_id
  ) l on l.company_id = c.id
  where public.is_admin()
  order by a.created_at desc;
$$;

-- Internal admin endpoints — never callable by anon; the is_admin() gate inside
-- protects them even from non-admin authenticated users.
revoke execute on function public.admin_list_students()  from public, anon;
revoke execute on function public.admin_list_companies() from public, anon;
grant  execute on function public.admin_list_students()  to authenticated;
grant  execute on function public.admin_list_companies() to authenticated;
