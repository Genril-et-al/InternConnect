/**
 * A single "you have unsaved changes" checkpoint for forms holding unsaved work.
 *
 * The form that owns the changes lives deep inside a portal, but the controls
 * that navigate away from it (the sidebar, the account card) live up in App.
 * Rather than thread a dirty flag through every portal, the form registers a
 * guard here and the navigation callers route through `requestLeave`.
 *
 * The guard is callback-based rather than returning a boolean because the
 * confirmation is an in-app modal, not a synchronous `window.confirm` — the
 * answer arrives a render or two later, once the student clicks a button.
 *
 * Only one guard can be active at a time, which is all the app needs: a single
 * editable form is on screen at once.
 */

/**
 * Receives the navigation to run if the student agrees to discard. A guard
 * either calls `proceed` straight away (nothing unsaved) or holds onto it and
 * calls it after the student confirms — or drops it if they cancel.
 */
type UnsavedGuard = (proceed: () => void) => void

let activeGuard: UnsavedGuard | null = null

/** Register (or clear, with `null`) the guard consulted before navigating. */
export function setUnsavedGuard(guard: UnsavedGuard | null) {
  activeGuard = guard
}

/**
 * Run `proceed`, first giving any active guard the chance to confirm with the
 * student. With no guard registered the navigation happens immediately, so
 * callers can route through this unconditionally.
 */
export function requestLeave(proceed: () => void) {
  if (activeGuard) activeGuard(proceed)
  else proceed()
}
