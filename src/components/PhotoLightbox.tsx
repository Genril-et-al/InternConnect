import { useEffect } from 'react'
import { X } from 'lucide-react'

import './photo-lightbox.css'

type Props = {
  /** Doubles as the dialog's accessible name. */
  alt: string
  onClose: () => void
  src: string
}

/**
 * Full-screen photo preview, shared by the student profile photo and the
 * company logo. Both screens used to hand-roll this with inline styles, which
 * is why it sat outside the app's modal look — no fade, and a close button
 * floating in the space above the image.
 */
export function PhotoLightbox({ alt, onClose, src }: Props) {
  // Escape closes, matching every other dismissable layer in the app.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      aria-label={alt}
      aria-modal="true"
      className="photo-lightbox modal-overlay"
      onClick={onClose}
      role="dialog"
    >
      <button
        aria-label="Close photo"
        className="photo-lightbox-close"
        onClick={onClose}
        type="button"
      >
        <X size={20} />
      </button>
      {/* Dismissing belongs to the backdrop — stop a click that lands on the
          photo itself from bubbling up and closing the view. */}
      <img
        alt={alt}
        className="photo-lightbox-image"
        onClick={(event) => event.stopPropagation()}
        src={src}
      />
    </div>
  )
}
