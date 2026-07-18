import { useState } from 'react'
import { Building2, GraduationCap } from 'lucide-react'
import {
  checkSignupEligibility,
  login,
  requestPasswordReset,
  requestSignupCode,
  setPassword,
  verifySignupCode,
} from '../lib/auth'
import { PasswordField } from './PasswordField'
import { isSupabaseConfigured } from '../lib/supabase'
import { DEMO_ADMIN, DEMO_COMPANY, DEMO_STUDENT } from '../lib/demo'
import { useAuth } from './context'
import './auth.css'

type Mode = 'login' | 'signup'
type SignupStep = 'role' | 'details' | 'verify' | 'password'
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
      <section className="auth-hero">
        <div className="auth-brand">
          <img className="auth-logo" src="/logo.png" alt="InternConnect" />
          <div>
            <div className="auth-brand-name">InternConnect</div>
            <div className="auth-brand-sub">Internship Skill Matching System</div>
          </div>
        </div>
        <h1>Internship matching for students, companies, and coordinators.</h1>
        <p className="auth-hero-sub">
          Sign in with your university account to browse listings, apply, and
          track your placement — all in one workspace.
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
  const [email, setEmail] = useState(initialEmail)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

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

  if (sent) {
    return (
      <div className="auth-form">
        <p className="auth-info">
          If an account exists for <strong>{email.trim().toLowerCase()}</strong>, we've
          sent a password reset link. Check your inbox (and spam folder) — the
          link expires in 1 hour.
        </p>
        <button className="auth-primary" onClick={onBack} type="button">
          Back to login
        </button>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <p className="auth-step">Reset your password</p>
      <p className="auth-hint auth-hint-left">
        Enter your account email and we'll send you a link to set a new
        password. You won't need your old one.
      </p>
      <label>
        Email
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
        {busy ? 'Sending…' : 'Send reset link'}
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
  const [code, setCode] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [password, setPasswordValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
      await requestSignupCode(email, { firstName, middleInitial, lastName, suffix })
      setAttempts(0)
      setInfo(`We sent a 6-digit code to ${email}. It expires in 5 minutes.`)
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
      await verifySignupCode(email, code)
      setStep('password')
    } catch {
      const next = attempts + 1
      setAttempts(next)
      if (next >= MAX_CODE_ATTEMPTS) {
        setError('Too many incorrect attempts. Please request a new code.')
        setStep('details')
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
      await requestSignupCode(email, { firstName, middleInitial, lastName, suffix })
      setAttempts(0)
      setCode('')
      setInfo('A new code has been sent.')
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
        <p className="auth-step">Step 1 of 4 · Account type</p>
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

  if (step === 'verify') {
    return (
      <form className="auth-form" onSubmit={handleVerify}>
        <p className="auth-step">Step 3 of 4 · Verify email</p>
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
        <p className="auth-step">Step 4 of 4 · Create password</p>
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
        Step 2 of 4 · Your details ·{' '}
        {accountType === 'company' ? 'Company account' : 'Student account'}
      </p>
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
        {busy ? 'Sending code…' : 'Send verification code'}
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
