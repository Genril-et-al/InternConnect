-- Add 'offered' and 'discarded' to application_status enum
-- We must use ALTER TYPE ... ADD VALUE for enums in PostgreSQL.

ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'offered' AFTER 'interview_scheduled';
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'discarded' AFTER 'rejected';
