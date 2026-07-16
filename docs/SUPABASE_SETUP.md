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
| Domain restriction (@cit.edu students) | ✅ server trigger + client hint |
| Company allowlist gate (UC-A03) | ✅ schema + trigger (admin UI pending) |
| Role-based routing | ✅ derived from `profiles.role` |
| Deactivated-account block (UC-A01) | ✅ login gate (admin action pending) |
| Student profile setup (UC-S02) | ✅ name (read-only), photo, skills, specializations, resume, portfolio |
| File uploads (photo / resume / portfolio) | ✅ Supabase Storage + RLS |
| Password reset / change (UC-S02) | ⬜ next |
| Listings, applications tables | ⬜ next |
