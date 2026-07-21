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
  /** Unread total across all rows. Falls back to counting the loaded page. */
  unreadCount?: number
  /** Older rows exist beyond what is loaded. */
  hasMore?: boolean
  /** The list has grown past the first page, so it can be shrunk back. */
  canCollapse?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  onCollapse?: () => void
}

export function NotificationBell({
  notifications,
  onMarkAllRead,
  onMarkRead,
  unreadCount: unreadCountProp,
  hasMore = false,
  canCollapse = false,
  loadingMore = false,
  onLoadMore,
  onCollapse,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [clickedId, setClickedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Counting the loaded page would undercount once the list is paginated —
  // unread rows can sit past the first page when newer ones are already read.
  const unreadCount = unreadCountProp ?? notifications.filter((n) => !n.read).length

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
                    className={`nb-item ${n.read ? 'read' : 'unread'} ${n.onClick ? 'clickable' : ''} ${clickedId === n.id ? 'clicked' : ''}`}
                    onClick={() => {
                      setClickedId(n.id)
                      if (onMarkRead) onMarkRead(n.id)
                      if (n.onClick) {
                        // Small delay to show the outline before routing/closing
                        setTimeout(() => {
                          n.onClick!()
                          setIsOpen(false)
                        }, 150)
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
              {(hasMore || canCollapse) && (
                <div className="nb-list-actions">
                  {hasMore && (
                    <button
                      className="nb-load-more"
                      onClick={onLoadMore}
                      disabled={loadingMore}
                      type="button"
                    >
                      {/* Shortened once it shares the row: at half of a 288px
                          panel (a 320px phone) the full label wraps to two
                          lines, and even the 320px desktop panel fits it with
                          nothing to spare. Alone, it keeps the fuller wording. */}
                      {loadingMore
                        ? 'Loading…'
                        : canCollapse
                          ? 'Load older'
                          : 'Load older notifications'}
                    </button>
                  )}
                  {/* Disabled mid-load: truncating while a page is in flight
                      would append that page onto the shortened list and leave a
                      gap where the dropped rows were. */}
                  {canCollapse && (
                    <button
                      className="nb-show-less"
                      onClick={onCollapse}
                      disabled={loadingMore}
                      type="button"
                    >
                      Show less
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
