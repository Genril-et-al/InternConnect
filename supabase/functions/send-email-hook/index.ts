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
// Delivery path: Gmail SMTP (smtp.gmail.com:465) using a Gmail App Password.
// This is why the sending logic lives in code we control while still reaching
// real @cit.edu inboxes. To move off Gmail later, swap the sendEmail() body for
// a provider API (e.g. Resend) and drop the SMTP secrets.
//
// Secrets required (supabase secrets set ...):
//   SEND_EMAIL_HOOK_SECRET — the hook signing secret Supabase shows when you
//                            create the Send Email hook (format: "v1,whsec_...")
//   GMAIL_APP_PASSWORD     — 16-char Google App Password for the sender account
// Optional (have sensible defaults):
//   GMAIL_USER             — sender mailbox (default internconnect000@gmail.com)
//   EMAIL_FROM_NAME        — display name on the From header (default InternConnect)
//
// This function must be deployed with JWT verification DISABLED — it is called
// by Supabase's auth server (authenticated by the hook signature above), not by
// a logged-in user:  supabase functions deploy send-email-hook --no-verify-jwt

import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const GMAIL_USER = Deno.env.get('GMAIL_USER') ?? 'internconnect000@gmail.com'
const FROM_NAME = Deno.env.get('EMAIL_FROM_NAME') ?? 'InternConnect'

type EmailData = {
  token: string
  token_hash: string
  email_action_type: string
  redirect_to: string
  site_url: string
}

type HookPayload = {
  user: { email: string }
  email_data: EmailData
}

/** Subject + intro line per auth action. Signup is the primary path (UC-S01). */
function copyFor(action: string): { subject: string; intro: string } {
  switch (action) {
    case 'recovery':
      return {
        subject: 'Reset your InternConnect password',
        intro: 'Use this code to reset your password:',
      }
    case 'email_change':
      return {
        subject: 'Confirm your new InternConnect email',
        intro: 'Use this code to confirm your new email address:',
      }
    case 'magiclink':
    case 'login':
      return {
        subject: 'Your InternConnect sign-in code',
        intro: 'Use this code to sign in:',
      }
    default: // 'signup' and anything else
      return {
        subject: 'Your InternConnect verification code',
        intro: 'Enter this code to verify your email and continue:',
      }
  }
}

function emailHtml(intro: string, token: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">
    <h2 style="margin:0 0 8px;color:#5b3a29">InternConnect</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563">${intro}</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;
                background:#f5f0eb;border:1px solid #e5ded5;border-radius:12px;
                padding:18px 0;color:#3f2a1d">${token}</div>
    <p style="margin:20px 0 0;font-size:13px;color:#6b7280">
      This code expires in 5 minutes. If you didn't request it, you can safely ignore this email.
    </p>
  </div>`
}

async function sendEmail(
  to: string,
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
      subject,
      content: text, // plain-text fallback for clients that ignore HTML
      html,
    })
  } finally {
    await client.close()
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

  // 2. Deliver the code Supabase generated via Gmail SMTP.
  try {
    const { subject, intro } = copyFor(email_data.email_action_type)
    const text = `${intro}\n\n${email_data.token}\n\nThis code expires in 5 minutes.`
    await sendEmail(user.email, subject, emailHtml(intro, email_data.token), text)
  } catch (err) {
    console.error('Email delivery failed', err)
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: 'Could not send the verification email' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 3. Empty 200 = success (Supabase Send Email hook contract).
  return new Response(null, { status: 200 })
})
