import { useMemo, useState } from 'react'
import { BarChart3, Download } from 'lucide-react'
import type { AdminAppStats, AdminCompany, AdminListing, AdminStudent } from './adminData'

type ReportType = 'applications' | 'postings' | 'placement' | 'participation'

const REPORT_TITLES: Record<ReportType, string> = {
  applications: 'Applications Report',
  postings: 'Internship Postings Report',
  placement: 'Placement Report',
  participation: 'Student Participation Report',
}

/** UC-A06 — Generate and export platform reports (live data). */
export function AdminReports({
  students,
  companies,
  listings,
  appStats,
}: {
  students: AdminStudent[]
  companies: AdminCompany[]
  listings: AdminListing[]
  appStats: AdminAppStats
}) {
  const REPORT_DATA: Record<ReportType, { label: string; value: string | number }[]> = useMemo(() => {
    const activeStudents = students.filter((s) => s.status === 'active').length
    const appliedOnce = students.filter((s) => s.applications > 0).length
    const activeCompanies = new Set(
      listings.filter((l) => l.status === 'open').map((l) => l.company),
    ).size
    return {
      applications: [
        { label: 'Total Applications', value: appStats.total },
        { label: 'Accepted', value: appStats.accepted },
        { label: 'Pending', value: appStats.pending },
        { label: 'Rejected', value: appStats.rejected },
      ],
      postings: [
        { label: 'Total Listings', value: listings.length },
        { label: 'Open', value: listings.filter((l) => l.status === 'open').length },
        { label: 'Closed', value: listings.filter((l) => l.status === 'closed').length },
        { label: 'Companies Active', value: activeCompanies },
      ],
      placement: [
        { label: 'Placed Students', value: appStats.accepted },
        {
          label: 'Acceptance Rate',
          value: appStats.total ? `${Math.round((appStats.accepted / appStats.total) * 100)}%` : '—',
        },
        { label: 'Verified Companies', value: companies.filter((c) => c.verification === 'verified').length },
        { label: 'Flagged Listings', value: listings.filter((l) => l.status === 'flagged').length },
      ],
      participation: [
        { label: 'Active Students', value: activeStudents },
        { label: 'Applied Once+', value: appliedOnce },
        { label: 'Rostered Students', value: students.length },
        {
          label: 'Registered',
          value: students.length
            ? `${Math.round((students.filter((s) => s.registered).length / students.length) * 100)}%`
            : '—',
        },
      ],
    }
  }, [students, companies, listings, appStats])

  const [reportType, setReportType] = useState<ReportType>('applications')
  const [industry, setIndustry] = useState('all')
  const [dateFrom, setDateFrom] = useState('2026-06-01')
  const [dateTo, setDateTo] = useState('2026-07-16')
  const [generated, setGenerated] = useState(false)

  function exportCsv() {
    const rows = [
      ['Report', REPORT_TITLES[reportType]],
      ['Industry', industry],
      ['Period', `${dateFrom} to ${dateTo}`],
      [],
      ['Metric', 'Value'],
      ...REPORT_DATA[reportType].map((r) => [r.label, String(r.value)]),
    ]
    const csv = rows.map((r) => r.map((cell) => `"${cell ?? ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `internconnect-${reportType}-report.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1 className="ad-title">Generate Reports</h1>
          <p className="ad-subtitle">Compile and export platform analytics</p>
        </div>
      </div>

      <section className="ad-card">
        <div className="ad-form-grid">
          <label>
            Report Type
            <select
              onChange={(e) => {
                setReportType(e.target.value as ReportType)
                setGenerated(false)
              }}
              value={reportType}
            >
              <option value="applications">Applications</option>
              <option value="postings">Internship Postings</option>
              <option value="placement">Placement</option>
              <option value="participation">Student Participation</option>
            </select>
          </label>
          <label>
            Industry
            <select onChange={(e) => setIndustry(e.target.value)} value={industry}>
              <option value="all">All Industries</option>
              <option value="software">Software</option>
              <option value="marketing">Marketing</option>
              <option value="business-intelligence">Business Intelligence</option>
              <option value="agriculture">Agriculture</option>
            </select>
          </label>
          <label>
            Date From
            <input onChange={(e) => setDateFrom(e.target.value)} type="date" value={dateFrom} />
          </label>
          <label>
            Date To
            <input onChange={(e) => setDateTo(e.target.value)} type="date" value={dateTo} />
          </label>
        </div>
        <div className="ad-actions">
          <button className="ad-primary" onClick={() => setGenerated(true)} type="button">
            <BarChart3 size={14} /> Generate Report
          </button>
          {generated && (
            <button className="ad-secondary" onClick={exportCsv} type="button">
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </section>

      {generated && (
        <section className="ad-card">
          <div className="ad-page-head" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>{REPORT_TITLES[reportType]}</h3>
            <p className="ad-muted">
              {dateFrom} to {dateTo}
            </p>
          </div>
          <div className="ad-report-tiles">
            {REPORT_DATA[reportType].map((item) => (
              <div className="ad-report-tile" key={item.label}>
                <p className="ad-quick-label">{item.label}</p>
                <p className="ad-quick-value">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
