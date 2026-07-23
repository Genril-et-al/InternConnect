-- Add contact details to companies table
alter table public.companies
  add column if not exists contact_email text,
  add column if not exists contact_phone text;
