-- InternConnect — Student profile fields + file storage (UC-S02 profile setup)
-- Adds structured name, photo, skills, specializations, resume, portfolio,
-- and a completion flag to profiles; creates storage buckets with RLS.
-- Run in the Supabase SQL editor after 0001_auth_foundation.sql.

-- ---------------------------------------------------------------------------
-- New profile columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists first_name         text,
  add column if not exists middle_initial     text,
  add column if not exists last_name          text,
  add column if not exists photo_url          text,
  add column if not exists skills             text[] not null default '{}',
  add column if not exists specializations    text[] not null default '{}',
  add column if not exists resume_url         text,
  add column if not exists portfolio_link     text,
  add column if not exists portfolio_file_url text,
  add column if not exists profile_completed  boolean not null default false;

-- ---------------------------------------------------------------------------
-- Populate the structured name from signup metadata.
-- Names are captured at registration and shown read-only on the profile.
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
  v_first   text := coalesce(new.raw_user_meta_data ->> 'first_name', '');
  v_mi      text := coalesce(new.raw_user_meta_data ->> 'middle_initial', '');
  v_last    text := coalesce(new.raw_user_meta_data ->> 'last_name', '');
  v_full    text;
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

  insert into public.profiles (id, email, role, full_name, first_name, middle_initial, last_name)
  values (new.id, v_email, v_role, v_full, nullif(v_first, ''), nullif(v_mi, ''), nullif(v_last, ''))
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage buckets
--   avatars   — profile photos, public read
--   documents — resumes / portfolio files, private (owner-only for now)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Files are stored under a top-level folder named after the owner's user id:
--   avatars/{uid}/photo.png   documents/{uid}/resume.pdf
-- so (storage.foldername(name))[1] = auth.uid() scopes access to the owner.

-- avatars: public read, owner write.
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- documents: owner-only read + write.
drop policy if exists "documents_owner_read" on storage.objects;
create policy "documents_owner_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents_owner_insert" on storage.objects;
create policy "documents_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents_owner_update" on storage.objects;
create policy "documents_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents_owner_delete" on storage.objects;
create policy "documents_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
