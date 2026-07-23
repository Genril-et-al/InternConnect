/**
 * Applies all pending migrations to the live Supabase project via the
 * Supabase Management API.
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
 *   node scripts/apply-pending-migrations.mjs
 *
 * The service role key is in:
 *   Supabase dashboard → Project Settings → API → service_role (secret)
 */

import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '..')

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const envLocal = readFileSync(resolve(root, '.env.local'), 'utf8')
const urlMatch = envLocal.match(/VITE_SUPABASE_URL=(.+)/)
if (!urlMatch) { console.error('VITE_SUPABASE_URL not found in .env.local'); process.exit(1) }
const supabaseUrl = urlMatch[1].trim()
const refMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
if (!refMatch) { console.error('Could not extract project ref from', supabaseUrl); process.exit(1) }
const projectRef = refMatch[1]

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) {
  console.error(
    '\nMissing SUPABASE_SERVICE_ROLE_KEY.\n' +
    'Run this first:\n\n' +
    '  $env:SUPABASE_SERVICE_ROLE_KEY = "<your-service-role-key>"\n\n' +
    'Find it at: Supabase dashboard → Project Settings → API → service_role\n'
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// These are the migrations we know are NOT yet in the remote schema cache.
// Add more filenames here whenever a migration fails to auto-apply.
// ---------------------------------------------------------------------------
const PENDING = [
  '20260724040000_listing_requirements_instructions_and_templates.sql',
  '20260724050000_add_course_to_applicant_profiles.sql',
  '20260724051000_backfill_profile_course_and_year.sql',
  '20260724060000_admin_update_student_course.sql',
]

const migrationsDir = resolve(root, 'supabase/migrations')
const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`

async function runSql(sql, label) {
  process.stdout.write(`  Applying ${label}… `)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`FAILED (HTTP ${res.status})`)
    console.error(body)
    return false
  }
  console.log('done ✅')
  return true
}

console.log(`\nProject: ${projectRef}`)
console.log(`Applying ${PENDING.length} pending migrations...\n`)

let allOk = true
for (const filename of PENDING) {
  const sql = readFileSync(resolve(migrationsDir, filename), 'utf8')
  const ok = await runSql(sql, filename)
  if (!ok) { allOk = false; break }
}

if (allOk) {
  console.log('\n✅ All migrations applied successfully!')
  console.log('\nWhat was fixed:')
  console.log('  • template_file_url column added to listing_requirements')
  console.log('  • course / year_level added to applicant_profiles view')
  console.log('  • Existing student profiles backfilled with course / year_level')
  console.log('  • admin_update_student_course RPC created for admin corrections')
} else {
  console.log('\n❌ Migration failed — see error above.')
  process.exit(1)
}
