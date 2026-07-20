import { useCallback, useEffect, useRef, useState } from 'react'
import {
  NOTIFICATIONS_PAGE_SIZE,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notificationsApi'
import type { Notification } from './NotificationBell'

type Row = { id: string; message: string; date: string; read: boolean; navHint: string | null }

/**
 * Loads the signed-in user's notifications a page at a time and adapts them to
 * the NotificationBell shape. `onNavHint` receives the row's nav_hint
 * ('Applications', 'Applicants', 'admin:2', …) when a notification is clicked.
 */
export function useNotifications(onNavHint: (hint: string) => void): {
  notifications: Notification[]
  unreadCount: number
  hasMore: boolean
  loadingMore: boolean
  loadMore: () => void
  handleMarkRead: (id: string) => void
  handleMarkAllRead: () => void
} {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Mirrors of state, read inside callbacks. State updaters must stay pure —
  // StrictMode invokes them twice, which would double-fire any request or
  // counter change placed inside one.
  const listRef = useRef<Notification[]>([])
  const loadingRef = useRef(false)

  // Held in a ref so a new onNavHint identity each render neither invalidates
  // the callbacks below nor triggers a refetch.
  const navHintRef = useRef(onNavHint)
  navHintRef.current = onNavHint

  const adapt = useCallback(
    (r: Row): Notification => ({
      id: r.id,
      message: r.message,
      date: r.date,
      read: r.read,
      onClick: r.navHint ? () => navHintRef.current(r.navHint!) : undefined,
    }),
    [],
  )

  const commit = useCallback((next: Notification[]) => {
    listRef.current = next
    setNotifications(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchNotifications(0)
      .then((page) => {
        if (cancelled) return
        commit(page.items.map(adapt))
        setHasMore(page.hasMore)
      })
      .catch(() => {
        /* bell stays empty if the fetch fails */
      })
    fetchUnreadCount()
      .then((n) => {
        if (!cancelled) setUnreadCount(n)
      })
      .catch(() => {
        /* badge stays at zero if the count fails */
      })
    return () => {
      cancelled = true
    }
  }, [adapt, commit])

  const loadMore = useCallback(() => {
    // Guard against a double tap firing two requests for the same offset.
    if (loadingRef.current) return
    loadingRef.current = true
    setLoadingMore(true)
    fetchNotifications(listRef.current.length)
      .then((page) => {
        // Drop anything already held, in case a row arrived between pages and
        // shifted the window — otherwise React would see duplicate keys.
        const seen = new Set(listRef.current.map((n) => n.id))
        commit([...listRef.current, ...page.items.filter((r) => !seen.has(r.id)).map(adapt)])
        setHasMore(page.hasMore)
      })
      .catch(() => {
        /* leave the list as-is; the button stays available to retry */
      })
      .finally(() => {
        loadingRef.current = false
        setLoadingMore(false)
      })
  }, [adapt, commit])

  const handleMarkRead = useCallback(
    (id: string) => {
      const target = listRef.current.find((n) => n.id === id)
      if (!target || target.read) return
      commit(listRef.current.map((n) => (n.id === id ? { ...n, read: true } : n)))
      setUnreadCount((c) => Math.max(0, c - 1))
      markNotificationRead(id).catch(() => {})
    },
    [commit],
  )

  const handleMarkAllRead = useCallback(() => {
    // The update clears every unread row, including ones not paged in yet.
    commit(listRef.current.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    markAllNotificationsRead().catch(() => {})
  }, [commit])

  return {
    notifications,
    unreadCount,
    hasMore,
    loadingMore,
    loadMore,
    handleMarkRead,
    handleMarkAllRead,
  }
}

export { NOTIFICATIONS_PAGE_SIZE }
