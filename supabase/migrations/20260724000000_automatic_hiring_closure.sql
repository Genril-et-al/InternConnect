-- Migration: Automatic Hiring Closure

create or replace function public.notify_application_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_company_name text;
  v_msg   text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  
  select l.title, c.name into v_title, v_company_name 
  from public.listings l 
  join public.companies c on c.id = l.company_id 
  where l.id = new.listing_id;
  
  if new.status = 'rejected' and new.feedback = 'Hiring completed – All available internship positions have been filled.' then
    v_msg := format('Internship Listing Closed: Thank you for your interest in the %s position at %s. The company has completed its hiring process, and all available internship positions have been filled. As a result, your application has been closed for this listing. We appreciate your interest and encourage you to explore other internship opportunities available on InternConnect.', v_title, v_company_name);
  else
    v_msg := case new.status
      when 'accepted' then format('Congratulations! You were accepted for "%s". Check your pre-employment requirements.', v_title)
      when 'rejected' then format('Update on "%s": your application was not successful this time.', v_title)
      when 'under_review' then format('Your application for "%s" is now under review.', v_title)
      when 'shortlisted' then format('You were shortlisted for "%s"!', v_title)
      when 'interview_scheduled' then format('An interview was scheduled for "%s".', v_title)
      else format('Your application for "%s" was updated.', v_title)
    end;
  end if;
  
  insert into public.notifications (user_id, message, nav_hint)
  values (new.student_id, v_msg, 'Applications');
  return new;
end;
$$;


create or replace function public.check_and_close_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_slots int;
  v_accepted_count int;
  v_title text;
  v_company_id uuid;
  v_company_name text;
  v_owner_id uuid;
begin
  select slots, title, company_id into v_slots, v_title, v_company_id
  from public.listings where id = p_listing_id and status != 'closed';
  
  if not found then return; end if;

  select name, owner_id into v_company_name, v_owner_id
  from public.companies where id = v_company_id;

  -- Calculate accepted count
  select count(*) into v_accepted_count
  from public.applications a
  where a.listing_id = p_listing_id and a.status = 'accepted'
  and not exists (
    select 1 from public.listing_requirements r
    left join public.requirement_submissions s 
      on s.requirement_id = r.id and s.application_id = a.id
    where r.listing_id = p_listing_id and r.is_printable = false
    and (s.status is null or s.status != 'approved')
  );

  if v_accepted_count >= v_slots then
    -- 1. Close listing
    update public.listings set status = 'closed' where id = p_listing_id;

    -- 2. Reject pending/interview/offered applicants
    update public.applications
    set status = 'rejected',
        feedback = 'Hiring completed – All available internship positions have been filled.'
    where listing_id = p_listing_id and status in ('pending', 'under_review', 'shortlisted', 'interview_scheduled', 'offered');
    
    -- 3. Notify recruiter
    insert into public.notifications (user_id, message, nav_hint)
    values (v_owner_id, format('Hiring Completed: All available internship positions for %s have now been filled. The listing has been automatically marked as Hiring Closed, and all remaining Pending and Interview applicants have been notified.', v_title), 'Listings');
  end if;
end;
$$;

grant execute on function public.check_and_close_listing(uuid) to authenticated;
