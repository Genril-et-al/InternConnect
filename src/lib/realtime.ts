import { useEffect, useRef, useState } from 'react'
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
      // Deliberately runs whether or not the tab is in the foreground: a
      // student who left the board open in a background tab should find it
      // already current when they come back, not watch it load then.
      if (running) {
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

    // Backstop, not the main path. Browsers clamp timers in background tabs, so
    // a refresh scheduled while hidden can sit unfired for far longer than the
    // coalesce window; this makes sure it has landed by the time the tab is
    // looked at again.
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

/**
 * How long an arrived row keeps the `ic-arrive` class. Must outlast the CSS
 * animation (--dur-3), or the class is pulled while the row is still moving and
 * it snaps into place.
 */
const ARRIVAL_HOLD_MS = 1200

const NO_ARRIVALS: ReadonlySet<string> = new Set()

/**
 * The ids of rows that appeared in a list after it was already on screen —
 * a listing another company just posted, an application that just landed.
 *
 * Give the returned set to the row's className (see `.ic-arrive` in index.css)
 * so a live update announces itself instead of silently changing the list under
 * the user. Rows present on the first load are never reported: the whole list
 * arriving at once is the page loading, not news.
 *
 * Pass `ready: false` while that first load is still in flight for lists that
 * fill in more than one go — the internships board paints after its first chunk
 * and keeps appending, and without this every later chunk would animate as if
 * it had just been posted.
 */
export function useArrivals<T extends { id: string }>(
  items: readonly T[],
  ready = true,
): ReadonlySet<string> {
  const [arrivals, setArrivals] = useState<ReadonlySet<string>>(NO_ARRIVALS)
  /** Null until the first list lands, which is what makes that load silent. */
  const seen = useRef<Set<string> | null>(null)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t)
      timers.current.clear()
    },
    [],
  )

  useEffect(() => {
    const ids = items.map((i) => i.id)
    if (!ready || seen.current === null) {
      seen.current = new Set(ids)
      return
    }
    const fresh = ids.filter((id) => !seen.current!.has(id))
    // Rebuilt rather than added to, so a row that leaves and comes back — a
    // listing reopened, an application restored after a withdrawal — reads as
    // an arrival the second time too.
    seen.current = new Set(ids)
    if (fresh.length === 0) return

    setArrivals((prev) => new Set([...prev, ...fresh]))
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setArrivals((prev) => {
        const next = new Set(prev)
        for (const id of fresh) next.delete(id)
        return next
      })
    }, ARRIVAL_HOLD_MS)
    timers.current.add(timer)
  }, [items, ready])

  return arrivals
}
