-- Add columns to store AI-extracted skills separately
alter table public.profiles
  add column if not exists ai_skills text[] not null default '{}',
  add column if not exists ai_specializations text[] not null default '{}';
