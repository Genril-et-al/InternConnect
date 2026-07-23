import { useEffect, useState, useCallback } from 'react'
import type { Internship, Application } from '../lib/mockData'
import type { Notification } from './NotificationBell'

export function useProactiveNotifications(internships: Internship[], applications: Application[], userId?: string) {
  const [proactiveNotifications, setProactiveNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (!userId || internships.length === 0) return

    const storageKeyNotified = `internconnect_proactive_notified_${userId}`
    const storageKeyRead = `internconnect_proactive_read_${userId}`
    const storageKeyDismissed = `internconnect_proactive_dismissed_${userId}`
    const storageKeyDates = `internconnect_proactive_dates_${userId}`

    const getStored = (key: string) => {
      try {
        return new Set<string>(JSON.parse(localStorage.getItem(key) || '[]'))
      } catch {
        return new Set<string>()
      }
    }

    const getStoredDates = (key: string) => {
      try {
        return JSON.parse(localStorage.getItem(key) || '{}')
      } catch {
        return {}
      }
    }

    const notifiedIds = getStored(storageKeyNotified)
    const readIds = getStored(storageKeyRead)
    const dismissedIds = getStored(storageKeyDismissed)
    const dates = getStoredDates(storageKeyDates)

    // Find high-match internships we haven't notified about yet
    const newMatches = internships.filter(
      (i) => i.match !== null && i.match >= 80 && !notifiedIds.has(i.id) && !dismissedIds.has(i.id)
    )

    if (newMatches.length > 0) {
      newMatches.forEach((i) => {
        notifiedIds.add(i.id)
        if (!dates[i.id]) dates[i.id] = new Date().toISOString()
      })
      localStorage.setItem(storageKeyNotified, JSON.stringify(Array.from(notifiedIds)))
      localStorage.setItem(storageKeyDates, JSON.stringify(dates))
    }

    const activeProactiveIds = Array.from(notifiedIds).filter(id => !dismissedIds.has(id))

    const generated: Notification[] = activeProactiveIds
      .map((id) => {
        const internship = internships.find((i) => i.id === id)
        if (!internship) return null
        return {
          id: `proactive-${internship.id}`,
          message: `New internship matching your skills (${internship.match}%): ${internship.title} at ${internship.company}`,
          date: dates[id] || new Date().toISOString(), // Keeping raw ISO string for correct sorting
          read: readIds.has(id),
        }
      })
      .filter(Boolean) as Notification[]

    const deadlineNotifications = applications
      .filter(app => app.status === 'Offered' && app.nextStep && !dismissedIds.has(`offer-${app.id}`))
      .map(app => {
        try {
          const details = JSON.parse(app.nextStep)
          if (!details.expiresAt) return null
          const expiry = new Date(details.expiresAt)
          const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86400000)
          
          if (daysLeft <= 1 && daysLeft >= 0) {
            if (!notifiedIds.has(`offer-${app.id}`)) {
              notifiedIds.add(`offer-${app.id}`)
              localStorage.setItem(storageKeyNotified, JSON.stringify(Array.from(notifiedIds)))
            }
            return {
              id: `proactive-offer-${app.id}`,
              message: `Urgent: Your offer for ${app.role} at ${app.company} expires in ${daysLeft > 0 ? daysLeft + ' day(s)' : 'less than a day'}!`,
              date: new Date().toISOString(),
              read: readIds.has(`offer-${app.id}`),
            }
          }
        } catch {}
        return null
      })
      .filter(Boolean) as Notification[]

    setProactiveNotifications([...deadlineNotifications, ...generated.reverse()])
  }, [internships, applications, userId])

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
