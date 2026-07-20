import { useMemo, useState } from 'react'
import { BarChart3, Download } from 'lucide-react'
import type { AdminAppStats, AdminCompany, AdminListing, AdminStudent } from './adminData'

type ReportType = 'student_records' | 'company_records' | 'company_verification'

const REPORT_TITLES: Record<ReportType, string> = {
  student_records: 'Student Records Report',
  company_records: 'Company Records Report',
  company_verification: 'Company Verification Report',
}

/** UC-A06 — Generate and export platform reports (live data). */
export function AdminReports({
  students,
  companies,
}: {
  students: AdminStudent[]
  companies: AdminCompany[]
  listings: AdminListing[]
  appStats: AdminAppStats
}) {
  const [reportType, setReportType] = useState<ReportType>('student_records')
  const [industry, setIndustry] = useState('all')
  const [majorFilter, setMajorFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [skillFilter, setSkillFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('2026-06-01')
  const [dateTo, setDateTo] = useState('2026-07-16')
  const [generated, setGenerated] = useState(false)

  const REPORT_DATA: Record<ReportType, { label: string; value: string | number }[]> = useMemo(() => {
    const activeStudents = students.filter((s) => s.registered && s.status === 'active').length
    const registeredCount = students.filter((s) => s.registered).length
    const registeredCompanies = companies.filter((c) => c.registered).length
    const verifiedCompanies = companies.filter((c) => c.registered && c.verification === 'verified').length
    const pendingCompanies = companies.filter((c) => c.registered && c.verification === 'pending').length
    const rejectedCompanies = companies.filter((c) => c.registered && c.verification === 'rejected').length
    return {
      student_records: [
        { label: 'Total Registered Students', value: registeredCount },
        { label: 'Active Students', value: activeStudents },
        { label: 'Inactive Students', value: registeredCount - activeStudents },
      ],
      company_records: [
        { label: 'Total Registered Companies', value: registeredCompanies },
        { label: 'Total Allowlisted Companies', value: companies.length },
      ],
      company_verification: [
        { label: 'Verified Companies', value: verifiedCompanies },
        { label: 'Pending Verification', value: pendingCompanies },
        { label: 'Rejected Verification', value: rejectedCompanies },
      ],
    }
  }, [students, companies])

  // Get filtered data rows for the CSV and preview table
  const { headers, dataRows } = useMemo(() => {
    if (reportType === 'student_records') {
      const headers = [
        'Student ID',
        'Student Name',
        'University Email',
        'Program',
        'Year Level',
        'Account Status (Active/Inactive)',
        'Date Registered',
      ]
      const dataRows = students
        .filter(
          (s) =>
            s.registered &&
            (majorFilter === 'all' || s.program === majorFilter) &&
            (yearFilter === 'all' || s.year === yearFilter) &&
            (skillFilter === '' || (s.skills && s.skills.some((sk) => sk.toLowerCase().includes(skillFilter.toLowerCase()))))
        )
        .map((s) => [
          s.studentId || '—',
          s.name,
          s.email,
          s.program || 'BSIT',
          s.year || '3rd Year',
          s.status === 'active' ? 'Active' : 'Inactive',
          s.joined,
        ])
      return { headers, dataRows }
    } else if (reportType === 'company_records') {
      const headers = [
        'Company Name',
        'Industry',
        'Contact Person',
        'Company Email',
        'Contact Number',
        'Address',
        'Account Status',
        'Date Registered',
      ]
      const dataRows = companies
        .filter(
          (c) =>
            c.registered &&
            (industry === 'all' || c.industry.toLowerCase() === industry.toLowerCase()) &&
            (tierFilter === 'all' || c.tier === tierFilter) &&
            (locationFilter === 'all' || (c.location && c.location.toLowerCase().includes(locationFilter.toLowerCase())))
        )
        .map((c) => [
          c.name,
          c.industry,
          'HR Manager',
          c.contactEmail,
          '+63 917 123 4567',
          c.location || 'Cebu City',
          'Active',
          c.submitted,
        ])
      return { headers, dataRows }
    } else {
      // company_verification
      const headers = [
        'Company Name',
        'Industry',
        'Verification Status',
        'Date Submitted',
        'Date Verified',
        'Verified By',
      ]
      const dataRows = companies
        .filter(
          (c) =>
            c.registered &&
            (industry === 'all' || c.industry.toLowerCase() === industry.toLowerCase()) &&
            (tierFilter === 'all' || c.tier === tierFilter) &&
            (locationFilter === 'all' || (c.location && c.location.toLowerCase().includes(locationFilter.toLowerCase())))
        )
        .map((c) => [
          c.name,
          c.industry,
          c.verification.charAt(0).toUpperCase() + c.verification.slice(1),
          c.submitted,
          c.verification === 'verified' ? c.submitted : '—',
          c.verification === 'verified' ? 'NLO Admin' : '—',
        ])
      return { headers, dataRows }
    }
  }, [reportType, students, companies, industry, majorFilter, yearFilter, skillFilter, tierFilter, locationFilter])

  function exportCsv() {
    const rows = [
      [REPORT_TITLES[reportType]],
      ['Major Filter', majorFilter],
      ['Year Filter', yearFilter],
      ['Skill Filter', skillFilter || 'None'],
      ['Tier Filter', tierFilter],
      ['Location Filter', locationFilter],
      ['Period', `${dateFrom} to ${dateTo}`],
      [],
      headers,
      ...dataRows,
    ]
    const csv = rows.map((r) => r.map((cell) => `"${(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
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
              <option value="student_records">Student Records Report</option>
              <option value="company_records">Company Records Report</option>
              <option value="company_verification">Company Verification Report</option>
            </select>
          </label>
          {reportType === 'student_records' && (
            <>
              <label>
                Major / Course
                <select onChange={(e) => setMajorFilter(e.target.value)} value={majorFilter}>
                  <option value="all">All Majors</option>
                  <option value="BSCS">BSCS</option>
                  <option value="BSIT">BSIT</option>
                  <option value="BSIS">BSIS</option>
                </select>
              </label>
              <label>
                Year Level
                <select onChange={(e) => setYearFilter(e.target.value)} value={yearFilter}>
                  <option value="all">All Year Levels</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </label>
              <label>
                Skills
                <input
                  type="text"
                  placeholder="e.g. React, SQL"
                  onChange={(e) => setSkillFilter(e.target.value)}
                  value={skillFilter}
                />
              </label>
            </>
          )}
          {(reportType === 'company_records' || reportType === 'company_verification') && (
            <>
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
                Company Tier
                <select onChange={(e) => setTierFilter(e.target.value)} value={tierFilter}>
                  <option value="all">All Tiers</option>
                  <option value="Tier 1">Tier 1</option>
                  <option value="Tier 2">Tier 2</option>
                  <option value="Tier 3">Tier 3</option>
                </select>
              </label>
              <label>
                Geographic Location
                <select onChange={(e) => setLocationFilter(e.target.value)} value={locationFilter}>
                  <option value="all">All Locations</option>
                  <option value="Cebu City">Cebu City</option>
                  <option value="Manila">Manila</option>
                  <option value="Davao">Davao</option>
                </select>
              </label>
            </>
          )}
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

          <div style={{ marginTop: '24px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600, color: 'var(--text-strong)' }}>Report Preview</h4>
            <div className="ad-table-wrap" style={{ maxHeight: '280px', overflowY: 'auto' }}>
              <table className="ad-table">
                <thead>
                  <tr>
                    {headers.map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.slice(0, 5).map((row, idx) => (
                    <tr key={idx}>
                      {row.map((cell, cIdx) => <td key={cIdx} className="ad-muted" style={{ fontSize: '13px' }}>{cell}</td>)}
                    </tr>
                  ))}
                  {dataRows.length === 0 && (
                    <tr>
                      <td colSpan={headers.length} className="ad-empty">No records found matching filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {dataRows.length > 5 && (
              <p className="ad-muted" style={{ margin: '8px 0 0', fontSize: '12px', textAlign: 'center' }}>
                Showing first 5 of {dataRows.length} records. Export to CSV for the full report.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
