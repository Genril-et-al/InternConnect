# Migrations

Managed by the **Supabase CLI** since 2026-07-20 (`supabase init` + `supabase db push`).
Before that they were pasted into the SQL Editor by hand — see "History" below
for the drift that caused and how it was reconciled.

## Workflow

```sh
npx supabase migration new <name>   # creates supabase/migrations/<timestamp>_<name>.sql
# ...write the SQL...
npx supabase db push                # applies pending migrations to the linked project + records them
npx supabase migration list --linked  # local vs remote ledger, side by side
```

The project is linked to `mpuysdwgzijrppofvked` (see `supabase/.temp/`).
`db push` applies anything in this folder whose version is missing from the
remote ledger, in timestamp order — so a file landing here IS a deploy to the
shared database the next time anyone pushes.

## Ship the migration and its code together

A migration that changes RLS breaks the app the moment it lands, unless the
code that queries around it ships at the same time. `applicant_profile_projection`
is the worked example: it dropped `profiles_select_applicants`, and the query in
`fetchApplicants` had to move to the `applicant_profiles` view in the same
breath. That didn't happen — the migration hit the shared database on
2026-07-19 while the matching code sat unmerged for a day, and every machine
except the author's rendered applicants as "Unknown student" (a blocked embed
returns null, so RLS denial arrives disguised as missing data).

The database is shared; branches are not. Merge the code first, or push and
merge together.

## History: the hand-applied era

Everything up to `20260719141121_personal_email_signup` predates the CLI. Files
were originally numbered `0001`–`0013` and renamed on 2026-07-20 to the CLI's
`<timestamp>_<name>` format:

- **Ledger-recorded migrations** kept their exact ledger timestamp, so local
  and remote agree. Note `applied_listing_visibility` (old `0010`) was actually
  applied *after* `rls_least_privilege`/`applicant_profile_projection` (old
  `0011`/`0012`) — the timestamps reflect the real order, not the old numbering.
- **Four migrations were applied via the SQL Editor and never recorded**:
  `resume_analysis`, `edge_function_errors`, `admin_panel_data`,
  `signup_eligibility`. They carry synthetic timestamps (12:00/12:01 on 07-17,
  09:00/09:01 on 07-18) chosen to preserve dependency order, and were inserted
  into the remote ledger with `supabase migration repair --status applied` —
  their SQL was already live, only the bookkeeping was missing.
- **`20260717111711_is_admin_grants`** had a ledger row but no file: it re-ran
  the `is_admin()` grant block from `security_hardening` 42 seconds later. The
  file was reconstructed (idempotent) so every ledger row maps to a file.
- **`20260717120100_edge_function_errors`** was itself a reconstruction: the
  table existed only in the live database until the file was rebuilt from
  `information_schema`/`pg_policy` on 2026-07-20.

## Verifying

Local vs remote ledger:

```sh
npx supabase migration list --linked
```

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
