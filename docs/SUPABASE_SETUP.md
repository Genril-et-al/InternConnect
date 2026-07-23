# InternConnect — Supabase Setup (Login backend)

This backend uses **Supabase** (Postgres + Auth + Storage). Supabase Auth issues
the JWT access + refresh tokens, and Postgres Row-Level Security enforces the
student / company / admin roles. Follow these one-time steps to make the login
flow (UC-S01) live.

## 1. Create the project

1. Go to https://supabase.com and create a new project (the free tier is fine).
2. Open **Project Settings → API** and copy:
   - **Project URL**
   - **anon / publishable key** (safe for the browser)
   - **service_role key** — SECRET, keep it out of the frontend.

## 2. Configure the frontend env

Copy `.env.example` to `.env.local` and paste your values:

```
VITE_SUPABASE_URL=https://YOUR-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

`.env.local` is git-ignored, so your keys are never committed.

## 3. Apply the database schema

Open the Supabase **SQL Editor** and run **both** migrations in order:

1. [`supabase/migrations/0001_auth_foundation.sql`](../supabase/migrations/0001_auth_foundation.sql) — creates:
   - `profiles` — role + account record for every user
   - `nlo_approved_companies` — the admin-managed allowlist (UC-A03)
   - a signup trigger that enforces the domain rules and creates the profile
   - Row-Level Security policies
2. [`supabase/migrations/0002_profile_fields.sql`](../supabase/migrations/0002_profile_fields.sql) — adds:
   - structured name (`first_name`, `middle_initial`, `last_name`), `photo_url`,
     `skills[]`, `specializations[]`, `resume_url`, `portfolio_link`,
     `portfolio_file_url`, `profile_completed`
   - the `avatars` (public) and `documents` (private) **Storage buckets** with
     owner-scoped RLS for profile photos, resumes, and portfolios

## 4. Make the verification email send a 6-digit CODE (not a magic link)

The signup flow uses an email **code**, so the email template must include the
token instead of a link.

1. Go to **Authentication → Email Templates → Magic Link** (this template is used
   for OTP sign-in).
2. Make sure the body contains the token, e.g.:
   ```html
   <h2>Your InternConnect verification code</h2>
   <p>Enter this code to continue: <strong>{{ .Token }}</strong></p>
   ```
3. Go to **Authentication → Providers → Email** and:
   - Enable **Email OTP**.
   - Set the **OTP expiry** to **300 seconds** (5 minutes) to match UC-S01.
   - You may keep "Confirm email" on; the OTP verification confirms it.

> During development you don't need a real inbox — Supabase logs sent emails
> under **Authentication → Logs**, and you can also read the code there.

### 4a. Send codes from a real inbox (Send Email Hook — edge function delivery)

Supabase's **built-in** email sender is for testing only: it is rate-limited to a
handful of messages per hour and often never reaches the student. Instead of
configuring Supabase's SMTP settings directly, we deliver the code from an **edge
function we control** — the [`send-email-hook`](../supabase/functions/send-email-hook/index.ts)
**Send Email hook**. Supabase still generates, expires, and rate-limits the
6-digit code (no change to `src/lib/auth.ts`); the hook only owns *delivery*, and
sends over **Brevo**.

> Why this instead of the built-in SMTP settings? The sending logic lives in
> versioned code, picks its transport from whichever secrets are set, and reaches
> real `@cit.edu` inboxes today.

The hook uses the first transport whose secrets exist, and **raises if neither is
configured** rather than falling back to another provider:

| Order | Transport | Secrets |
| --- | --- | --- |
| 1 | `brevo-api` (recommended) | `BREVO_API_KEY` |
| 2 | `brevo-smtp` (what prod runs today) | `BREVO_SMTP_USER` + `BREVO_SMTP_KEY` |

Prefer the API. Auth hooks have a hard 5s timeout and a full SMTP session
(connect → TLS → AUTH → send → close) has measured 3.4–5.1s here, which already
cost real signups; an API send is a single ~300ms POST.

> There is no fallback provider on purpose. A Gmail fallback used to sit under
> these and it hid a live misconfiguration for days — the Gmail OAuth secrets were
> never set in production, so sends quietly took the slow path while the commit
> message said otherwise. A silent downgrade is indistinguishable from success.

**Step 1 — Brevo credentials.** In Brevo go to **SMTP & API**:

- **API Keys → Generate a new API key** → this is `BREVO_API_KEY` (starts
  `xkeysib-`). This is the one you want. Pasting the SMTP key here fails with
  `401 {"message":"Key not found"}`.
- The **SMTP** tab shows a login (like `b30c3b001@smtp-brevo.com`) and an SMTP key
  (starts `xsmtpsib-`) — only needed for the SMTP path. **Copy the login, don't
  retype it:** it is an opaque generated id, and one transposed character fails
  with `535 5.7.8 Authentication failed`, which reads like a wrong password.

Then under **Senders, Domains & Dedicated IPs**, verify the address you intend to
send from. Brevo rejects a send whose `From` is not a verified sender with
`400 sender not valid`.

**Step 2 — Deploy the function** (JWT verification OFF — it is called by the auth
server, not a logged-in user):

```
supabase functions deploy send-email-hook --no-verify-jwt
```

**Step 3 — Register the Send Email hook.** In the dashboard go to
**Authentication → Hooks → Send Email hook → Enable**, choose **HTTPS**, and point
it at the function URL:

```
https://YOUR-PROJECT-ref.supabase.co/functions/v1/send-email-hook
```

Supabase generates a **hook secret** (`v1,whsec_…`) here — copy it for the next step.

**Step 4 — Set the function secrets:**

```
supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_..."   # from step 3
supabase secrets set BREVO_API_KEY="xkeysib-..."
supabase secrets set EMAIL_FROM="the-verified-brevo-sender@example.com"
# SMTP instead of the API key (slower — see the 5s note above):
# supabase secrets set BREVO_SMTP_USER="b30c3b001@smtp-brevo.com"
# supabase secrets set BREVO_SMTP_KEY="xsmtpsib-..."
# optional overrides (defaults shown):
# supabase secrets set BREVO_SMTP_HOST="smtp-relay.brevo.com"
# supabase secrets set BREVO_SMTP_PORT="465"
# supabase secrets set EMAIL_FROM_NAME="InternConnect"
```

`BREVO_API_KEY` is checked **first**, so a stale or wrong value there shadows
working SMTP credentials. Unset it rather than leaving it around:

```
supabase secrets unset BREVO_API_KEY
```

The old `GMAIL_*` secrets are no longer read by anything and can be deleted.

**Step 5 — (optional) turn off Supabase's own SMTP.** With the hook enabled, the
dashboard's **Custom SMTP** settings are never used for these emails — even if
you configured Brevo there, delivery goes through this function's secrets
instead. You can leave the dashboard fields blank. Raise **Authentication → Rate
Limits → emails per hour** if you expect more than the default (Brevo's free tier
allows 300/day).

**Step 6 — Confirm which transport ran.** Every send logs its transport and
elapsed ms. In the dashboard, **Edge Functions → send-email-hook → Logs** should
show `"transport":"brevo-api"` (or `brevo-smtp`) with the `elapsed_ms` for that
send. That log, plus **Brevo → Transactional → Logs**, is how you tell "never
sent" apart from "sent and filtered" — the auth log alone cannot.

> **Deliverability:** Brevo signs with its own DKIM, so a `From` on a domain you
> do not control in Brevo (e.g. a plain `@gmail.com` address) fails DMARC
> alignment. Verify a domain you own in Brevo and set `EMAIL_FROM` to an address
> on it — that, not the provider swap by itself, is what improves the `@cit.edu`
> quarantine problem.

## 5. Seed an admin and approve a company

Admins are never self-registered. In the SQL Editor:

```sql
-- After creating a user via Authentication → Add user:
update public.profiles set role = 'admin' where email = 'admin@example.com';

-- Approve a company so it can self-register (UC-A03):
insert into public.nlo_approved_companies (company_name, contact_email, identifier)
values ('Arcway Labs', 'hr@arcwaylabs.com', 'SEC-123456');
```

## 6. Run it

```
npm install
npm run dev
```

Open the app: you'll land on the login screen. Try **Sign Up** with a
`firstname.lastname@cit.edu` address → enter the emailed 6-digit code → set a
password. On success you're routed into the role-appropriate portal.

## What's implemented so far

| Area | Status |
|------|--------|
| UC-S01 Register (email → code → password) | ✅ frontend + server rules |
| UC-S01 Login (email + password) | ✅ |
| Signup eligibility (roster-based, any domain) | ✅ `resolve_signup_role` + `check_signup_eligibility` pre-check |
| Student roster + company allowlist gate (UC-A03) | ✅ schema + trigger + admin UI |
| Role-based routing | ✅ derived from `profiles.role` |
| Deactivated-account block (UC-A01) | ✅ login gate (admin action pending) |
| Student profile setup (UC-S02) | ✅ name (read-only), photo, skills, specializations, resume, portfolio |
| File uploads (photo / resume / portfolio) | ✅ Supabase Storage + RLS |
| Password reset / change (UC-S02) | ⬜ next |
| Listings, applications tables | ⬜ next |
