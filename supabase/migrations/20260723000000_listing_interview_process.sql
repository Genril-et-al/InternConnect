-- Add interview_process column to internships (listings)
ALTER TABLE public.internships ADD COLUMN IF NOT EXISTS interview_process jsonb DEFAULT '{"rounds": ["Interview"]}'::jsonb;
