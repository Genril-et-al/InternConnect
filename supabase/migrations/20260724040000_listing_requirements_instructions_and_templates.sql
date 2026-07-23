-- Migration: Add description (instructions) and template_file_url to listing_requirements

ALTER TABLE public.listing_requirements ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.listing_requirements ADD COLUMN IF NOT EXISTS template_file_url text;

-- Storage policies for listing requirement templates in the 'documents' bucket
-- Allowed folder: 'templates/'

drop policy if exists "documents_student_read_templates" on storage.objects;
create policy "documents_student_read_templates" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'templates'
  );

drop policy if exists "documents_company_insert_templates" on storage.objects;
create policy "documents_company_insert_templates" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'templates'
  );

drop policy if exists "documents_company_update_templates" on storage.objects;
create policy "documents_company_update_templates" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'templates'
  );
