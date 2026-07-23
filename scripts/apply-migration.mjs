/**
 * Applies the admin_update_student_course migration directly via the
 * Supabase Management API (pg_query endpoint).
 *
 * Usage:  node scripts/apply-migration.mjs
 *
 * Reads VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or falls back to
 * reading .env.local for the project URL so we know the project ref).
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '..')

// Read .env.local for the project URL
const envLocal = readFileSync(resolve(root, '.env.local'), 'utf8')
const urlMatch = envLocal.match(/VITE_SUPABASE_URL=(.+)/)
if (!urlMatch) { console.error('VITE_SUPABASE_URL not found in .env.local'); process.exit(1) }

const supabaseUrl = urlMatch[1].trim()
// Extract project ref from https://<ref>.supabase.co
const refMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
if (!refMatch) { console.error('Could not extract project ref from', supabaseUrl); process.exit(1) }
const projectRef = refMatch[1]

// Service role key must come from environment (never committed)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) {
  console.error(
    '\nMissing SUPABASE_SERVICE_ROLE_KEY.\n' +
    'Set it before running:\n\n' +
    '  $env:SUPABASE_SERVICE_ROLE_KEY = "<your-service-role-key>"\n' +
    '  node scripts/apply-migration.mjs\n\n' +
    'Find it in: Supabase dashboard → Project Settings → API → service_role key'
  )
  process.exit(1)
}

const sql = readFileSync(
  resolve(root, 'supabase/migrations/20260724060000_admin_update_student_course.sql'),
  'utf8'
)

const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`

console.log(`Applying migration to project: ${projectRef}`)

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
  console.error(`\nFailed (HTTP ${res.status}):\n`, body)
  process.exit(1)
}

console.log('\n✅ Migration applied successfully!\n')
console.log('The admin_update_student_course RPC is now live.')
console.log('Admins can click "Edit" on any registered student in Manage Students to correct their course and year level.')
