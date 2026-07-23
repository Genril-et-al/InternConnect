import { useEffect, useRef } from 'react'
import { isSupabaseConfigured, supabase } from './supabase'

/**
 * Live data without a page reload.
 *
 * Every portal already owns a `refresh()` that refetches its slice from
 * Supabase. This hook watches the underlying tables over Supabase Realtime and
 * calls that same refresh whenever a row the user is allowed to see changes —
 * so a company accepting an applicant, an admin flagging a listing, or a
 * trigger writing a notification all land on screen on their own.
 *
 * Refetching (rather than patching state from the payload) is deliberate: the
 * queries behind these screens join across listings, companies, requirements
 * and submissions, and a single changed row is not enough to rebuild those
 * shapes correctly. One extra round trip per change is cheap next to getting
 * the derived counts, match scores and progress steppers wrong.
 *
 * Note that Realtime applies RLS per subscriber, so a client is only told about
 * rows its policies already let it read.
 */

/**
 * A table to watch: `'applications'`, or `'profiles:id=eq.<uuid>'` to narrow it
 * to matching rows server-side (same filter syntax Realtime uses).
 */
export type RealtimeSource = string

/**
 * Changes arrive one row at a time — accepting an offer alone rewrites the
 * application, its siblings and the listing. Waiting a beat folds that burst
 * into a single refetch instead of one per row.
 */
const COALESCE_MS = 300

/** Channel names must be unique per subscription; a counter is enough. */
let channelSeq = 0

export function useRealtimeRefresh(
  sources: readonly RealtimeSource[],
  refresh: () => void | Promise<unknown>,
  enabled = true,
): void {
  // Held in a ref so a refresh callback with a new identity each render does
  // not tear down and rebuild the socket subscription underneath it.
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  // Compared by value: callers pass an array literal, which is a new reference
  // on every render.
  const key = sources.join('|')

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || !key) return

    let disposed = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let running = false
    /** A change we have been told about but not yet folded in. */
    let pending = false

    function run() {
      timer = null
      if (disposed) return
      // Nobody is looking at this tab. Hold the change and replay it the moment
      // the user comes back, rather than refetching into a hidden page.
      if (document.hidden || running) {
        pending = true
        return
      }
      running = true
      pending = false
      Promise.resolve(refreshRef.current())
        // A failed refetch leaves the last good data on screen; the next change
        // (or the tab regaining focus) tries again.
        .catch(() => {})
        .finally(() => {
          running = false
          if (!disposed && pending) schedule()
        })
    }

    function schedule() {
      pending = true
      if (timer) return
      timer = setTimeout(run, COALESCE_MS)
    }

    const channel = supabase.channel(`ic-rt-${++channelSeq}`)
    for (const source of key.split('|')) {
      const split = source.indexOf(':')
      const table = split === -1 ? source : source.slice(0, split)
      const filter = split === -1 ? undefined : source.slice(split + 1)
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, schedule)
    }

    // Realtime does not replay what it missed, so anything that changed while
    // the socket was down never arrives. Treat every reconnect as a change.
    let subscribedBefore = false
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      if (subscribedBefore) schedule()
      subscribedBefore = true
    })

    const onVisible = () => {
      if (!document.hidden && pending) schedule()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [key, enabled])
}
