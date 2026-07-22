import { useEffect, useState, useCallback } from 'react'
import type { Internship } from '../lib/mockData'
import type { Notification } from './NotificationBell'

export function useProactiveNotifications(internships: Internship[], userId?: string) {
  const [proactiveNotifications, setProactiveNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (!userId || internships.length === 0) return

    const storageKeyNotified = `internconnect_proactive_notified_${userId}`
    const storageKeyRead = `internconnect_proactive_read_${userId}`
    const storageKeyDismissed = `internconnect_proactive_dismissed_${userId}`

    const getStored = (key: string) => {
      try {
        return new Set<string>(JSON.parse(localStorage.getItem(key) || '[]'))
      } catch {
        return new Set<string>()
      }
    }

    const notifiedIds = getStored(storageKeyNotified)
    const readIds = getStored(storageKeyRead)
    const dismissedIds = getStored(storageKeyDismissed)

    // Find high-match internships we haven't notified about yet
    const newMatches = internships.filter(
      (i) => i.match !== null && i.match >= 80 && !notifiedIds.has(i.id) && !dismissedIds.has(i.id)
    )

    if (newMatches.length > 0) {
      newMatches.forEach((i) => notifiedIds.add(i.id))
      localStorage.setItem(storageKeyNotified, JSON.stringify(Array.from(notifiedIds)))
    }

    const activeProactiveIds = Array.from(notifiedIds).filter(id => !dismissedIds.has(id))

    const generated: Notification[] = activeProactiveIds
      .map((id) => {
        const internship = internships.find((i) => i.id === id)
        if (!internship) return null
        return {
          id: `proactive-${internship.id}`,
          message: `New internship matching your skills (${internship.match}%): ${internship.title} at ${internship.company}`,
          date: new Date().toISOString(), // Keeping raw ISO string for correct sorting
          read: readIds.has(id),
          // onClick is bound dynamically when passing to NotificationBell
        }
      })
      .filter(Boolean) as Notification[]

    setProactiveNotifications(generated.reverse()) // newest first
  }, [internships, userId])

  const markProactiveRead = useCallback((notificationId: string) => {
    if (!notificationId.startsWith('proactive-') || !userId) return
    const listingId = notificationId.replace('proactive-', '')

    const storageKeyRead = `internconnect_proactive_read_${userId}`
    try {
      const readIds = new Set<string>(JSON.parse(localStorage.getItem(storageKeyRead) || '[]'))
      readIds.add(listingId)
      localStorage.setItem(storageKeyRead, JSON.stringify(Array.from(readIds)))
    } catch {
      // Read state is a convenience, not data worth surfacing an error over:
      // localStorage throws on corrupt JSON and in private-mode Safari once the
      // quota is hit. The badge just reappears next session.
    }

    setProactiveNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    )
  }, [userId])

  const markAllProactiveRead = useCallback(() => {
    if (!userId) return
    const storageKeyRead = `internconnect_proactive_read_${userId}`
    const storageKeyNotified = `internconnect_proactive_notified_${userId}`
    try {
      const notifiedIds = new Set<string>(JSON.parse(localStorage.getItem(storageKeyNotified) || '[]'))
      localStorage.setItem(storageKeyRead, JSON.stringify(Array.from(notifiedIds)))
    } catch {
      // Swallowed for the same reason as in markProactiveRead above.
    }

    setProactiveNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [userId])

  const removeProactiveNotification = useCallback((notificationId: string) => {
    if (!notificationId.startsWith('proactive-') || !userId) return
    const listingId = notificationId.replace('proactive-', '')

    const storageKeyDismissed = `internconnect_proactive_dismissed_${userId}`
    try {
      const dismissedIds = new Set<string>(JSON.parse(localStorage.getItem(storageKeyDismissed) || '[]'))
      dismissedIds.add(listingId)
      localStorage.setItem(storageKeyDismissed, JSON.stringify(Array.from(dismissedIds)))
    } catch {}

    setProactiveNotifications((prev) => prev.filter((n) => n.id !== notificationId))
  }, [userId])

  const removeAllProactiveNotifications = useCallback(() => {
    if (!userId) return
    const storageKeyDismissed = `internconnect_proactive_dismissed_${userId}`
    try {
      const dismissedIds = new Set<string>(JSON.parse(localStorage.getItem(storageKeyDismissed) || '[]'))
      proactiveNotifications.forEach(n => {
        dismissedIds.add(n.id.replace('proactive-', ''))
      })
      localStorage.setItem(storageKeyDismissed, JSON.stringify(Array.from(dismissedIds)))
    } catch {}

    setProactiveNotifications([])
  }, [userId, proactiveNotifications])

  return {
    proactiveNotifications,
    markProactiveRead,
    markAllProactiveRead,
    removeProactiveNotification,
    removeAllProactiveNotifications,
  }
}
