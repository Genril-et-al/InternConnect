import { useEffect } from 'react'

/**
 * Depth of currently mounted locks. Modals nest — a ConfirmDialog opens on top
 * of an edit modal, a photo preview on top of a profile — and each one saving
 * and restoring the body style on its own would let the inner layer hand back
 * `overflow: visible` while the outer one is still open. Counting means only
 * the first lock records the page's real style and only the last one puts it
 * back, whatever order the layers happen to unmount in.
 */
let depth = 0
let saved: { overflow: string; paddingRight: string } | null = null

/**
 * Freeze the page behind a modal.
 *
 * Every overlay in the app is `position: fixed`, so without this the page
 * carries on scrolling underneath one — the backdrop and its panel stay put
 * while the content slides around behind them.
 *
 * Pass `enabled` for a modal that stays mounted while closed; hooks can't be
 * called conditionally, and locking on behalf of a hidden dialog would freeze
 * the page for no reason.
 */
export function useScrollLock(enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    const { body } = document
    if (depth === 0) {
      saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
      // Standing in for the scrollbar that hiding the overflow removes, so the
      // page doesn't visibly widen the moment a modal opens.
      const scrollbar = window.innerWidth - body.clientWidth
      body.style.overflow = 'hidden'
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
    }
    depth += 1

    return () => {
      depth -= 1
      if (depth === 0 && saved) {
        body.style.overflow = saved.overflow
        body.style.paddingRight = saved.paddingRight
        saved = null
      }
    }
  }, [enabled])
}
