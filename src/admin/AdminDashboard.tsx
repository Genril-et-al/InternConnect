import {
  BarChart3,
  Briefcase,
  Building2,
  FileText,
  GraduationCap,
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
}: {
  students: AdminStudent[]
  companies: AdminCompany[]
  listings: AdminListing[]
  appStats: AdminAppStats
  onNav: (index: number) => void
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
    loadingMore,
    loadMore,
    handleMarkRead,
    handleMarkAllRead,
  } = useNotifications((hint) => {
    const index = Number(hint.split(':')[1])
    if (!Number.isNaN(index)) onNav(index)
  })

  // Donut segments via conic-gradient (cumulative start/end stops).
  const stops = STATUS_BREAKDOWN.map((_, i) =>
    STATUS_BREAKDOWN.slice(0, i).reduce((sum, prev) => sum + prev.value, 0),
  )
  const segments = STATUS_BREAKDOWN.map(
    (s, i) => `${s.color} ${stops[i]}% ${stops[i] + s.value}%`,
  ).join(', ')

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1 className="ad-title">Platform Overview</h1>
          <p className="ad-subtitle">Welcome back, NLO Admin</p>
        </div>
        <div className="topbar-actions">
          <button className="ad-primary" onClick={() => onNav(4)} type="button">
            <BarChart3 size={14} /> Generate Report
          </button>
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
          />
        </div>
      </div>

      <div className="ad-stats">
        <Stat color="var(--brand-orange)" icon={GraduationCap} label="Total Students" sub={`${students.filter((s) => s.status === 'active').length} active`} value={students.length} />
        <Stat color="var(--brand-brown)" icon={Building2} label="Verified Companies" sub={`${pendingVerifs} pending review`} value={verified} />
        <Stat color="var(--brand-dark-red)" icon={Briefcase} label="Open Listings" sub="Across all companies" value={openListings} />
        <Stat color="var(--brand-orange-soft)" icon={FileText} label="Applications" sub="This semester" value={totalApplications} />
      </div>

      <div className="ad-charts">
        <section className="ad-card">
          <h3>Monthly Applications</h3>
          {MONTHLY_APPLICATIONS.length === 0 ? (
            <p className="ad-empty">No application data yet</p>
          ) : (
            <div className="ad-bars">
              {MONTHLY_APPLICATIONS.map((m) => (
                <div className="ad-bar-col" key={m.month}>
                  <span className="ad-bar-value">{m.apps}</span>
                  <div
                    className="ad-bar"
                    style={{ height: `${Math.round((m.apps / maxApps) * 100)}%` }}
                  />
                  <span className="ad-bar-label">{m.month}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="ad-card">
          <h3>Application Status</h3>
          {STATUS_BREAKDOWN.length === 0 ? (
            // An empty segments string makes conic-gradient() invalid CSS, so
            // the donut would render as a blank ring rather than nothing.
            <p className="ad-empty">No application data yet</p>
          ) : (
            <div className="ad-donut-wrap">
              <div className="ad-donut" style={{ background: `conic-gradient(${segments})` }} />
              <div className="ad-legend">
                {STATUS_BREAKDOWN.map((s) => (
                  <div className="ad-legend-row" key={s.name}>
                    <span className="ad-legend-name">
                      <span className="ad-legend-dot" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                    <span className="ad-legend-value">{s.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="ad-quick">
        {[
          { label: 'Pending Verifications', value: pendingVerifs, action: 'Review', nav: 2 },
          { label: 'Flagged Listings', value: flagged, action: 'View', nav: 3 },
          { label: 'Registered Students', value: students.length, action: 'Manage', nav: 1 },
        ].map((item) => (
          <div className="ad-quick-card" key={item.label}>
            <div>
              <p className="ad-quick-label">{item.label}</p>
              <p className="ad-quick-value">{item.value}</p>
            </div>
            <button className="ad-secondary" onClick={() => onNav(item.nav)} type="button">
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
  value: number
  sub: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="ad-stat">
      <div className="ad-stat-top">
        <span className="ad-stat-label">{label}</span>
        <span
          className="ad-stat-icon"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
        >
          <Icon size={16} style={{ color }} />
        </span>
      </div>
      <p className="ad-stat-value">{value.toLocaleString()}</p>
      <p className="ad-stat-sub">{sub}</p>
    </div>
  )
}
