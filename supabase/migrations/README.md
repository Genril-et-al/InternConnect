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
migrations applied through the SQL Editor are not recorded there. Migrations
applied through the MCP server *are* recorded — it goes through the migration
system rather than a raw query, which is why the newer rows differ. Verified
against the live database 2026-07-20:

| Migration | Recorded in ledger | Present in database |
| --- | --- | --- |
| `0001`–`0005` | yes | yes |
| `0006_resume_analysis` | no | yes |
| `0006a_edge_function_errors` | no | yes |
| `0006b_student_allowlist` | yes | yes |
| `0007_admin_panel_data` | no | yes |
| `0008_signup_eligibility` | no | yes |
| `0009_notifications` | yes | yes |
| `0010_applied_listing_visibility` | yes | yes |
| `0011_rls_least_privilege` | yes | yes |
| `0012_applicant_profile_projection` | yes | yes |
| `0013_personal_email_signup` | yes | yes |

Every migration in this folder is now live. The ledger gaps on the older rows
are bookkeeping only; the schema is correct.

`0010`–`0013` were applied via MCP, so they carry ledger rows where the
SQL-Editor migrations above them do not.

Confirmed 2026-07-20 by querying the ledger and the catalog directly:
`has_applied_to()` exists (`0010`), the `applicant_profiles` view exists and
`profiles_select_applicants` is gone (`0012`).

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

To read the ledger itself — what the database believes it has applied:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

## Ship the migration and its code together

A migration that changes RLS breaks the app the moment it lands, unless the
code that queries around it ships at the same time. `0012` is the worked
example: it dropped `profiles_select_applicants`, and the query in
`fetchApplicants` had to move to the `applicant_profiles` view in the same
breath. The file says so in its own header.

That did not happen. `0012` went to the shared database on 2026-07-19 while
the matching code sat unmerged on `fix/rls-least-privilege` until 2026-07-20.
For a day, every machine except the author's rendered every applicant as
"Unknown student" — because a blocked embed returns null rather than an
error, so RLS denial arrives disguised as missing data.

The database is shared; branches are not. Applying a migration deploys it to
everyone instantly, so treat "applied to remote" as a deploy: merge the code
first, or apply and merge together.

## Avoiding future drift

`supabase init` followed by `supabase db push` would apply migrations from this
folder and record them, removing the copy-paste step that caused the gaps
above.
