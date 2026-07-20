import { useState } from 'react'
import { Building2, GraduationCap } from 'lucide-react'
import {
  checkSignupEligibility,
  login,
  requestPasswordReset,
  requestSignupCode,
  setPassword,
  verifyPasswordResetCode,
  verifySignupCode,
} from '../lib/auth'
import { HeroCarousel, hasHeroSlides } from './HeroCarousel'
import { PasswordField } from './PasswordField'
import { isSupabaseConfigured } from '../lib/supabase'
import { DEMO_ADMIN, DEMO_COMPANY, DEMO_STUDENT } from '../lib/demo'
import { useAuth } from './context'
import './auth.css'

type Mode = 'login' | 'signup'
// 'personal' is student-only: @cit.edu quarantines our mail, so students name a
// personal inbox to receive the code (migration 0013). Companies skip it and
// are verified at their work email as before.
type SignupStep = 'role' | 'details' | 'personal' | 'verify' | 'password'
type AccountType = 'student' | 'company'

const MAX_CODE_ATTEMPTS = 3 // UC-S01 alt flow 4a: limited attempts.

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message ?? '').trim()
    // supabase-js wraps a 500 as AuthRetryableFetchError with message "{}" and
    // drops the server text — don't surface that noise to the user.
    if (msg && msg !== '{}') return msg
  }
  return 'Something went wrong. Please try again.'
}


export function LoginPage() {
  const { refreshProfile, enterDemo } = useAuth()
  const [mode, setMode] = useState<Mode>('login')

  return (
    <div className="auth-shell">
      <section className={`auth-hero${hasHeroSlides ? ' has-carousel' : ''}`}>
        <div className="auth-brand">
          <img className="auth-logo" src="/logo.png" alt="InternConnect" />
          <div>
            <div className="auth-brand-name">InternConnect</div>
            <div className="auth-brand-sub">Where Skills Meet Opportunity</div>
          </div>
        </div>
        {/* The carousel is the panel's centrepiece once slides exist. Until
            then it renders nothing, so the original headline stays rather than
            leaving a hole — drop images in ./slides to switch over. */}
        {hasHeroSlides ? (
          <HeroCarousel />
        ) : (
          <h1>Find Your Perfect Internship.</h1>
        )}
        <p className="auth-hero-sub">
          Explore verified opportunities, apply with ease, and track your internship journey—all in one platform designed for students and the industry.
        </p>
      </section>

      <section className="auth-card">
        <div className="auth-card-head">
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p>
            {mode === 'login'
              ? 'Log in to continue to your InternConnect workspace.'
              : 'Register with your university email to get started.'}
          </p>
        </div>

        {!isSupabaseConfigured && (
          <p className="auth-info">
            Demo preview — Supabase isn't connected yet, so login won't
            authenticate. Add your keys to <code>.env.local</code> (see
            docs/SUPABASE_SETUP.md).
          </p>
        )}

        <div className="auth-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
            type="button"
          >
            Log In
          </button>
          <button
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => setMode('signup')}
            type="button"
          >
            Sign Up
          </button>
        </div>

        {mode === 'login' ? (
          <LoginForm onAuthenticated={refreshProfile} />
        ) : (
          <SignupFlow onAuthenticated={refreshProfile} onSwitchToLogin={() => setMode('login')} />
        )}

        {!isSupabaseConfigured && (
          <div className="auth-demo">
            <span className="auth-demo-divider">Demo access (no Supabase)</span>
            <button
              className="auth-demo-btn"
              onClick={() => enterDemo(DEMO_STUDENT)}
              type="button"
            >
              Continue as {DEMO_STUDENT.full_name} · Student
            </button>
            <button
              className="auth-demo-btn"
              onClick={() => enterDemo(DEMO_COMPANY)}
              type="button"
            >
              Continue as {DEMO_COMPANY.full_name} · Company
            </button>
            <button
              className="auth-demo-btn"
              onClick={() => enterDemo(DEMO_ADMIN)}
              type="button"
            >
              Continue as {DEMO_ADMIN.full_name} · NLO Admin
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function LoginForm({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPasswordValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [forgot, setForgot] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      await onAuthenticated()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (forgot) {
    return <ForgotPasswordForm initialEmail={email} onBack={() => setForgot(false)} />
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Email
        <input
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="firstname.lastname@cit.edu"
          required
          type="email"
          value={email}
        />
      </label>
      <PasswordField
        autoComplete="current-password"
        label="Password"
        onChange={setPasswordValue}
        onToggle={() => setShowPassword((v) => !v)}
        value={password}
        visible={showPassword}
      />
      {error && <p className="auth-error">{error}</p>}
      <button className="auth-primary" disabled={busy} type="submit">
        {busy ? 'Signing in…' : 'Log In'}
      </button>
      <button
        className="auth-link"
        disabled={busy}
        onClick={() => {
          setError('')
          setForgot(true)
        }}
        type="button"
      >
        Forgot password?
      </button>
    </form>
  )
}

/**
 * Requests a recovery email. Deliberately reports success even for unknown
 * addresses so the form can't be used to discover registered emails.
 */
function ForgotPasswordForm({
  initialEmail,
  onBack,
}: {
  initialEmail: string
  onBack: () => void
}) {
  const { beginRecovery } = useAuth()
  const [email, setEmail] = useState(initialEmail)
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await verifyPasswordResetCode(email, code)
      // The code opened a real session. Flag recovery BEFORE it propagates, so
      // App routes to ResetPasswordPage instead of the workspace.
      beginRecovery()
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'That code is not valid.'
      // Supabase returns the same error for a wrong code and an expired one,
      // and without terminating punctuation — add it so the two sentences
      // don't run together ("...is invalid Check the code").
      setError(`${msg.replace(/\s*\.?\s*$/, '')}. Check the code, or request a new one.`)
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <form className="auth-form" onSubmit={handleVerify}>
        <p className="auth-info">
          If an account exists for <strong>{email.trim().toLowerCase()}</strong>, we've
          sent a 6-digit recovery code to the personal email on that account.
          Check it (and the spam folder), then enter the code below.
        </p>
        <label>
          Recovery code
          <input
            autoComplete="one-time-code"
            autoFocus
            inputMode="numeric"
            maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            required
            value={code}
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-primary" disabled={busy || code.length < 6} type="submit">
          {busy ? 'Verifying…' : 'Verify code'}
        </button>
        <button
          className="auth-link"
          disabled={busy}
          onClick={() => {
            setSent(false)
            setCode('')
            setError(null)
          }}
          type="button"
        >
          Use a different email or resend
        </button>
        <button className="auth-link" disabled={busy} onClick={onBack} type="button">
          Back to login
        </button>
      </form>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <p className="auth-step">Reset your password</p>
      <p className="auth-hint auth-hint-left">
        Enter your university email. We'll send a code to the personal email on
        your account. You won't need your old password.
      </p>
      <label>
        University email
        <input
          autoComplete="email"
          autoFocus
          onChange={(e) => setEmail(e.target.value)}
          placeholder="firstname.lastname@cit.edu"
          required
          type="email"
          value={email}
        />
      </label>
      <button className="auth-primary" disabled={busy} type="submit">
        {busy ? 'Sending…' : 'Send recovery code'}
      </button>
      <button className="auth-link" disabled={busy} onClick={onBack} type="button">
        Back to login
      </button>
    </form>
  )
}

function SignupFlow({
  onAuthenticated,
  onSwitchToLogin,
}: {
  onAuthenticated: () => Promise<void>
  onSwitchToLogin: () => void
}) {
  const [step, setStep] = useState<SignupStep>('role')
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [firstName, setFirstName] = useState('')
  const [middleInitial, setMiddleInitial] = useState('')
  const [lastName, setLastName] = useState('')
  const [suffix, setSuffix] = useState('')
  const [email, setEmail] = useState('')
  // Where the code is actually mailed: the personal address for students, and
  // `email` itself for companies. Kept separate so verify/resend always target
  // the delivery inbox while `email` stays the roster identity.
  const [personalEmail, setPersonalEmail] = useState('')
  const [code, setCode] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [password, setPasswordValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const isStudent = accountType !== 'company'
  // Students gain a step: name the inbox that receives the code.
  const totalSteps = isStudent ? 5 : 4
  // Identity is always the rostered address; delivery may differ.
  const deliveryEmail = isStudent ? personalEmail : email

  const signupName = {
    firstName: accountType === 'company' ? '' : firstName,
    middleInitial: accountType === 'company' ? '' : middleInitial,
    lastName: accountType === 'company' ? '' : lastName,
    suffix: accountType === 'company' ? '' : suffix,
  }

  /**
   * Mail the code. For students the university address rides along as metadata
   * so handle_new_user can resolve the role from the roster (migration 0013);
   * for companies there is no split and the parameter is omitted.
   */
  async function sendCode() {
    await requestSignupCode(deliveryEmail, signupName, isStudent ? email : undefined)
  }

  async function handleRequestCode(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setInfo('')

    setBusy(true)
    try {
      // Ask the database whether this email is cleared to register before
      // sending a code, so non-rostered emails get a clear message (UC-S01).
      const role = await checkSignupEligibility(email)
      if (!role) {
        setError(
          "This email isn't cleared to register yet. Students must be pre-registered by the NLO, and companies must be NLO-approved. Ask the NLO to add your email, then try again.",
        )
        return
      }
      // The roster decides the real role — flag a mismatch instead of letting
      // the account silently register as the other account type.
      if (role !== accountType) {
        setError(
          `This email is registered with the NLO as ${
            role === 'student' ? 'a student' : 'a company'
          }, not as ${accountType === 'student' ? 'a student' : 'a company'}. Go back and pick the matching account type.`,
        )
        return
      }
      // The roster check above is the only thing gating a student here, so no
      // code is sent yet — they still have to name a delivery inbox.
      if (isStudent) {
        setStep('personal')
        return
      }
      await sendCode()
      setAttempts(0)
      setInfo(`We sent a 6-digit code to ${email}. It expires in 5 minutes.`)
      setStep('verify')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSendToPersonal(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setInfo('')
    const personal = personalEmail.trim().toLowerCase()
    // A @cit.edu address here would defeat the point — that inbox is exactly
    // the one that never receives our mail.
    if (personal.endsWith('@cit.edu')) {
      setError(
        'Please enter a personal email address, such as Gmail, Outlook, or Yahoo — not your university email.',
      )
      return
    }
    if (personal === email.trim().toLowerCase()) {
      setError('That is your university email. Enter a different, personal inbox.')
      return
    }
    setBusy(true)
    try {
      await sendCode()
      setAttempts(0)
      setInfo(`We sent a 6-digit code to ${personal}. It expires in 5 minutes.`)
      setStep('verify')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      // Verify against the DELIVERY address — that is the auth user's email.
      await verifySignupCode(deliveryEmail, code)
      setStep('password')
    } catch {
      const next = attempts + 1
      setAttempts(next)
      if (next >= MAX_CODE_ATTEMPTS) {
        setError('Too many incorrect attempts. Please request a new code.')
        // Send students back to the delivery step, not all the way to details:
        // their roster check already passed.
        setStep(isStudent ? 'personal' : 'details')
      } else {
        setError(`Incorrect or expired code. ${MAX_CODE_ATTEMPTS - next} attempt(s) left.`)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    setError('')
    setInfo('')
    setBusy(true)
    try {
      await sendCode()
      setAttempts(0)
      setCode('')
      setInfo(`A new code has been sent to ${deliveryEmail}.`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSetPassword(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      // UC-S01 alt flow 6a.
      setError('Passwords do not match. Please re-enter.')
      return
    }
    setBusy(true)
    try {
      await setPassword(password)
      await onAuthenticated()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (step === 'role') {
    return (
      <div className="auth-form">
        <p className="auth-step">Step 1 of {totalSteps} · Account type</p>
        <p className="auth-hint auth-hint-left">
          Who are you signing up as? This decides which workspace you land in.
        </p>
        <div className="auth-role-choices" role="radiogroup" aria-label="Account type">
          <button
            aria-checked={accountType === 'student'}
            className={`auth-role-card${accountType === 'student' ? ' selected' : ''}`}
            onClick={() => setAccountType('student')}
            role="radio"
            type="button"
          >
            <GraduationCap size={22} />
            <span className="auth-role-title">Student</span>
            <span className="auth-role-sub">Browse listings, apply, and track your placement.</span>
          </button>
          <button
            aria-checked={accountType === 'company'}
            className={`auth-role-card${accountType === 'company' ? ' selected' : ''}`}
            onClick={() => setAccountType('company')}
            role="radio"
            type="button"
          >
            <Building2 size={22} />
            <span className="auth-role-title">Company</span>
            <span className="auth-role-sub">Post internships and review applicants.</span>
          </button>
        </div>
        <button
          className="auth-primary"
          disabled={!accountType}
          onClick={() => setStep('details')}
          type="button"
        >
          Continue
        </button>
        <p className="auth-hint">
          Already have an account?{' '}
          <button className="auth-inline-link" onClick={onSwitchToLogin} type="button">
            Log in
          </button>
        </p>
      </div>
    )
  }

  if (step === 'personal') {
    return (
      <form className="auth-form" onSubmit={handleSendToPersonal}>
        <p className="auth-step">Step 3 of {totalSteps} · Where to send your code</p>
        <p className="auth-hint auth-hint-left">
          <strong>{email.trim().toLowerCase()}</strong> is on the NLO roster. Add a
          personal email you check regularly — Gmail, Outlook, or Yahoo — and
          we'll send your verification code there.
        </p>
        <label>
          Personal email
          <input
            autoComplete="email"
            autoFocus
            onChange={(e) => setPersonalEmail(e.target.value)}
            placeholder="yourname@gmail.com"
            required
            type="email"
            value={personalEmail}
          />
        </label>
        <p className="auth-hint auth-hint-left">
          You'll log in with this address from now on. Your university email stays
          on your profile.
        </p>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-primary" disabled={busy} type="submit">
          {busy ? 'Sending code…' : 'Send verification code'}
        </button>
        <button
          className="auth-link"
          disabled={busy}
          onClick={() => {
            setError('')
            setStep('details')
          }}
          type="button"
        >
          Back
        </button>
      </form>
    )
  }

  if (step === 'verify') {
    return (
      <form className="auth-form" onSubmit={handleVerify}>
        <p className="auth-step">
          Step {isStudent ? 4 : 3} of {totalSteps} · Verify email
        </p>
        <label>
          Verification code
          <input
            autoFocus
            inputMode="numeric"
            maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            required
            value={code}
          />
        </label>
        {info && <p className="auth-info">{info}</p>}
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-primary" disabled={busy} type="submit">
          {busy ? 'Verifying…' : 'Verify code'}
        </button>
        <button className="auth-link" disabled={busy} onClick={handleResend} type="button">
          Resend code
        </button>
      </form>
    )
  }

  if (step === 'password') {
    return (
      <form className="auth-form" onSubmit={handleSetPassword}>
        <p className="auth-step">
          Step {totalSteps} of {totalSteps} · Create password
        </p>
        <PasswordField
          autoComplete="new-password"
          label="Password"
          onChange={setPasswordValue}
          onToggle={() => setShowPassword((v) => !v)}
          value={password}
          visible={showPassword}
        />
        <PasswordField
          autoComplete="new-password"
          label="Confirm password"
          onChange={setConfirm}
          onToggle={() => setShowPassword((v) => !v)}
          value={confirm}
          visible={showPassword}
        />
        <p className="auth-hint auth-hint-left">
          At least 8 characters. Use the eye icon to show or hide both fields.
        </p>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-primary" disabled={busy} type="submit">
          {busy ? 'Saving…' : 'Create account'}
        </button>
      </form>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleRequestCode}>
      <p className="auth-step">
        Step 2 of {totalSteps} · Your details ·{' '}
        {accountType === 'company' ? 'Company account' : 'Student account'}
      </p>
      {accountType !== 'company' && (
        <div className="auth-name-grid">
          <label>
            First name
            <input
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Genril"
              required
              value={firstName}
            />
          </label>
          <label>
            M.I.
            <input
              maxLength={4}
              onChange={(e) => setMiddleInitial(e.target.value)}
              placeholder="T"
              value={middleInitial}
            />
          </label>
          <label>
            Last name
            <input
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Sorono"
              required
              value={lastName}
            />
          </label>
          <label>
            Suffix
            <input
              onChange={(e) => setSuffix(e.target.value)}
              placeholder="Jr., III, etc."
              value={suffix}
            />
          </label>
        </div>
      )}
      <label>
        {accountType === 'company' ? 'Work email' : 'University email'}
        <input
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder={
            accountType === 'company' ? 'you@company.com' : 'firstname.lastname@cit.edu'
          }
          required
          type="email"
          value={email}
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button className="auth-primary" disabled={busy} type="submit">
        {busy ? 'Checking…' : isStudent ? 'Continue' : 'Send verification code'}
      </button>
      <button
        className="auth-link"
        disabled={busy}
        onClick={() => {
          setError('')
          setStep('role')
        }}
        type="button"
      >
        Back to account type
      </button>
      <p className="auth-hint">
        Already have an account?{' '}
        <button className="auth-inline-link" onClick={onSwitchToLogin} type="button">
          Log in
        </button>
      </p>
    </form>
  )
}
