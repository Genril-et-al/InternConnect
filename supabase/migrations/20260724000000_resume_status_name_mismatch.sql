-- InternConnect — add 'name_mismatch' to the resume_status enum.
-- The analyze-resume edge function now verifies that the name printed on the
-- uploaded resume matches the student's account name. A resume made out to
-- someone else is rejected with this status (its skills are not written), the
-- same way no_skills_found requires the student to upload a different file.
--
-- ALTER TYPE ... ADD VALUE is idempotent via IF NOT EXISTS and, since PG12, is
-- safe inside the migration transaction as long as the new value isn't used in
-- the same statement batch (it isn't — the edge function writes it at runtime).

alter type public.resume_status add value if not exists 'name_mismatch';
