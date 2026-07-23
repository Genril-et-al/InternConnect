-- Migration: Handle withdrawn applications and re-open listings if they were closed

create or replace function public.notify_application_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_company_name text;
  v_owner_id uuid;
  v_student_name text;
  v_msg   text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  
  select l.title, c.name, c.owner_id into v_title, v_company_name, v_owner_id
  from public.listings l 
  join public.companies c on c.id = l.company_id 
  where l.id = new.listing_id;
  
  if new.status = 'withdrawn' then
    -- 1. Re-open the listing if it was closed
    update public.listings
    set status = 'open'
    where id = new.listing_id and status = 'closed';
    
    -- 2. Notify the company owner
    select full_name into v_student_name from public.profiles where id = new.student_id;
    if v_owner_id is not null then
      insert into public.notifications (user_id, message, nav_hint)
      values (v_owner_id, format('%s has withdrawn their application for "%s".', coalesce(v_student_name, 'A student'), v_title), 'Applicants');
    end if;
  else
    -- Standard student notifications
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
  end if;
  
  return new;
end;
$$;
