import { useCallback, useEffect, useState } from 'react'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notificationsApi'
import type { Notification } from './NotificationBell'

/**
 * Loads the signed-in user's notifications and adapts them to the
 * NotificationBell shape. `onNavHint` receives the row's nav_hint
 * ('Applications', 'Applicants', 'admin:2', …) when a notification is clicked.
 */
export function useNotifications(onNavHint: (hint: string) => void): {
  notifications: Notification[]
  handleMarkRead: (id: string) => void
  handleMarkAllRead: () => void
} {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    let cancelled = false
    fetchNotifications()
      .then((rows) => {
        if (cancelled) return
        setNotifications(
          rows.map((r) => ({
            id: r.id,
            message: r.message,
            date: r.date,
            read: r.read,
            onClick: r.navHint ? () => onNavHint(r.navHint!) : undefined,
          })),
        )
      })
      .catch(() => {
        /* bell stays empty if the fetch fails */
      })
    return () => {
      cancelled = true
    }
    // Intentionally fetch once per mount; onNavHint identity churn shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMarkRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    markNotificationRead(id).catch(() => {})
  }, [])

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    markAllNotificationsRead().catch(() => {})
  }, [])

  return { notifications, handleMarkRead, handleMarkAllRead }
}
