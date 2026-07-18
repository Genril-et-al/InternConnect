import { Eye, EyeOff } from 'lucide-react'

/**
 * Password input with an eye button that toggles masking. `visible`/`onToggle`
 * are lifted so a form can reveal several password fields at once (sign-up and
 * password reset both show "new" + "confirm" together).
 */
export function PasswordField({
  autoComplete,
  autoFocus,
  label,
  onChange,
  onToggle,
  value,
  visible,
}: {
  autoComplete: string
  autoFocus?: boolean
  label: string
  onChange: (value: string) => void
  onToggle: () => void
  value: string
  visible: boolean
}) {
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
    </label>
  )
}
