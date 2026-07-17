import { useState, type ReactNode } from 'react'
import { useAuth } from '../auth/context'
import { ConfirmDialog } from './ConfirmDialog'

type SignOutButtonProps = {
  className?: string
  ariaLabel?: string
  title?: string
  children: ReactNode
}

/**
 * Sign-out trigger that asks the user to confirm before ending the session,
 * so an accidental click doesn't drop them back to the login screen. Shared by
 * every place that offers a sign-out (both sidebars and the profile setup).
 */
export function SignOutButton({ className, ariaLabel, title, children }: SignOutButtonProps) {
  const { signOut } = useAuth()
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <button
        aria-label={ariaLabel}
        className={className}
        onClick={() => setConfirming(true)}
        title={title}
        type="button"
      >
        {children}
      </button>
      <ConfirmDialog
        cancelLabel="Stay signed in"
        confirmLabel="Sign out"
        danger
        message="You'll be returned to the login screen and will need to sign in again to get back to your workspace."
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          void signOut()
        }}
        open={confirming}
        title="Sign out of InternConnect?"
      />
    </>
  )
}
