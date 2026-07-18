import { useState } from 'react'

/**
 * Derive up to two initials from a display name (or email), e.g.
 * "Luke Miguel M Dongque" → "LM", "first.last@cit.edu" → "FL".
 */
function initialsOf(name: string): string {
  return name
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Circular user avatar: shows the uploaded profile photo when there is one,
 * and falls back to name initials otherwise. Styling comes from `className`
 * (e.g. .ad-user-avatar) so this drops into any existing avatar slot.
 */
export function Avatar({
  className,
  fallback = 'IC',
  name,
  photoUrl,
}: {
  className?: string
  /** Shown when the name yields no initials. */
  fallback?: string
  name: string
  photoUrl?: string | null
}) {
  // Remember which URL failed (rather than a bare boolean) so that swapping in
  // a new photo re-attempts the load instead of staying stuck on initials.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showPhoto = Boolean(photoUrl) && photoUrl !== failedUrl

  return (
    <span className={className}>
      {showPhoto ? (
        <img
          // Decorative: the name is always rendered next to the avatar.
          alt=""
          onError={() => setFailedUrl(photoUrl ?? null)}
          src={photoUrl as string}
        />
      ) : (
        initialsOf(name) || fallback
      )}
    </span>
  )
}
