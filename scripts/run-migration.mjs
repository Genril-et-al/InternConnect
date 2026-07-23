/**
 * One-shot script to apply the listing_requirements migration.
 * Usage: node scripts/run-migration.mjs <SUPABASE_ACCESS_TOKEN>
 *
 * This hits the Management API (api.supabase.com), which authenticates with a
 * personal access token — NOT the project service_role key. Using the
 * service_role key here returns 401.
 *
 * Create a token at:
 *   Supabase Dashboard → Account → Access Tokens → Generate new token
 */

const PROJECT_REF = 'mpuysdwgzijrppofvked';
const accessToken = process.argv[2];

if (!accessToken) {
  console.error('Usage: node scripts/run-migration.mjs <SUPABASE_ACCESS_TOKEN>');
  process.exit(1);
}

const SQL = `
ALTER TABLE public.listing_requirements ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.listing_requirements ADD COLUMN IF NOT EXISTS template_file_url text;

drop policy if exists "documents_student_read_templates" on storage.objects;
create policy "documents_student_read_templates" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'templates'
  );

drop policy if exists "documents_company_insert_templates" on storage.objects;
create policy "documents_company_insert_templates" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'templates'
  );

drop policy if exists "documents_company_update_templates" on storage.objects;
create policy "documents_company_update_templates" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'templates'
  );
`;

async function runMigration() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log('Applying migration to project:', PROJECT_REF);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  });

  const text = await res.text();

  if (!res.ok) {
    console.error('❌ Failed:', res.status, text);
    process.exit(1);
  }

  console.log('✅ Migration applied successfully!');
  console.log('Response:', text);
}

runMigration().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
