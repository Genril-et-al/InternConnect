-- InternConnect — edge function error log
--
-- RECOVERED FROM THE LIVE DATABASE, not written from scratch. This table was
-- created by hand in the SQL editor and never captured in a migration, so the
-- repo could not rebuild it. The definition below was reconstructed from
-- information_schema and pg_policy on 2026-07-19 and matches production.
--
-- ALREADY APPLIED to the live project — every statement is guarded, so running
-- it there is a no-op. It exists so a fresh database can be built from this
-- repo alone.
--
-- Written to by the analyze-resume edge function (see
-- supabase/functions/analyze-resume/index.ts) when Gemini cannot be reached or
-- returns nothing usable. Admin-readable so failures are diagnosable from the
-- UI rather than only from logs the team cannot reach.

create table if not exists public.edge_function_errors (
  id         uuid primary key default gen_random_uuid(),
  fn         text not null,
  detail     text not null,
  created_at timestamptz not null default now()
);

alter table public.edge_function_errors enable row level security;

-- Only admins read these; the edge function writes with the service role key,
-- which bypasses RLS, so no insert policy is needed.
drop policy if exists "efe_admin_read" on public.edge_function_errors;
create policy "efe_admin_read" on public.edge_function_errors
  for select to authenticated
  using (public.is_admin());
