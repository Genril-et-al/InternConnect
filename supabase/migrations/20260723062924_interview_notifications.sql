-- Add trigger for interview scheduling changes (reschedule requests, proposed dates)

create or replace function public.notify_interview_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $BODY$
declare
  v_title text;
  v_owner uuid;
begin
  -- Only fire if next_step actually changed
  if new.next_step is not distinct from old.next_step then
    return new;
  end if;

  select l.title, c.owner_id into v_title, v_owner
  from public.listings l
  join public.companies c on c.id = l.company_id
  where l.id = new.listing_id;

  -- Detect reschedule requests from student
  if (old.next_step is null or old.next_step not like '%"studentResponse":"reschedule_requested"%') and 
     new.next_step like '%"studentResponse":"reschedule_requested"%' then
    if v_owner is not null then
      insert into public.notifications (user_id, message, nav_hint)
      values (v_owner, format('Student has requested to reschedule the interview for "%s".', v_title), 'Applicants');
    end if;
  end if;

  -- Detect company proposing new dates
  if (old.next_step is null or old.next_step not like '%"proposedDates":%') and 
     new.next_step like '%"proposedDates":%' then
    insert into public.notifications (user_id, message, nav_hint)
    values (new.student_id, format('The company has proposed new interview dates for "%s".', v_title), 'Applications');
  end if;

  -- Detect student confirming a proposed date (accepted)
  if (old.next_step is null or old.next_step not like '%"studentResponse":"accepted"%') and 
     new.next_step like '%"studentResponse":"accepted"%' then
    if v_owner is not null then
      insert into public.notifications (user_id, message, nav_hint)
      values (v_owner, format('Student has accepted the interview for "%s".', v_title), 'Applicants');
    end if;
  end if;

  return new;
end;
$BODY$;

drop trigger if exists trg_notify_interview_updates on public.applications;
create trigger trg_notify_interview_updates
  after update on public.applications
  for each row execute function public.notify_interview_updates();

revoke execute on function public.notify_interview_updates() from public, anon, authenticated;
