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
sends over Gmail SMTP (`smtp.gmail.com:465`) using a Gmail App Password.

> Why this instead of the built-in SMTP settings? The sending logic lives in
> versioned code, is easy to swap to a provider API (e.g. Resend) later — replace
> `sendEmail()` in the function and drop the Gmail secrets — and reaches real
> `@cit.edu` inboxes today.

**Step 1 — Gmail App Password.** On `internconnect000@gmail.com`, turn on
**2-Step Verification** (myaccount.google.com → Security), then create an **App
Password** at myaccount.google.com/apppasswords (16 characters). Gmail rejects
normal-password SMTP — the App Password is required.

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
supabase secrets set GMAIL_APP_PASSWORD="the-16-char-app-password"
# optional overrides (defaults shown):
# supabase secrets set GMAIL_USER="internconnect000@gmail.com"
# supabase secrets set EMAIL_FROM_NAME="InternConnect"
```

**Step 5 — (optional) turn off Supabase's own SMTP.** With the hook enabled, the
old **Custom SMTP** settings are no longer used for these emails; you can leave
them blank. Raise **Authentication → Rate Limits → emails per hour** if you expect
more than the default (Gmail allows ~500/day).

> **No custom domain yet?** Gmail SMTP is exactly why this works without one —
> you send *from* the Gmail account. To later send from `no-reply@yourdomain.com`
> and drop the Gmail dependency, verify a domain in Resend and swap the
> `sendEmail()` body in the function for a Resend API call.

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
