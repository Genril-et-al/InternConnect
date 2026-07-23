// InternConnect — send-email-hook edge function
//
// Supabase "Send Email" auth hook. Instead of letting Supabase's own SMTP
// (previously Gmail Custom SMTP configured in the dashboard) deliver the signup
// verification code, Supabase now hands the generated code to THIS function and
// we put it on the wire ourselves.
//
// The auth flow in src/lib/auth.ts is unchanged: signInWithOtp() still asks
// Supabase to generate + expire + rate-limit the 6-digit code, and verifyOtp()
// still validates it. This function only owns *delivery*.
//
// Delivery path: Resend's HTTP API when RESEND_API_KEY is set, otherwise Gmail
// SMTP (smtp.gmail.com:465) with a Gmail App Password. Both live in code we
// control; the transport is chosen at runtime so the SMTP path keeps working
// until the Resend secrets are in place, and no send is ever lost to a
// half-finished migration.
//
// Prefer Resend. SMTP is the reason this function times out (see below) and the
// reason @cit.edu can quarantine us — mail sent from a @gmail.com envelope has
// no sending domain of ours behind it to authenticate.
//
// Secrets required (supabase secrets set ...):
//   SEND_EMAIL_HOOK_SECRET — the hook signing secret Supabase shows when you
//                            create the Send Email hook (format: "v1,whsec_...")
//   GMAIL_APP_PASSWORD     — 16-char Google App Password (SMTP path only)
// Optional (have sensible defaults):
//   RESEND_API_KEY         — enables the HTTP path; requires EMAIL_FROM
//   EMAIL_FROM             — full From header on the Resend path, e.g.
//                            "InternConnect <noreply@yourdomain>". The domain
//                            must be verified in Resend or the API rejects it.
//   GMAIL_USER             — sender mailbox (default internconnect000@gmail.com)
//   EMAIL_FROM_NAME        — display name on the From header (default InternConnect)
//
// This function must be deployed with JWT verification DISABLED — it is called
// by Supabase's auth server (authenticated by the hook signature above), not by
// a logged-in user:  supabase functions deploy send-email-hook --no-verify-jwt
//
// Timeout note: Supabase auth hooks have a hard, non-configurable 5s timeout,
// and a full Gmail SMTP session (connect → TLS → AUTH → send → close) uses most
// of it. This function AWAITS the send.
//
// Do NOT move delivery back into EdgeRuntime.waitUntil() to buy headroom. That
// was tried, and it silently dropped every outgoing code: the hook returned 200
// in ~96ms and the isolate was torn down long before the ~4.9s SMTP session
// finished. Nothing reached any inbox, and because the teardown also killed the
// catch block, nothing appeared in the logs either — the failure was invisible
// from both the auth flow and the dashboard. Awaiting costs latency but keeps
// delivery failures reportable, which is the only reason this is debuggable.
//
// On SMTP the headroom is not merely tight, it is regularly blown: warm sends
// measured 3.45-3.84s against the 5s budget, and cold starts measured 5.12s and
// 5.14s — those two requests died with error_code "hook_timeout" and the student
// got nothing. That is a quarter of all signup attempts in one day's auth log.
// Nothing in this file can shrink an SMTP session enough to make that safe.
// The Resend path settles in one fetch (~200-400ms), which is what actually
// removes the timeout rather than narrowing it.
//
// Every send logs its transport and elapsed ms, so the next person to ask "did
// the code go out?" can answer it from the function logs alone.
//
// Recipients: the account's institutional address, and nothing else. Codes are
// no longer CC'd to a personal inbox — signup does not ask for one — so
// receiving a code proves control of the institutional mailbox.
//
// Watch @cit.edu delivery. Gmail accepts the message, cit.edu accepts it from
// Gmail, and it has been quarantined on the far side with no bounce: the hook
// returns 200, the auth log says "Hook ran successfully", and the student still
// has an empty inbox. Nothing here can detect that — a 200 from this function
// means "handed off", never "delivered". Moving to Resend on a domain we own and
// have verified (SPF + DKIM signed as us) is the fix for that too; an
// institutional allowlist for our sender is the fallback if it persists.

import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const GMAIL_USER = Deno.env.get('GMAIL_USER') ?? 'internconnect000@gmail.com'
const FROM_NAME = Deno.env.get('EMAIL_FROM_NAME') ?? 'InternConnect'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const EMAIL_FROM = Deno.env.get('EMAIL_FROM')

type EmailData = {
  token: string
  token_hash: string
  email_action_type: string
  redirect_to: string
  site_url: string
}

type HookPayload = {
  user: {
    id: string
    email: string
  }
  email_data: EmailData
}

/**
 * Subject + body copy per auth action.
 *
 * Deliverability note — this copy is shaped to get past institutional filters
 * (@cit.edu quarantines mail that reads like a generic credential phish):
 *   - The subject leads with the code. Real transactional senders do this, and
 *     it stops the subject from being the bare "Your verification code" string
 *     that bulk phishing templates share.
 *   - `what` says which action on which service produced the mail, so the body
 *     is not just a naked number under a stock sentence. Sparse HTML with one
 *     large number and no context is itself a strong spam signal.
 *   - No links, no images, no tracking pixel, no "click here", no countdown
 *     urgency. Each of those is scored against us and none are needed for OTP.
 */
function copyFor(action: string): { subject: (t: string) => string; intro: string; what: string } {
  switch (action) {
    case 'recovery':
      return {
        subject: (t) => `${t} is your InternConnect password reset code`,
        intro: 'Use this code to reset your password:',
        what: 'a password reset was requested for the InternConnect account on this address',
      }
    case 'email_change':
      return {
        subject: (t) => `${t} is your InternConnect email confirmation code`,
        intro: 'Use this code to confirm your new email address:',
        what: 'this address was set as the new contact email for an InternConnect account',
      }
    case 'magiclink':
    case 'login':
      return {
        subject: (t) => `${t} is your InternConnect sign-in code`,
        intro: 'Use this code to sign in:',
        what: 'a sign-in to InternConnect was requested with this address',
      }
    default: // 'signup' and anything else
      return {
        subject: (t) => `${t} is your InternConnect verification code`,
        intro: 'Enter this code to verify your email and continue:',
        what: 'this address was used to start an InternConnect account registration',
      }
  }
}

function emailHtml(intro: string, what: string, token: string, to: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">
    <h2 style="margin:0 0 8px;color:#5b3a29">InternConnect</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">${intro}</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;
                background:#f5f0eb;border:1px solid #e5ded5;border-radius:12px;
                padding:18px 0;color:#3f2a1d">${token}</div>
    <p style="margin:20px 0 0;font-size:13px;color:#6b7280">
      The code is good for 5 minutes. Type it into the page you already have open —
      InternConnect will never ask you to send it back by email or give it to
      anyone over the phone.
    </p>
    <p style="margin:12px 0 0;font-size:13px;color:#6b7280">
      You are getting this message because ${what} (${to}). If that wasn't you,
      no account action has been taken and you can ignore this email.
    </p>
    <p style="margin:20px 0 0;padding-top:14px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af">
      InternConnect — internship listings and applications for Cebu Institute of
      Technology – University students and partner companies. This is an automated
      message sent from ${GMAIL_USER}; replies reach the InternConnect team.
    </p>
  </div>`
}

function emailText(intro: string, what: string, token: string, to: string): string {
  // Kept substantive and close in wording to the HTML part. A near-empty
  // text/plain alternative next to a styled HTML part is a spam heuristic.
  return [
    'InternConnect',
    '',
    intro,
    '',
    `    ${token}`,
    '',
    'The code is good for 5 minutes. Type it into the page you already have open.',
    'InternConnect will never ask you to send this code back by email or give it',
    'to anyone over the phone.',
    '',
    `You are getting this message because ${what} (${to}). If that wasn't you, no`,
    'account action has been taken and you can ignore this email.',
    '',
    'InternConnect - internship listings and applications for Cebu Institute of',
    'Technology - University students and partner companies. This is an automated',
    `message sent from ${GMAIL_USER}; replies reach the InternConnect team.`,
  ].join('\n')
}

/**
 * Resend's HTTP API: one fetch, no handshake, no AUTH round trip. This is the
 * path that fits inside the hook's 5s budget with room to spare.
 *
 * `from` has to be an address on a domain verified in the Resend dashboard —
 * Resend rejects anything else outright, which is exactly the property that
 * makes the mail authenticate as us at the receiving end.
 */
async function sendViaResend(
  to: string[],
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      reply_to: EMAIL_FROM,
      subject,
      html,
      text,
      headers: {
        // Same rationale as the SMTP path below.
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'X-Entity-Ref-ID': crypto.randomUUID(),
      },
    }),
  })

  if (!res.ok) {
    // Surface Resend's own message — it names the actual problem (unverified
    // domain, bad key, invalid recipient) instead of a bare status code.
    const detail = await res.text().catch(() => '')
    throw new Error(`Resend rejected the send (${res.status}): ${detail.slice(0, 300)}`)
  }
}

/** One message, one SMTP session. `to` is a list, but today it is always the
 * account's institutional address alone — see the delivery note at the top. */
async function sendViaSmtp(
  to: string[],
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  const appPassword = Deno.env.get('GMAIL_APP_PASSWORD')
  if (!appPassword) throw new Error('GMAIL_APP_PASSWORD is not configured')

  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: appPassword },
    },
  })

  try {
    await client.send({
      from: `${FROM_NAME} <${GMAIL_USER}>`,
      to,
      // A reachable Reply-To on a transactional message is a legitimacy signal;
      // phishing runs usually have no working reply path.
      replyTo: `${FROM_NAME} <${GMAIL_USER}>`,
      subject,
      content: text, // plain-text fallback for clients that ignore HTML
      html,
      headers: {
        // RFC 3834: identifies this as machine-generated so filters and
        // out-of-office responders classify it as transactional, not bulk.
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        // Unique per message so Gmail/Outlook never collapse successive codes
        // into one thread and hide the newest one behind "show trimmed content".
        'X-Entity-Ref-ID': crypto.randomUUID(),
      },
    })
  } finally {
    await client.close()
  }
}

/**
 * Pick a transport and send. Resend wins when it is fully configured; anything
 * short of that falls back to SMTP rather than failing, so a half-applied
 * migration degrades to the old slow path instead of dropping codes.
 *
 * The elapsed-ms log line is the only record of how close a send ran to the 5s
 * hook ceiling — keep it.
 */
async function sendEmail(
  to: string[],
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  const useResend = Boolean(RESEND_API_KEY && EMAIL_FROM)
  if (RESEND_API_KEY && !EMAIL_FROM) {
    console.error('RESEND_API_KEY is set but EMAIL_FROM is not — falling back to SMTP')
  }

  const startedAt = Date.now()
  try {
    if (useResend) {
      await sendViaResend(to, subject, html, text)
    } else {
      await sendViaSmtp(to, subject, html, text)
    }
  } finally {
    console.log(
      JSON.stringify({
        msg: 'send-email-hook delivery attempt',
        transport: useResend ? 'resend' : 'smtp',
        elapsed_ms: Date.now() - startedAt,
      }),
    )
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { http_code: 405, message: 'Method not allowed' } }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  if (!hookSecret) {
    console.error('SEND_EMAIL_HOOK_SECRET is not configured')
    return new Response(JSON.stringify({ error: { http_code: 500, message: 'Hook not configured' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 1. Verify the request really came from Supabase Auth (Standard Webhooks
  //    signature). The raw body must be read as text for the signature to check.
  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  let user: HookPayload['user']
  let email_data: HookPayload['email_data']
  try {
    const wh = new Webhook(hookSecret.replace('v1,whsec_', ''))
    const verified = wh.verify(payload, headers) as HookPayload
    user = verified.user
    email_data = verified.email_data
  } catch (err) {
    console.error('Signature verification failed', err)
    return new Response(JSON.stringify({ error: { http_code: 401, message: 'Invalid signature' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. Deliver the code Supabase generated via Gmail SMTP, to the account's
  //    institutional address and nowhere else — that is the address the code
  //    belongs to, and receiving it is what proves control of the mailbox.
  const { subject, intro, what } = copyFor(email_data.email_action_type)
  const token = email_data.token
  const to = user.email
  // Awaited deliberately — see the timeout note at the top of this file before
  // changing this to a background send.
  try {
    await sendEmail(
      [to],
      subject(token),
      emailHtml(intro, what, token, to),
      emailText(intro, what, token, to),
    )
  } catch (err) {
    console.error('Email delivery failed', err)
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: `Delivery failed: ${err instanceof Error ? err.message : String(err)}` } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 3. 200 = success (Supabase Send Email hook contract), reached only once the
  //    send above has settled. GoTrue reads the response and requires a
  //    Content-Type header, so we return an empty JSON object rather than a
  //    null body — a bare 200 trips
  //    "Invalid Content-Type: Missing Content-Type header".
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
