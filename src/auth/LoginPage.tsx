import { useState } from 'react'
import {
  isUniversityEmail,
  login,
  requestSignupCode,
  setPassword,
  verifySignupCode,
} from '../lib/auth'
import { isSupabaseConfigured } from '../lib/supabase'
import { DEMO_STUDENT } from '../lib/demo'
import { useAuth } from './context'
import './auth.css'

type Mode = 'login' | 'signup'
type SignupStep = 'details' | 'verify' | 'password'

const MAX_CODE_ATTEMPTS = 3 // UC-S01 alt flow 4a: limited attempts.

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message)
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
          <span className="auth-logo">IC</span>
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
      <label>
        Password
        <input
          autoComplete="current-password"
          onChange={(e) => setPasswordValue(e.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button className="auth-primary" disabled={busy} type="submit">
        {busy ? 'Signing in…' : 'Log In'}
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
  const [step, setStep] = useState<SignupStep>('details')
  const [firstName, setFirstName] = useState('')
  const [middleInitial, setMiddleInitial] = useState('')
  const [lastName, setLastName] = useState('')
  const [suffix, setSuffix] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [address, setAddress] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [password, setPasswordValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleRequestCode(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setInfo('')

    if (!isUniversityEmail(email)) {
      // Client-side hint; the server enforces this too (UC-S01 alt 3a).
      setError('Students must register with a university @cit.edu email address.')
      return
    }

    setBusy(true)
    try {
      await requestSignupCode(email, {
        firstName,
        middleInitial,
        lastName,
        suffix,
        age,
        gender,
        address,
        personalEmail,
        contactNumber,
      })
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
      await requestSignupCode(email, {
        firstName,
        middleInitial,
        lastName,
        suffix,
        age,
        gender,
        address,
        personalEmail,
        contactNumber,
      })
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

  if (step === 'verify') {
    return (
      <form className="auth-form" onSubmit={handleVerify}>
        <p className="auth-step">Step 2 of 3 · Verify email</p>
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
        <p className="auth-step">Step 3 of 3 · Create password</p>
        <label>
          Password
          <input
            autoComplete="new-password"
            onChange={(e) => setPasswordValue(e.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <label>
          Confirm password
          <input
            autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)}
            required
            type="password"
            value={confirm}
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-primary" disabled={busy} type="submit">
          {busy ? 'Saving…' : 'Create account'}
        </button>
      </form>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleRequestCode}>
      <p className="auth-step">Step 1 of 3 · Your details</p>
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
      <div className="auth-details-grid">
        <label>
          Age
          <input
            inputMode="numeric"
            min={0}
            onChange={(e) => setAge(e.target.value)}
            type="number"
            value={age}
          />
        </label>
        <label>
          Gender
          <input
            onChange={(e) => setGender(e.target.value)}
            placeholder="e.g. Male, Female, Non-binary"
            value={gender}
          />
        </label>
      </div>
      <label>
        Address
        <input
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street, City, Province"
          value={address}
        />
      </label>
      <div className="auth-details-grid">
        <label>
          Personal email address
          <input
            onChange={(e) => setPersonalEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            value={personalEmail}
          />
        </label>
        <label>
          Contact number
          <input
            onChange={(e) => setContactNumber(e.target.value)}
            placeholder="09XX XXX XXXX"
            type="tel"
            value={contactNumber}
          />
        </label>
      </div>
      <label>
        University email
        <input
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="firstname.lastname@cit.edu"
          required
          type="email"
          value={email}
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button className="auth-primary" disabled={busy} type="submit">
        {busy ? 'Sending code…' : 'Send verification code'}
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
