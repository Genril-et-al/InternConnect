-- Add interview_process column to listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS interview_process jsonb DEFAULT '{"rounds": ["Interview"]}'::jsonb;
