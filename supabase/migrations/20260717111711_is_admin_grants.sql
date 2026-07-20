-- 20260717111711_is_admin_grants — reconstructed ledger match
--
-- The live ledger has a row for this migration but the repo never had a file:
-- it re-ran the is_admin() grant block already present in
-- 20260717111629_security_hardening.sql, 42 seconds after that migration was
-- applied (see migrations/README.md, "is_admin_grants"). This file exists so
-- every ledger row maps to a file and `supabase db push` sees local and remote
-- in agreement. Idempotent; re-running is a no-op.

revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;
