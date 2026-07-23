import { Eye, EyeOff } from 'lucide-react'

/**
 * Password input with an eye button that toggles masking. `visible`/`onToggle`
 * are lifted so a form can reveal several password fields at once (sign-up and
 * password reset both show "new" + "confirm" together).
 */

/** The five things the meter scores, in the order they're listed back to the user. */
const RULES: { test: (pwd: string) => boolean; label: string }[] = [
  { test: (p) => p.length >= 8, label: '8+ characters' },
  { test: (p) => /[a-z]/.test(p), label: 'a lowercase letter' },
  { test: (p) => /[A-Z]/.test(p), label: 'an uppercase letter' },
  { test: (p) => /[0-9]/.test(p), label: 'a number' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: 'a symbol' },
]

function getPasswordStrength(pwd: string) {
  const missing = RULES.filter((rule) => !rule.test(pwd)).map((rule) => rule.label)
  // Anything typed scores at least 1 so the bar is never invisible while the
  // user is mid-word.
  const score = pwd ? Math.max(1, RULES.length - missing.length) : 0
  return { score, missing }
}

const STRENGTH_COLORS = ['transparent', '#db3a34', '#e76814', '#eab308', '#84cc16', '#22c55e']
const STRENGTH_LABELS = ['', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong']

export function PasswordField({
  autoComplete,
  autoFocus,
  label,
  onChange,
  onToggle,
  value,
  visible,
  showStrengthIndicator,
}: {
  autoComplete: string
  autoFocus?: boolean
  label: string
  onChange: (value: string) => void
  onToggle: () => void
  value: string
  visible: boolean
  showStrengthIndicator?: boolean
}) {
  const { score, missing } = showStrengthIndicator
    ? getPasswordStrength(value)
    : { score: 0, missing: [] }
  const width = value ? `${(score / RULES.length) * 100}%` : '0%'
  const color = value ? STRENGTH_COLORS[score] : 'transparent'

  return (
    <label>
      {label}
      <div className="auth-password">
        <input
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          required
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="auth-password-toggle"
          onClick={onToggle}
          title={visible ? 'Hide password' : 'Show password'}
          type="button"
        >
          {visible ? <EyeOff size={22} /> : <Eye size={22} />}
        </button>
      </div>
      {showStrengthIndicator && (
        // aria-live so the meter is announced as it changes — the colour alone
        // carries the whole message otherwise.
        <div className="auth-strength" aria-live="polite">
          <div className="auth-strength-bar-container">
            <div
              className="auth-strength-bar"
              style={{ width, backgroundColor: color }}
            />
          </div>
          {value && (
            <>
              <span className="auth-strength-label" style={{ color }}>
                {STRENGTH_LABELS[score]}
              </span>
              {missing.length > 0 && (
                <span className="auth-strength-hint">Add {missing.join(', ')}.</span>
              )}
            </>
          )}
        </div>
      )}
    </label>
  )
}
