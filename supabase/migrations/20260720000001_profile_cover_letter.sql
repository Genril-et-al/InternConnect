-- Add cover letter to student profiles
alter table public.profiles
  add column cover_letter_url text;
