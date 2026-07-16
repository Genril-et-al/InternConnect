import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Search,
  Send,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../auth/context'
import { applications, internships } from '../lib/mockData'
import type { Application } from '../lib/mockData'
import './dashboard.css'

/**
 * Student dashboard (UC-S06) — application stats, profile completion,
 * AI-matched internships, and recent applications.
 * Note: Internship Duty Hours is intentionally not part of this dashboard.
 */
export function StudentDashboard({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { profile } = useAuth()

  const accepted = applications.filter((a) => a.status === 'Accepted').length
  const rejected = applications.filter((a) => a.status === 'Rejected').length
  const pending = applications.length - accepted - rejected

  const firstName = profile?.first_name?.trim() || 'there'

  // Profile completion — computed from the real profile record.
  const checklist = [
    { label: 'Skills', done: (profile?.skills?.length ?? 0) > 0 },
    { label: 'Specializations', done: (profile?.specializations?.length ?? 0) > 0 },
    { label: 'Photo', done: Boolean(profile?.photo_url) },
    { label: 'Resume', done: Boolean(profile?.resume_url) },
    {
      label: 'Portfolio',
      done: Boolean(profile?.portfolio_link || profile?.portfolio_file_url),
    },
    {
      label: 'Personal info',
      done: Boolean(
        profile?.age && profile?.gender && profile?.address && profile?.contact_number,
      ),
    },
  ]
  const doneCount = checklist.filter((c) => c.done).length
  const completionPct = Math.round((doneCount / checklist.length) * 100)

  return (
    <div className="sd-root">
      {/* Greeting */}
      <div className="sd-header">
        <div>
          <h1 className="sd-title">Good day, {firstName}!</h1>
          <p className="sd-subtitle">
            {pending > 0
              ? `You have ${pending} pending application${pending > 1 ? 's' : ''}.`
              : 'All applications resolved.'}
          </p>
        </div>
        <button className="sd-primary" onClick={() => onNavigate('Browse')} type="button">
          <Search size={14} /> Browse Internships
        </button>
      </div>

      {/* Stats */}
      <div className="sd-stats">
        <StatCard color="var(--brand-orange)" icon={Send} label="Applied" value={applications.length} />
        <StatCard color="var(--brand-orange)" icon={CheckCircle2} label="Accepted" value={accepted} />
        <StatCard color="var(--brand-orange-soft)" icon={Clock} label="Pending" value={pending} />
        <StatCard color="var(--brand-crimson)" icon={XCircle} label="Rejected" value={rejected} />
      </div>

      {/* Profile completion */}
      <section className="sd-card">
        <div className="sd-card-head">
          <div>
            <h3>Profile Completion</h3>
            <p className="sd-muted">Complete your profile to boost AI match scores</p>
          </div>
          <span className="sd-big-number">{completionPct}%</span>
        </div>
        <div className="sd-progress">
          <span style={{ width: `${completionPct}%` }} />
        </div>
        <div className="sd-checklist">
          {checklist.map((item) => (
            <span className={`sd-check ${item.done ? 'done' : ''}`} key={item.label}>
              {item.done ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {item.label}
            </span>
          ))}
        </div>
        {completionPct < 100 && (
          <button className="sd-link" onClick={() => onNavigate('Profile')} type="button">
            Complete your profile <ChevronRight size={12} />
          </button>
        )}
      </section>

      {/* AI matches */}
      <section className="sd-card">
        <div className="sd-card-head">
          <h3>AI-Matched Internships</h3>
          <button className="sd-link" onClick={() => onNavigate('Browse')} type="button">
            Browse all <ChevronRight size={12} />
          </button>
        </div>
        <div className="sd-list">
          {internships.slice(0, 3).map((job) => (
            <div className="sd-list-row" key={job.id}>
              <span className="sd-mark">{job.company.slice(0, 2).toUpperCase()}</span>
              <div className="sd-list-main">
                <p className="sd-list-title">{job.title}</p>
                <p className="sd-muted">
                  {job.company} · {job.location} · {job.setup}
                </p>
              </div>
              <MatchBar value={job.match} />
              <button className="sd-primary sm" onClick={() => onNavigate('Browse')} type="button">
                Apply
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Recent applications */}
      <section className="sd-card">
        <div className="sd-card-head">
          <h3>My Applications</h3>
          <button className="sd-link" onClick={() => onNavigate('Applications')} type="button">
            View all <ChevronRight size={12} />
          </button>
        </div>
        <div className="sd-list">
          {applications.length === 0 ? (
            <p className="sd-muted sd-empty">No applications yet.</p>
          ) : (
            applications.slice(0, 3).map((app) => (
              <div className="sd-list-row" key={app.id}>
                <span className="sd-mark dark">{app.company.slice(0, 2).toUpperCase()}</span>
                <div className="sd-list-main">
                  <p className="sd-list-title">{app.role}</p>
                  <p className="sd-muted">
                    {app.company} · Applied {app.dateApplied}
                  </p>
                </div>
                <StatusBadge status={app.status} />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function StatCard({
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
    <div className="sd-stat">
      <div className="sd-stat-top">
        <span className="sd-stat-label">{label}</span>
        <span className="sd-stat-icon" style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}>
          <Icon size={16} style={{ color }} />
        </span>
      </div>
      <p className="sd-stat-value">{value}</p>
    </div>
  )
}

function MatchBar({ value }: { value: number }) {
  const color =
    value >= 90
      ? 'var(--brand-orange)'
      : value >= 75
        ? 'var(--brand-orange-soft)'
        : 'var(--brand-brown)'
  return (
    <div className="sd-match">
      <div className="sd-match-track">
        <span style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="sd-match-value" style={{ color }}>
        {value}%
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: Application['status'] }) {
  const variant =
    status === 'Accepted'
      ? 'success'
      : status === 'Rejected'
        ? 'rejected'
        : status === 'Pending'
          ? 'pending'
          : 'info'
  return <span className={`sd-badge ${variant}`}>{status}</span>
}
