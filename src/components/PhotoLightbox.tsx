import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

import { useScrollLock } from '../lib/useScrollLock'
import './photo-lightbox.css'

type Props = {
  /** Doubles as the dialog's accessible name. */
  alt: string
  onClose: () => void
  src: string
}

/** Long edge a smaller-than-target photo is scaled up to. */
const TARGET_EDGE = 560

/**
 * Display width for a photo of the given intrinsic size.
 *
 * Sizing this in CSS doesn't work: max-width/max-height alone never scale a
 * small upload up, so a modest avatar sat in the middle of the scrim at
 * thumbnail size. But a fixed `width` distorts — for a wide logo the width
 * bound wins while max-height still clips the box, and the photo ends up
 * letterboxed inside rounded corners that don't touch it. Picking the width
 * here means it already satisfies both viewport bounds, so no max-* rule ever
 * binds and the ratio survives every shape.
 */
function fitWidth(naturalWidth: number, naturalHeight: number): number {
  const fit = Math.min(
    (window.innerWidth * 0.9) / naturalWidth,
    (window.innerHeight * 0.9) / naturalHeight,
  )
  // Scale up to the target, but never past what the viewport holds, and never
  // shrink a photo that already exceeds the target.
  const upscale = Math.max(1, TARGET_EDGE / Math.max(naturalWidth, naturalHeight))
  return naturalWidth * Math.min(fit, upscale)
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

  useScrollLock()

  const imageRef = useRef<HTMLImageElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  const [natural, setNatural] = useState<{ height: number; width: number } | null>(null)

  const measure = useCallback(() => {
    const image = imageRef.current
    // naturalWidth stays 0 until the photo decodes.
    if (!image?.naturalWidth) return
    setNatural({ height: image.naturalHeight, width: image.naturalWidth })
    setWidth(fitWidth(image.naturalWidth, image.naturalHeight))
  }, [])

  // Covers a cached photo, which can already be decoded by first paint and so
  // never fires onLoad. Measuring from a ref callback instead would re-run on
  // every render — and since measuring sets state, that loops forever.
  useEffect(() => {
    measure()
  }, [measure, src])

  // Re-fit on resize, otherwise a photo sized for the old viewport overflows a
  // narrowed window.
  useEffect(() => {
    if (!natural) return
    const handleResize = () => setWidth(fitWidth(natural.width, natural.height))
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [natural])

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
        onLoad={measure}
        ref={imageRef}
        src={src}
        // Hidden for the frame before the size is known, so the photo doesn't
        // flash at thumbnail size and then jump.
        style={{
          visibility: width === null ? 'hidden' : undefined,
          width: width === null ? undefined : `${Math.round(width)}px`,
        }}
      />
    </div>
  )
}
