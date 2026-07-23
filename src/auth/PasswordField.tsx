import { Eye, EyeOff } from 'lucide-react'

/**
 * Password input with an eye button that toggles masking. `visible`/`onToggle`
 * are lifted so a form can reveal several password fields at once (sign-up and
 * password reset both show "new" + "confirm" together).
 */
function getPasswordStrength(pwd: string): number {
  if (!pwd) return 0
  let score = 0
  if (pwd.length >= 8) score += 1
  if (/[A-Z]/.test(pwd)) score += 1
  if (/[a-z]/.test(pwd)) score += 1
  if (/[0-9]/.test(pwd)) score += 1
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1
  return Math.max(1, score)
}

const STRENGTH_COLORS = ['transparent', '#db3a34', '#e76814', '#eab308', '#84cc16', '#22c55e']

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
  const score = showStrengthIndicator ? getPasswordStrength(value) : 0
  const width = value ? `${(score / 5) * 100}%` : '0%'
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
        <div className="auth-strength-bar-container">
          <div
            className="auth-strength-bar"
            style={{ width, backgroundColor: color }}
          />
        </div>
      )}
    </label>
  )
}
