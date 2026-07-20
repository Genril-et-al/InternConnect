-- 20260720000000_storage_bucket_limits
--
-- Neither bucket had a size cap or MIME restriction, so any authenticated user
-- could upload arbitrarily large files — and into the PUBLIC avatars bucket,
-- arbitrary content types (an HTML/SVG file served from our storage origin is
-- a stored-XSS vector). Flagged by the Supabase security review 2026-07-20.
--
-- avatars  (public):  5 MB, raster images only. SVG is deliberately excluded —
--                     it can carry scripts, which is exactly the risk on a
--                     public bucket. The uploaders' accept attributes match
--                     (src/profile/ProfileSetup.tsx, src/company/CompanyProfileView.tsx).
-- documents (private): 25 MB, no MIME restriction. Resumes/portfolios/zips
--                     arrive with too many legitimate content-types (and
--                     browsers report zip inconsistently across OSes) for a
--                     list to be safe; the bucket is private and only ever
--                     served via signed URLs, so size is the meaningful cap.
--
-- Storage enforces these on upload; existing objects are unaffected.

update storage.buckets
set file_size_limit    = 5242880, -- 5 MB
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'avatars';

update storage.buckets
set file_size_limit = 26214400 -- 25 MB
where id = 'documents';
