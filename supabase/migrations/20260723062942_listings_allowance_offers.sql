-- Add allowance and offer deadline to listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS has_allowance boolean not null default false;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS offer_deadline_days integer not null default 3;
