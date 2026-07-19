# Migrations

Applied **by hand** through the Supabase SQL Editor, in filename order. The
Supabase CLI is not initialised (no `supabase/config.toml`), so nothing runs
these automatically and nothing verifies the database matches this folder.

## Order

Run in filename order. Files sharing a number prefix (`0006`, `0006a`, `0006b`)
are independent of each other — each depends only on `0005`, so the order
among them does not matter.

## Applied vs. recorded

The database's own migration ledger does not match this folder, because
migrations applied through the SQL Editor are not recorded there. As of
2026-07-19:

| Migration | Recorded in ledger | Present in database |
| --- | --- | --- |
| `0001`–`0005` | yes | yes |
| `0006_resume_analysis` | no | yes |
| `0006a_edge_function_errors` | no | yes |
| `0006b_student_allowlist` | yes | yes |
| `0007_admin_panel_data` | no | yes |
| `0008_signup_eligibility` | no | yes |
| `0009_notifications` | yes | yes |
| `0010_applied_listing_visibility` | no | **no — not applied** |

Everything except `0010` is live. The ledger gaps are bookkeeping only; the
schema is correct.

### `is_admin_grants`

The ledger lists a migration named `is_admin_grants` (2026-07-17 11:17:11) with
no file here. It is **not** missing functionality: it re-ran the grant block
already present in `0005_security_hardening.sql` (lines 63–64), 42 seconds
after `security_hardening` was applied. The live ACL on `public.is_admin()`
matches that file exactly. Nothing needs recovering.

### `0006a_edge_function_errors`

This one *was* a real gap — the table existed only in the live database. The
file was reconstructed from `information_schema` and `pg_policy` and matches
production. Every statement is guarded, so re-running it is a no-op.

## Verifying

To confirm this folder can still rebuild the database, compare the live object
list against these files:

```sql
select 'TABLE: '||table_name from information_schema.tables
where table_schema='public' and table_type='BASE TABLE'
union all
select 'FUNC: '||proname from pg_proc where pronamespace='public'::regnamespace
order by 1;
```

Every result should be traceable to a file here.

## Avoiding future drift

`supabase init` followed by `supabase db push` would apply migrations from this
folder and record them, removing the copy-paste step that caused the gaps
above.
