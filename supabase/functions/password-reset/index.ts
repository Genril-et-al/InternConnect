// InternConnect — password-reset edge function
//
// Students type their UNIVERSITY email to reset a password, but since
// migration 0013 their auth identity is a PERSONAL address (@cit.edu accepts
// our mail then quarantines it, so codes sent there never arrive). Both halves
// of the reset therefore need a university -> personal lookup:
//
//   request: resetPasswordForEmail() keys on auth.users.email, so calling it
//            with the university address finds nobody and silently no-ops.
//   verify:  verifyOtp() needs the address the code was issued for, which the
//            logged-out client has no way to know.
//
// Why server-side rather than an RPC the client calls: mapping university ->
// personal for an unauthenticated caller would let anyone harvest students'
// personal addresses by guessing firstname.lastname@cit.edu. The mapping
// happens here, behind the service role, and the personal address is NEVER
// returned to the caller.
//
// Enumeration: 'request' always returns { ok: true }, whether or not the email
// exists. 'verify' returns one generic message for wrong code, expired code,
// and unknown account alike.
//
// Deploy with JWT verification DISABLED — callers are logged out by
// definition:  supabase functions deploy password-reset --no-verify-jwt
//
// Env (provided automatically by the edge runtime):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/**
 * Map whatever the user typed to the address their account authenticates with.
 *
 * profiles.email holds the university address (the roster identity) while
 * auth.users.email holds the delivery address, so the profile row is the join
 * between them. Falls back to the input unchanged, which covers companies,
 * pre-0013 students, and anyone who typed their personal address directly --
 * for those the two are the same value anyway.
 */
async function resolveAuthEmail(input: string): Promise<string> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', input)
    .maybeSingle()

  if (!profile) return input

  const { data, error } = await admin.auth.admin.getUserById(profile.id)
  if (error || !data?.user?.email) return input
  return data.user.email
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let action: string
  let email: string
  let code: string | undefined
  try {
    const body = await req.json()
    action = String(body.action ?? '')
    email = String(body.email ?? '').trim().toLowerCase()
    code = body.code ? String(body.code).trim() : undefined
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  if (!email) return json({ error: 'Email is required' }, 400)

  // The anon client drives the normal auth flow, so the send-email-hook fires
  // and the student gets the same code template as signup.
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  })

  if (action === 'request') {
    const authEmail = await resolveAuthEmail(email)
    const { error } = await anon.auth.resetPasswordForEmail(authEmail)
    // Logged, not surfaced: the response must not reveal whether the address
    // resolved to a real account.
    if (error) console.error('resetPasswordForEmail failed', error.message)
    return json({ ok: true })
  }

  if (action === 'verify') {
    if (!code) return json({ error: 'Code is required' }, 400)
    const authEmail = await resolveAuthEmail(email)
    const { data, error } = await anon.auth.verifyOtp({
      email: authEmail,
      token: code,
      type: 'recovery',
    })
    if (error || !data.session) {
      return json({ error: 'That code is not valid or has expired.' }, 400)
    }
    // The client adopts this session via setSession(), then updates the
    // password on it. Same tokens verifyOtp would have handed the browser
    // directly if it had known the delivery address.
    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
  }

  return json({ error: 'Unknown action' }, 400)
})
