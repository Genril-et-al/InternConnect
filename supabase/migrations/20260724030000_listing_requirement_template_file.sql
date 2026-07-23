-- ---------------------------------------------------------------------------
-- listing_requirements.template_file_url
-- The company can attach an optional template/document to each pre-employment
-- requirement (e.g. a blank NDA or medical-cert form for the student to fill
-- in). The upload field exists in the listing form, but the live table had no
-- column to store it, so PostgREST rejected the write with
--   "Could not find the 'template_file_url' column of 'listing_requirements'
--    in the schema cache".
-- Add the column so the uploaded template round-trips.
-- ---------------------------------------------------------------------------
alter table public.listing_requirements
  add column if not exists template_file_url text;
