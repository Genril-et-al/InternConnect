-- Add 'withdrawn' to application_status enum
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'withdrawn' AFTER 'discarded';

-- Add 'previous_status' column to 'applications' table
ALTER TABLE public.applications ADD COLUMN previous_status public.application_status;
