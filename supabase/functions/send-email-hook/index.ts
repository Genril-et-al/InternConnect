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
// Delivery is Brevo, by one of two transports — the first whose secrets exist:
//
//   1. brevo-api   BREVO_API_KEY                      — one POST, ~200-400ms
//   2. brevo-smtp  BREVO_SMTP_USER + BREVO_SMTP_KEY   — smtp-relay.brevo.com
//
// If neither is configured the function raises rather than sending. There is no
// fallback provider on purpose. A Gmail fallback used to sit underneath these,
// and it hid a live misconfiguration for days: the Gmail OAuth secrets were never
// actually set in production, so every send quietly took the slow SMTP path while
// the deploy log and the commit message both said otherwise. Nobody could tell,
// because a silent downgrade looks exactly like success. A loud failure is worth
// more than a fallback that lies.
//
// Prefer the API over SMTP. SMTP is the reason this function times out: a session
// is connect → TLS → AUTH → send → close, five round trips before the provider
// has the message, measured at 2.9-5.1s against a hard 5s ceiling. An API send is
// one POST because the credential rides in a header. "Brevo SMTP" and "Brevo API"
// are the same service reached two ways; only one fits the budget comfortably.
//
// Secrets (supabase secrets set ...). Required:
//   SEND_EMAIL_HOOK_SECRET — the hook signing secret Supabase shows when you
//                            create the Send Email hook (format: "v1,whsec_...")
// Brevo — BREVO_API_KEY alone is enough, and is the recommended setup:
//   BREVO_API_KEY          — a v3 API key from Brevo → SMTP & API → **API Keys**.
//                            Starts "xkeysib-". This is NOT the SMTP key, and
//                            pasting the SMTP key here fails with
//                            401 {"message":"Key not found"}.
//   BREVO_SMTP_USER        — SMTP login from Brevo → SMTP & API → **SMTP**. Looks
//                            like b30c3b001@smtp-brevo.com — an opaque generated
//                            id, NOT the sender address, and worth copying rather
//                            than retyping: a transposed character here fails with
//                            535 5.7.8 Authentication failed, which reads like a
//                            bad password and costs hours to find.
//   BREVO_SMTP_KEY         — the SMTP key for that login (starts "xsmtpsib-")
//   BREVO_SMTP_HOST/_PORT  — optional (default smtp-relay.brevo.com:465). Brevo's
//                            dashboard advertises 587; 465 also works and is one
//                            round trip cheaper, so it is the default here.
// Optional (have sensible defaults):
//   EMAIL_FROM             — sender address on the From header. MUST be a sender
//                            Brevo has verified, or Brevo rejects the send with
//                            400 "sender not valid".
//   EMAIL_FROM_NAME        — display name on the From header (default InternConnect)
//
// Note on deliverability: Brevo is a dedicated transactional sender with its own
// warmed IP pool and DKIM, which is a better reputation than a plain @gmail.com
// mailbox — but only if EMAIL_FROM is an address whose domain is authenticated in
// Brevo. Sending "from" a @gmail.com address through Brevo means the DKIM
// signature belongs to brevo, not gmail.com, and gmail.com's own DMARC policy
// then applies to a message Google did not send. Verify a domain we control in
// Brevo and point EMAIL_FROM at it; until then, expect the @cit.edu quarantine
// risk to be no better than it was, and possibly worse.
//
// If Brevo was also configured as Custom SMTP in the Supabase dashboard, that
// setting is now dead weight: an enabled Send Email hook takes delivery over
// completely and the dashboard's SMTP settings and templates are never used.
// Configuring it there is harmless, but it is this file that does the sending.
//
// This function must be deployed with JWT verification DISABLED — it is called
// by Supabase's auth server (authenticated by the hook signature above), not by
// a logged-in user:  supabase functions deploy send-email-hook --no-verify-jwt
//
// Timeout note: Supabase auth hooks have a hard, non-configurable 5s timeout,
// and a full SMTP session (connect → TLS → AUTH → send → close) uses most of it
// against any provider. This function AWAITS the send.
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
// Nothing in this file can shrink an SMTP session enough to make that safe, and
// nothing about it was specific to Google — Brevo's relay inherits the same
// problem. An API send settles in one POST (~300ms), which is what actually
// removes the timeout rather than narrowing it. That is the whole reason
// BREVO_API_KEY outranks the SMTP credentials.
//
// Production currently runs brevo-smtp, so that timeout risk is still live.
// Setting BREVO_API_KEY is the fix and needs no code change.
//
// Every send logs its transport and elapsed ms, so the next person to ask "did
// the code go out?" can answer it from the function logs alone.
//
// Recipients: the account's institutional address, and nothing else. Codes are
// no longer CC'd to a personal inbox — signup does not ask for one — so
// receiving a code proves control of the institutional mailbox.
//
// A 200 from this function means "handed off", never "delivered" — it cannot see
// what a recipient's mail server does afterwards. Brevo → Transactional → Logs
// can: it reports delivered/blocked/bounced per message. Check there, not here,
// when a student says no code arrived.
//
// @cit.edu delivery works. It was quarantining our Gmail-sent mail earlier (which
// is why migration 0013 briefly moved codes to personal addresses), but a later
// round of "cit.edu is eating our mail" turned out to be a mistyped
// BREVO_SMTP_USER — the mail never left. Confirm with Brevo's log before assuming
// a filtering problem; the expensive failures here have all been credential typos
// wearing a deliverability costume.
//
// If a genuine quarantine does return, the lever is a domain we control,
// authenticated in Brevo (SPF + DKIM + DMARC), set as EMAIL_FROM. A @gmail.com
// EMAIL_FROM sent through Brevo is signed by Brevo's DKIM and fails DMARC
// alignment for gmail.com, which is worse than not switching at all.

import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
const BREVO_SMTP_USER = Deno.env.get('BREVO_SMTP_USER')
const BREVO_SMTP_KEY = Deno.env.get('BREVO_SMTP_KEY')
const BREVO_SMTP_HOST = Deno.env.get('BREVO_SMTP_HOST') ?? 'smtp-relay.brevo.com'
const BREVO_SMTP_PORT = Number(Deno.env.get('BREVO_SMTP_PORT') ?? '465')

/**
 * The address on the From header, and the one quoted in the footer so a student
 * can see who mailed them. Must be a sender Brevo has verified — the default is
 * only a sensible starting point, not a guarantee Brevo will accept it.
 */
const FROM_EMAIL = Deno.env.get('EMAIL_FROM') ?? 'internconnect000@gmail.com'
const FROM_NAME = Deno.env.get('EMAIL_FROM_NAME') ?? 'InternConnect'

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
      message sent from ${FROM_EMAIL}; replies reach the InternConnect team.
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
    `message sent from ${FROM_EMAIL}; replies reach the InternConnect team.`,
  ].join('\n')
}

/**
 * Brevo's transactional API: one POST, credential in the `api-key` header, no
 * handshake. This is the preferred transport — it is the only Brevo path that
 * reliably fits inside the hook's 5s budget.
 *
 * Brevo will reject the send with 400 if `sender.email` is not a sender it has
 * verified, so FROM_EMAIL and the Brevo account have to agree. That error is
 * surfaced verbatim below because "sender not valid" is the single most likely
 * first-run failure and guessing at it from a status code wastes an afternoon.
 */
async function sendViaBrevoApi(
  to: string[],
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY!,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: to.map((email) => ({ email })),
      replyTo: { name: FROM_NAME, email: FROM_EMAIL },
      subject,
      // Brevo builds the multipart/alternative itself and orders the parts
      // correctly, so clients still render the HTML and fall back to the text.
      textContent: text,
      htmlContent: html,
      // Same headers, and the same reasons, as the SMTP path below.
      headers: {
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'X-Entity-Ref-ID': crypto.randomUUID(),
      },
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Brevo API rejected the send (${res.status}): ${detail.slice(0, 300)}`)
  }
}

/**
 * Brevo's SMTP relay, and what production runs today. Kept because Brevo hands
 * out SMTP credentials by default and you have those before you have an API key
 * — but it pays the five round trips described at the top of this file, so treat
 * it as a stopgap and move to BREVO_API_KEY.
 *
 * `to` is a list, but today it is always the account's institutional address
 * alone — see the recipients note at the top.
 */
async function sendViaBrevoSmtp(
  to: string[],
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  const client = new SMTPClient({
    connection: {
      hostname: BREVO_SMTP_HOST,
      port: BREVO_SMTP_PORT,
      // 465 is implicit TLS; 587 starts plain and upgrades via STARTTLS, which
      // denomailer negotiates on its own. Anything else is the caller's problem.
      tls: BREVO_SMTP_PORT === 465,
      auth: { username: BREVO_SMTP_USER!, password: BREVO_SMTP_KEY! },
    },
  })

  try {
    await client.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      replyTo: `${FROM_NAME} <${FROM_EMAIL}>`,
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

type Transport = 'brevo-api' | 'brevo-smtp'

/**
 * Decide which transport this isolate can use, best first, and throw if neither
 * is configured.
 *
 * Throwing is the point. This used to fall through to a Gmail transport, which
 * meant a missing or misspelled Brevo secret produced a working-looking send over
 * the wrong provider — invisible in the auth log, invisible in Brevo's log, and
 * only discoverable by reading this function's own output. Refusing to send is
 * louder and cheaper to diagnose than silently sending the slow way.
 */
function pickTransport(): Transport {
  if (BREVO_API_KEY) return 'brevo-api'
  if (BREVO_SMTP_USER && BREVO_SMTP_KEY) return 'brevo-smtp'

  // Name the half-configured case explicitly — it is almost always one typo'd
  // secret name, and "no transport" alone would not point at which.
  if (BREVO_SMTP_USER || BREVO_SMTP_KEY) {
    throw new Error(
      'Brevo SMTP is half-configured: BREVO_SMTP_USER and BREVO_SMTP_KEY must both be set',
    )
  }
  throw new Error(
    'No email transport configured — set BREVO_API_KEY, or both BREVO_SMTP_USER and BREVO_SMTP_KEY',
  )
}

/**
 * Pick a transport and send.
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
  // Throws when nothing is configured, before the timer starts — that failure is
  // a config error, not a delivery attempt, and does not belong in the timing log.
  const transport = pickTransport()

  const startedAt = Date.now()
  try {
    if (transport === 'brevo-api') {
      await sendViaBrevoApi(to, subject, html, text)
    } else {
      await sendViaBrevoSmtp(to, subject, html, text)
    }
  } finally {
    console.log(
      JSON.stringify({
        msg: 'send-email-hook delivery attempt',
        transport,
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

  // 2. Deliver the code Supabase generated over whichever transport is
  //    configured (Brevo first — see sendEmail), to the account's institutional
  //    address and nowhere else — that is the address the code belongs to, and
  //    receiving it is what proves control of the mailbox.
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
