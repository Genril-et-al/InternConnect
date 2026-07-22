import { useEffect } from 'react'
import { X } from 'lucide-react'

import { useScrollLock } from '../lib/useScrollLock'
import './photo-lightbox.css'

type Props = {
  /** Doubles as the dialog's accessible name. */
  alt: string
  onClose: () => void
  src: string
}

/**
 * Photo preview, shared by the student profile photo and the company logo.
 *
 * An ordinary modal: .modal-overlay + .modal-panel, close button, click the
 * backdrop or press Escape to dismiss — the same construction as ConfirmDialog
 * and ProgressModal. Earlier versions tried to be their own kind of layer, one
 * measuring the photo in JS to pick a width and one letting the image fill the
 * whole viewport. Both fought the app's modal styling instead of using it.
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

  useScrollLock()

  return (
    <div
      aria-label={alt}
      aria-modal="true"
      className="photo-lightbox modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="dialog"
    >
      <div className="modal-panel photo-lightbox-panel">
        <button
          aria-label="Close photo"
          className="modal-close photo-lightbox-close"
          onClick={onClose}
          type="button"
        >
          <X size={16} />
        </button>
        <div className="photo-lightbox-stage">
          <img alt={alt} className="photo-lightbox-image" src={src} />
        </div>
      </div>
    </div>
  )
}
