import { useCallback, useEffect, useRef, useState } from 'react'
import {
  NOTIFICATIONS_PAGE_SIZE,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notificationsApi'
import { useRealtimeRefresh } from '../lib/realtime'
import type { Notification } from './NotificationBell'

type Row = { id: string; message: string; date: string; read: boolean; navHint: string | null }

/**
 * Loads the signed-in user's notifications a page at a time and adapts them to
 * the NotificationBell shape. `onNavHint` receives the row's nav_hint
 * ('Applications', 'Applicants', 'admin:2', …) when a notification is clicked.
 */
export function useNotifications(onNavHint: (hint: string, notification?: { message: string }) => void): {
  notifications: Notification[]
  unreadCount: number
  hasMore: boolean
  canCollapse: boolean
  loadingMore: boolean
  loadMore: () => void
  collapse: () => void
  handleMarkRead: (id: string) => void
  handleMarkAllRead: () => void
  handleRemove: (id: string) => void
  handleRemoveAll: () => void
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

  useEffect(() => {
    navHintRef.current = onNavHint
  }, [onNavHint])

  const adapt = useCallback(
    (r: Row): Notification => ({
      id: r.id,
      message: r.message,
      date: r.date,
      read: r.read,
      onClick: r.navHint ? () => navHintRef.current(r.navHint!, r) : undefined,
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

  // Rows are written by database triggers on domain events, so the bell has no
  // way of knowing one arrived without being told. Refetch as deep as the user
  // has already paged rather than just the first page, so a notification
  // landing while the panel is expanded doesn't collapse it back to ten.
  const refreshNotifications = useCallback(async () => {
    const depth = Math.max(listRef.current.length, NOTIFICATIONS_PAGE_SIZE)
    const [page, unread] = await Promise.all([fetchNotifications(0, depth), fetchUnreadCount()])
    commit(page.items.map(adapt))
    setHasMore(page.hasMore)
    setUnreadCount(unread)
  }, [adapt, commit])

  useRealtimeRefresh(['notifications'], refreshNotifications)

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

  const collapse = useCallback(() => {
    // Nothing to give back when the list never grew past the first page.
    if (listRef.current.length <= NOTIFICATIONS_PAGE_SIZE) return
    commit(listRef.current.slice(0, NOTIFICATIONS_PAGE_SIZE))
    // Older rows exist beyond the truncated window by definition, whatever the
    // last page reported -- the button that got us here has to come back.
    setHasMore(true)
  }, [commit])

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

  const handleRemove = useCallback(
    (id: string) => {
      const target = listRef.current.find((n) => n.id === id)
      if (!target) return
      commit(listRef.current.filter((n) => n.id !== id))
      if (!target.read) {
        setUnreadCount((c) => Math.max(0, c - 1))
      }
      import('../lib/notificationsApi').then(api => api.removeNotification(id)).catch(() => {})
    },
    [commit]
  )

  const handleRemoveAll = useCallback(() => {
    commit([])
    setUnreadCount(0)
    import('../lib/notificationsApi').then(api => api.removeAllNotifications()).catch(() => {})
  }, [commit])

  return {
    notifications,
    unreadCount,
    hasMore,
    canCollapse: notifications.length > NOTIFICATIONS_PAGE_SIZE,
    loadingMore,
    loadMore,
    collapse,
    handleMarkRead,
    handleMarkAllRead,
    handleRemove,
    handleRemoveAll,
  }
}

export { NOTIFICATIONS_PAGE_SIZE }
