-- ---------------------------------------------------------------------------
-- listing_requirements.description
-- The company can type a free-text instruction for each pre-employment
-- requirement (e.g. "Signed by a licensed physician"). It was collected in the
-- UI but never persisted, so students and the company preview only ever saw the
-- static "Text instruction" label. Add the column so the typed text round-trips.
-- ---------------------------------------------------------------------------
alter table public.listing_requirements
  add column if not exists description text;
