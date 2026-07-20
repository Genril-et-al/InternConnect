import { Bell, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export interface Notification {
  id: string
  message: string
  date: string
  read: boolean
  onClick?: () => void
}

interface NotificationBellProps {
  notifications: Notification[]
  onMarkAllRead?: () => void
  onMarkRead?: (id: string) => void
}

export function NotificationBell({ notifications, onMarkAllRead, onMarkRead }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    if (!isOpen) return

    const handlePointerOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerOutside)
    // iOS only synthesises mousedown for targets it considers interactive, so a
    // tap on plain page background left the panel stuck open. touchstart always
    // fires; the panel itself is excluded by the containerRef check above.
    document.addEventListener('touchstart', handlePointerOutside, { passive: true })
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerOutside)
      document.removeEventListener('touchstart', handlePointerOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="nb-container" ref={containerRef}>
      <button
        className="nb-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="nb-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Scrim behind the mobile sheet. Display:none above the breakpoint,
              so the desktop dropdown is unaffected. */}
          <div className="nb-backdrop" aria-hidden="true" onClick={() => setIsOpen(false)} />
          <div className="nb-dropdown" role="dialog" aria-label="Notifications">
            <div className="nb-header">
              <h3>Notifications</h3>
              <div className="nb-header-actions">
                {unreadCount > 0 && onMarkAllRead && (
                  <button className="nb-mark-read" onClick={onMarkAllRead} type="button">
                    Mark all as read
                  </button>
                )}
                {/* Mobile sheets need a visible way out; hidden on desktop, where
                    clicking away is the obvious gesture. */}
                <button
                  className="nb-close"
                  onClick={() => setIsOpen(false)}
                  type="button"
                  aria-label="Close notifications"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="nb-list">
              {notifications.length === 0 ? (
                <p className="nb-empty">No new notifications</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`nb-item ${n.read ? 'read' : 'unread'} ${n.onClick ? 'clickable' : ''}`}
                    onClick={() => {
                      if (onMarkRead) onMarkRead(n.id)
                      if (n.onClick) {
                        n.onClick()
                        setIsOpen(false)
                      }
                    }}
                    role={n.onClick ? "button" : undefined}
                    tabIndex={n.onClick ? 0 : undefined}
                  >
                    <div className="nb-item-content">
                      {!n.read && <span className="nb-unread-dot" />}
                      <div>
                        <p className="nb-message">{n.message}</p>
                        <span className="nb-date">{n.date}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
