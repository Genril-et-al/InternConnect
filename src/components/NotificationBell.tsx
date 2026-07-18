import { Bell } from 'lucide-react'
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
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
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
        <div className="nb-dropdown">
          <div className="nb-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && onMarkAllRead && (
              <button className="nb-mark-read" onClick={onMarkAllRead} type="button">
                Mark all as read
              </button>
            )}
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
      )}
    </div>
  )
}
