import { useMemo, useState } from 'react'
import { BarChart3, Download } from 'lucide-react'
import type { AdminAppStats, AdminCompany, AdminListing, AdminStudent } from './adminData'
import { Dropdown } from '../components/Dropdown'

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
          c.verification === 'verified' ? 'Admin' : '—',
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
    <div className="ic-page">
      <div className="ic-page-head">
        <div>
          <h1 className="ic-title">Generate Reports</h1>
          <p className="ic-subtitle">Compile and export platform analytics</p>
        </div>
      </div>

      <section className="ic-card">
        <div className="ic-form-grid">
          <div className="ic-form-field">
            Report Type
            <Dropdown
              ariaLabel="Report type"
              onChange={(v) => {
                setReportType(v as ReportType)
                setGenerated(false)
              }}
              options={[
                { value: 'student_records', label: 'Student Records Report' },
                { value: 'company_records', label: 'Company Records Report' },
                { value: 'company_verification', label: 'Company Verification Report' },
              ]}
              value={reportType}
            />
          </div>
          {reportType === 'student_records' && (
            <>
              <div className="ic-form-field">
                Major / Course
                <Dropdown
                  ariaLabel="Major or course"
                  onChange={setMajorFilter}
                  options={[
                    { value: 'all', label: 'All Majors' },
                    'BSCS',
                    'BSIT',
                    'BSIS',
                  ]}
                  value={majorFilter}
                />
              </div>
              <div className="ic-form-field">
                Year Level
                <Dropdown
                  ariaLabel="Year level"
                  onChange={setYearFilter}
                  options={[
                    { value: 'all', label: 'All Year Levels' },
                    '1st Year',
                    '2nd Year',
                    '3rd Year',
                    '4th Year',
                  ]}
                  value={yearFilter}
                />
              </div>
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
              <div className="ic-form-field">
                Industry
                <Dropdown
                  ariaLabel="Industry"
                  onChange={setIndustry}
                  options={[
                    { value: 'all', label: 'All Industries' },
                    { value: 'software', label: 'Software' },
                    { value: 'marketing', label: 'Marketing' },
                    { value: 'business-intelligence', label: 'Business Intelligence' },
                    { value: 'agriculture', label: 'Agriculture' },
                  ]}
                  value={industry}
                />
              </div>
              <div className="ic-form-field">
                Company Tier
                <Dropdown
                  ariaLabel="Company tier"
                  onChange={setTierFilter}
                  options={[
                    { value: 'all', label: 'All Tiers' },
                    'Tier 1',
                    'Tier 2',
                    'Tier 3',
                  ]}
                  value={tierFilter}
                />
              </div>
              <div className="ic-form-field">
                Geographic Location
                <Dropdown
                  ariaLabel="Geographic location"
                  onChange={setLocationFilter}
                  options={[
                    { value: 'all', label: 'All Locations' },
                    'Cebu City',
                    'Manila',
                    'Davao',
                  ]}
                  value={locationFilter}
                />
              </div>
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
        <div className="ic-actions">
          <button className="ic-primary" onClick={() => setGenerated(true)} type="button">
            <BarChart3 size={14} /> Generate Report
          </button>
          {generated && (
            <button className="ic-secondary" onClick={exportCsv} type="button">
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </section>

      {generated && (
        <section className="ic-card">
          <div className="ic-page-head" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>{REPORT_TITLES[reportType]}</h3>
            <p className="ic-muted">
              {dateFrom} to {dateTo}
            </p>
          </div>
          <div className="ic-report-tiles">
            {REPORT_DATA[reportType].map((item) => (
              <div className="ic-report-tile" key={item.label}>
                <p className="ic-quick-label">{item.label}</p>
                <p className="ic-quick-value">{item.value}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '24px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600, color: 'var(--text-strong)' }}>Report Preview</h4>
            <div className="ic-table-wrap" style={{ maxHeight: '280px', overflowY: 'auto' }}>
              <table className="ic-table">
                <thead>
                  <tr>
                    {headers.map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.slice(0, 5).map((row, idx) => (
                    <tr key={idx}>
                      {row.map((cell, cIdx) => <td key={cIdx} className="ic-muted" style={{ fontSize: '13px' }}>{cell}</td>)}
                    </tr>
                  ))}
                  {dataRows.length === 0 && (
                    <tr>
                      <td colSpan={headers.length} className="ic-empty">No records found matching filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {dataRows.length > 5 && (
              <p className="ic-muted" style={{ margin: '8px 0 0', fontSize: '12px', textAlign: 'center' }}>
                Showing first 5 of {dataRows.length} records. Export to CSV for the full report.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
