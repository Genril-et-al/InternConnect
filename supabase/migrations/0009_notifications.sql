-- InternConnect — In-app notifications
-- One row per notification, written by SECURITY DEFINER triggers on the
-- domain tables. Users read/mark-read their own rows; nobody inserts
-- directly (trigger functions cannot be invoked from SQL).
-- Run after 0008_signup_eligibility.sql.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  message     text not null,
  -- Where the bell click should navigate: a view name for student/company
  -- portals ('Applications', 'Applicants', 'Listings', 'Profile') or
  -- 'admin:<nav index>' for the admin panel.
  nav_hint    text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.notifications is 'In-app notifications, written by domain triggers.';

create index if not exists idx_notifications_user
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Only the read flag is user-mutable; user_id reassignment is blocked by
-- WITH CHECK, other columns by the guard trigger below.
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.guard_notification_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.message is distinct from old.message
     or new.nav_hint is distinct from old.nav_hint
     or new.created_at is distinct from old.created_at then
    raise exception 'Only the read flag of a notification can be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_notification_update on public.notifications;
create trigger trg_guard_notification_update
  before update on public.notifications
  for each row execute function public.guard_notification_update();

-- ---------------------------------------------------------------------------
-- Trigger functions (SECURITY DEFINER so the insert bypasses RLS; safe
-- because trigger functions cannot be called directly from SQL).
-- ---------------------------------------------------------------------------

-- Student applied -> tell the listing's company owner.
create or replace function public.notify_new_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_title text;
begin
  select c.owner_id, l.title into v_owner, v_title
  from public.listings l
  join public.companies c on c.id = l.company_id
  where l.id = new.listing_id;
  if v_owner is not null then
    insert into public.notifications (user_id, message, nav_hint)
    values (v_owner, format('New application received for "%s".', v_title), 'Applicants');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_application on public.applications;
create trigger trg_notify_new_application
  after insert on public.applications
  for each row execute function public.notify_new_application();

-- Company changed an application's status -> tell the student.
create or replace function public.notify_application_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_msg   text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  select title into v_title from public.listings where id = new.listing_id;
  v_msg := case new.status
    when 'accepted' then format('Congratulations! You were accepted for "%s". Check your pre-employment requirements.', v_title)
    when 'rejected' then format('Update on "%s": your application was not successful this time.', v_title)
    when 'under_review' then format('Your application for "%s" is now under review.', v_title)
    when 'shortlisted' then format('You were shortlisted for "%s"!', v_title)
    when 'interview_scheduled' then format('An interview was scheduled for "%s".', v_title)
    else format('Your application for "%s" was updated.', v_title)
  end;
  insert into public.notifications (user_id, message, nav_hint)
  values (new.student_id, v_msg, 'Applications');
  return new;
end;
$$;

drop trigger if exists trg_notify_application_status on public.applications;
create trigger trg_notify_application_status
  after update on public.applications
  for each row execute function public.notify_application_status();

-- Student submitted a requirement -> tell the company owner.
-- Company reviewed a submission -> tell the student.
create or replace function public.notify_submission_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner   uuid;
  v_student uuid;
  v_req     text;
  v_title   text;
begin
  select c.owner_id, a.student_id, r.name, l.title
    into v_owner, v_student, v_req, v_title
  from public.applications a
  join public.listings l on l.id = a.listing_id
  join public.companies c on c.id = l.company_id
  join public.listing_requirements r on r.id = new.requirement_id
  where a.id = new.application_id;

  if tg_op = 'INSERT' or (old.status = 'pending' and new.status = 'pending'
      and (new.file_path is distinct from old.file_path
           or new.text_value is distinct from old.text_value)) then
    if v_owner is not null then
      insert into public.notifications (user_id, message, nav_hint)
      values (v_owner, format('"%s" was submitted for "%s" — ready for review.', v_req, v_title), 'Applicants');
    end if;
  elsif new.status is distinct from old.status then
    insert into public.notifications (user_id, message, nav_hint)
    values (
      v_student,
      case new.status
        when 'approved' then format('Your "%s" for "%s" was approved.', v_req, v_title)
        when 'rejected' then format('Your "%s" for "%s" needs revision — please resubmit.', v_req, v_title)
        else format('Your "%s" for "%s" was updated.', v_req, v_title)
      end,
      'Applications'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_submission_insert on public.requirement_submissions;
create trigger trg_notify_submission_insert
  after insert on public.requirement_submissions
  for each row execute function public.notify_submission_change();

drop trigger if exists trg_notify_submission_update on public.requirement_submissions;
create trigger trg_notify_submission_update
  after update on public.requirement_submissions
  for each row execute function public.notify_submission_change();

-- Admin changed company verification -> tell the owner.
create or replace function public.notify_company_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification is distinct from old.verification then
    insert into public.notifications (user_id, message, nav_hint)
    values (
      new.owner_id,
      case new.verification
        when 'verified' then 'Your company has been verified — you can now post internship listings.'
        when 'rejected' then 'Your company verification was rejected. Please contact the NLO office.'
        else 'Your company verification status is back under review.'
      end,
      case new.verification when 'verified' then 'Listings' else 'Profile' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_company_verification on public.companies;
create trigger trg_notify_company_verification
  after update on public.companies
  for each row execute function public.notify_company_verification();

-- Admin flagged/unflagged a listing -> tell the company owner.
create or replace function public.notify_listing_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if new.is_flagged is distinct from old.is_flagged then
    select owner_id into v_owner from public.companies where id = new.company_id;
    if v_owner is not null then
      insert into public.notifications (user_id, message, nav_hint)
      values (
        v_owner,
        case when new.is_flagged
          then format('Your listing "%s" was flagged by the NLO and is under review.', new.title)
          else format('Your listing "%s" was unflagged and is visible again.', new.title)
        end,
        'Listings'
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_listing_flag on public.listings;
create trigger trg_notify_listing_flag
  after update on public.listings
  for each row execute function public.notify_listing_flag();

-- New company account registered -> tell every admin to review verification.
create or replace function public.notify_admins_new_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, message, nav_hint)
  select p.id,
         format('New company registered: %s — review their verification.', new.name),
         'admin:2'
  from public.profiles p
  where p.role = 'admin';
  return new;
end;
$$;

drop trigger if exists trg_notify_admins_new_company on public.companies;
create trigger trg_notify_admins_new_company
  after insert on public.companies
  for each row execute function public.notify_admins_new_company();

-- Trigger functions are never called directly — remove the default EXECUTE
-- grant so they don't show up as callable RPC endpoints.
revoke execute on function public.notify_new_application() from public, anon, authenticated;
revoke execute on function public.notify_application_status() from public, anon, authenticated;
revoke execute on function public.notify_submission_change() from public, anon, authenticated;
revoke execute on function public.notify_company_verification() from public, anon, authenticated;
revoke execute on function public.notify_listing_flag() from public, anon, authenticated;
revoke execute on function public.notify_admins_new_company() from public, anon, authenticated;
revoke execute on function public.guard_notification_update() from public, anon, authenticated;
