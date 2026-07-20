-- InternConnect — AI resume analysis (Gemini via the analyze-resume edge function)
-- Tracks whether the student's current resume yielded skills/specializations.
-- Run in the Supabase SQL editor after 0005_security_hardening.sql.

-- ---------------------------------------------------------------------------
-- resume_status:
--   pending_analysis — a resume exists but hasn't been analyzed yet
--   analyzed         — Gemini extracted at least one skill/specialization
--   no_skills_found  — Gemini found nothing to match; student must re-upload
-- NULL means no resume has been uploaded at all.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'resume_status') then
    create type public.resume_status as enum
      ('pending_analysis', 'analyzed', 'no_skills_found');
  end if;
end$$;

alter table public.profiles
  add column if not exists resume_status        public.resume_status,
  add column if not exists resume_analyzed_at   timestamptz,
  -- Gemini's improvement tip shown alongside the "Not applicable" message.
  add column if not exists resume_ai_suggestion text;

comment on column public.profiles.resume_status is
  'Outcome of the AI resume analysis; no_skills_found requires a re-upload.';
