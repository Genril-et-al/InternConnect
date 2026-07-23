import { useState } from 'react'
import { setPassword } from '../lib/auth'
import { useAuth } from './context'
import { PasswordField } from './PasswordField'
import './auth.css'

/**
 * Shown after a recovery code from the password-reset email is verified. That
 * verification already opened an authenticated session, so this just sets a new
 * password on it — the old password is never needed.
 */
export function ResetPasswordPage() {
  const { endRecovery, refreshProfile, signOut } = useAuth()
  const [password, setPasswordValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match. Please re-enter.')
      return
    }
    setBusy(true)
    try {
      await setPassword(password)
      // Leaving recovery mode drops the user into the workspace on the
      // session the link already established — no second login needed.
      endRecovery()
      await refreshProfile()
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message ?? '')
          : ''
      setError(msg || 'Could not update your password. Please try again.')
    } finally {
      setBusy(false)
    }
  }

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
        <h1>Set a new password.</h1>
        <p className="auth-hero-sub">
          Choose a new password for your account. You'll use it the next time
          you log in.
        </p>
      </section>

      <section className="auth-card">
        <div className="auth-card-head">
          <h2>New password</h2>
          <p>Your recovery code is verified — just pick a new password.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <PasswordField
            autoComplete="new-password"
            autoFocus
            label="New password"
            onChange={setPasswordValue}
            onToggle={() => setVisible((v) => !v)}
            value={password}
            visible={visible}
            showStrengthIndicator
          />
          <PasswordField
            autoComplete="new-password"
            label="Confirm new password"
            onChange={setConfirm}
            onToggle={() => setVisible((v) => !v)}
            value={confirm}
            visible={visible}
          />
          {confirm && password !== confirm && (
            <p className="auth-hint auth-hint-left auth-hint-warn">Passwords do not match yet.</p>
          )}
          <p className="auth-hint auth-hint-left">
            At least 8 characters. Use the eye icon to show or hide both fields.
          </p>
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-primary" disabled={busy} type="submit">
            {busy ? 'Saving…' : 'Update password'}
          </button>
          <button
            className="auth-link"
            disabled={busy}
            onClick={() => {
              // Cancelling must end the recovery session too, otherwise the
              // link's session would silently log them in.
              void signOut()
            }}
            type="button"
          >
            Cancel and return to login
          </button>
        </form>
      </section>
    </div>
  )
}
