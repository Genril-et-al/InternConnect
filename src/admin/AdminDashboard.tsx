import {
  BarChart3,
  Briefcase,
  Building2,
  FileText,
  GraduationCap,
  Percent,
  Clock,
} from 'lucide-react'
import type { AdminAppStats, AdminCompany, AdminListing, AdminStudent } from './adminData'
import { NotificationBell } from '../components/NotificationBell'
import { useNotifications } from '../components/useNotifications'

export function AdminDashboard({
  students,
  companies,
  listings,
  appStats,
  onNav,
  onHighlightCompany,
  onHighlightListing,
}: {
  students: AdminStudent[]
  companies: AdminCompany[]
  listings: AdminListing[]
  appStats: AdminAppStats
  onNav: (index: number) => void
  onHighlightCompany?: (id: string) => void
  onHighlightListing?: (id: string) => void
}) {
  const verified = companies.filter((c) => c.verification === 'verified').length
  const pendingVerifs = companies.filter((c) => c.verification === 'pending').length
  const openListings = listings.filter((l) => l.status === 'open').length
  const flagged = listings.filter((l) => l.status === 'flagged').length
  const MONTHLY_APPLICATIONS = appStats.monthly
  const STATUS_BREAKDOWN = appStats.breakdown
  const totalApplications = appStats.total
  // Guard the spread: Math.max() with no args is -Infinity, which would make
  // every bar height NaN the moment a single data point arrives.
  const maxApps = Math.max(1, ...MONTHLY_APPLICATIONS.map((m) => m.apps))

  // Admin nav hints look like 'admin:<index>' — map to the sidebar index.
  const {
    notifications,
    unreadCount,
    hasMore,
    canCollapse,
    loadingMore,
    loadMore,
    collapse,
    handleMarkRead,
    handleMarkAllRead,
    handleRemove,
    handleRemoveAll,
  } = useNotifications((hint, notification) => {
    const index = Number(hint.split(':')[1])
    if (!Number.isNaN(index)) onNav(index)
    
    if (notification) {
      if (index === 2) {
        const match = companies.find(c => notification.message.includes(c.name))
        if (match) onHighlightCompany?.(match.id)
      } else if (index === 3) {
        const match = listings.find(l => notification.message.includes(l.title))
        if (match) onHighlightListing?.(match.id)
      }
    }
  })

  // Donut segments via conic-gradient (cumulative start/end stops).
  const stops = STATUS_BREAKDOWN.map((_, i) =>
    STATUS_BREAKDOWN.slice(0, i).reduce((sum, prev) => sum + prev.value, 0),
  )
  const segments = STATUS_BREAKDOWN.map(
    (s, i) => `${s.color} ${stops[i]}% ${stops[i] + s.value}%`,
  ).join(', ')

  return (
    <div className="ic-page">
      <div className="ic-page-head">
        <div>
          <h1 className="ic-title">Platform Overview</h1>
          <p className="ic-subtitle">Welcome back, Admin</p>
        </div>
        <div className="topbar-actions">
          <button className="ic-primary" onClick={() => onNav(4)} type="button">
            <BarChart3 size={14} /> Generate Report
          </button>
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            hasMore={hasMore}
            canCollapse={canCollapse}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            onCollapse={collapse}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
            onRemove={handleRemove}
            onRemoveAll={handleRemoveAll}
          />
        </div>
      </div>

      <div className="ic-stats">
        <Stat color="var(--brand-orange)" icon={GraduationCap} label="Total Students" sub={`${students.filter((s) => s.status === 'active').length} active`} value={students.length} />
        <Stat color="var(--brand-brown)" icon={Building2} label="Verified Companies" sub={`${pendingVerifs} pending review`} value={verified} />
        <Stat color="var(--brand-dark-red)" icon={Briefcase} label="Open Listings" sub="Across all companies" value={openListings} />
        <Stat color="var(--brand-orange-soft)" icon={FileText} label="Applications" sub="This semester" value={totalApplications} />
      </div>

      <div style={{ marginTop: '24px', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--brand-brown)' }}>Advanced Performance Metrics</h3>
      </div>
      <div className="ic-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Stat color="var(--brand-orange)" icon={Percent} label="Placement Rate" sub="Successfully placed students" value={`${appStats.placementRate}%`} />
        <Stat color="var(--brand-dark-red)" icon={Clock} label="Avg Processing Time" sub=" responsiveness indicator" value={`${appStats.avgProcessingTimeDays} days`} />
      </div>

      <div className="ic-charts">
        <section className="ic-card">
          <h3>Monthly Applications</h3>
          {MONTHLY_APPLICATIONS.length === 0 ? (
            <p className="ic-empty">No application data yet</p>
          ) : (
            <div className="ic-bars">
              {MONTHLY_APPLICATIONS.map((m) => (
                <div className="ic-bar-col" key={m.month}>
                  <span className="ic-bar-value">{m.apps}</span>
                  <div
                    className="ic-bar"
                    style={{ height: `${Math.round((m.apps / maxApps) * 100)}%` }}
                  />
                  <span className="ic-bar-label">{m.month}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="ic-card">
          <h3>Application Status</h3>
          {STATUS_BREAKDOWN.length === 0 ? (
            // An empty segments string makes conic-gradient() invalid CSS, so
            // the donut would render as a blank ring rather than nothing.
            <p className="ic-empty">No application data yet</p>
          ) : (
            <div className="ic-donut-wrap">
              <div className="ic-donut" style={{ background: `conic-gradient(${segments})` }} />
              <div className="ic-legend">
                {STATUS_BREAKDOWN.map((s) => (
                  <div className="ic-legend-row" key={s.name}>
                    <span className="ic-legend-name">
                      <span className="ic-legend-dot" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                    <span className="ic-legend-value">{s.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="ic-quick">
        {[
          { label: 'Pending Verifications', value: pendingVerifs, action: 'Review', nav: 2 },
          { label: 'Flagged Listings', value: flagged, action: 'View', nav: 3 },
          { label: 'Registered Students', value: students.length, action: 'Manage', nav: 1 },
        ].map((item) => (
          <div className="ic-quick-card" key={item.label}>
            <div>
              <p className="ic-quick-label">{item.label}</p>
              <p className="ic-quick-value">{item.value}</p>
            </div>
            <button className="ic-secondary" onClick={() => onNav(item.nav)} type="button">
              {item.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  sub: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="ic-stat">
      <div className="ic-stat-top">
        <span className="ic-stat-label">{label}</span>
        <span
          className="ic-stat-icon"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
        >
          <Icon size={16} style={{ color }} />
        </span>
      </div>
      <p className="ic-stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="ic-stat-sub">{sub}</p>
    </div>
  )
}
