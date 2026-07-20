import { Briefcase, CheckCircle2, Clock, Users } from 'lucide-react'
import { MatchBar, StatusBadge } from './CompanyApplicants'
import type { CompanyApplicant, CompanyListing } from './companyData'
import { NotificationBell } from '../components/NotificationBell'
import { useNotifications } from '../components/useNotifications'

/** UC-C06 — recruitment activity at a glance. */

export function CompanyDashboard({
  listings,
  applicants,
  onNavigate,
}: {
  listings: CompanyListing[]
  applicants: CompanyApplicant[]
  onNavigate: (view: string) => void
}) {
  const active = listings.filter((l) => l.status === 'Open').length
  const pending = applicants.filter((a) => a.status === 'Pending').length
  const accepted = applicants.filter((a) => a.status === 'Accepted').length
  const queue = applicants
    .filter((a) => a.status === 'Pending')
    .sort((a, b) => (b.match ?? -1) - (a.match ?? -1))

  const { notifications, handleMarkRead, handleMarkAllRead } = useNotifications(onNavigate)

  return (
    <div className="cp-root">
      <div className="cp-head">
        <div>
          <h1 className="cp-title">Recruitment Overview</h1>
          <p className="cp-subtitle">
            {pending > 0
              ? `${pending} application${pending > 1 ? 's' : ''} waiting for review.`
              : 'No applications waiting for review.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button className="cp-primary" onClick={() => onNavigate('Applicants')} type="button">
            <Users size={14} /> Review Applications
          </button>
          <NotificationBell
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
          />
        </div>
      </div>

      <div className="cp-stats">
        <Stat color="var(--brand-orange)" icon={Briefcase} label="Active Listings" value={active} />
        <Stat color="var(--brand-brown)" icon={Users} label="Total Applicants" value={applicants.length} />
        <Stat color="var(--brand-orange-soft)" icon={Clock} label="Pending Review" value={pending} />
        <Stat color="var(--brand-dark-red)" icon={CheckCircle2} label="Accepted" value={accepted} />
      </div>

      <section className="cp-card">
        <h3>Applications needing review</h3>
        <div className="cp-rows">
          {queue.length === 0 ? (
            <p className="cp-empty">All caught up — nothing pending.</p>
          ) : (
            queue.map((a) => (
              <button
                className="cp-row"
                key={a.id}
                onClick={() => onNavigate('Applicants')}
                type="button"
              >
                <span className="cp-row-avatar">
                  {a.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()}
                </span>
                <div className="cp-row-main">
                  <p className="cp-row-name">{a.name}</p>
                  <p className="cp-muted">
                    {a.role} · Applied {a.applied}
                  </p>
                </div>
                <MatchBar value={a.match} />
                <StatusBadge status={a.status} />
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="cp-stat">
      <div className="cp-stat-top">
        <span className="cp-stat-label">{label}</span>
        <span
          className="cp-stat-icon"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
        >
          <Icon size={16} style={{ color }} />
        </span>
      </div>
      <p className="cp-stat-value">{value}</p>
    </div>
  )
}
