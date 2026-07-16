import { useMemo, useState } from 'react'
import './App.css'
import { useAuth } from './auth/context'
import { LoginPage } from './auth/LoginPage'
import { ProfileSetup } from './profile/ProfileSetup'
import { StudentDashboard } from './dashboard/StudentDashboard'
import { applications, internships } from './lib/mockData'
import type { Internship } from './lib/mockData'

type Role = 'student' | 'company' | 'admin'

type CompanyListing = {
  id: number
  title: string
  status: 'Open' | 'Draft' | 'Closed'
  applicants: number
  pending: number
  deadline: string
}

type AdminCompany = {
  id: number
  name: string
  industry: string
  status: 'Verified' | 'Pending' | 'Rejected'
  documents: string
}

const companyListings: CompanyListing[] = [
  {
    id: 1,
    title: 'Frontend Developer Intern',
    status: 'Open',
    applicants: 28,
    pending: 11,
    deadline: 'Jul 29',
  },
  {
    id: 2,
    title: 'Technical Writer Intern',
    status: 'Draft',
    applicants: 0,
    pending: 0,
    deadline: 'Aug 5',
  },
  {
    id: 3,
    title: 'QA Automation Intern',
    status: 'Closed',
    applicants: 19,
    pending: 2,
    deadline: 'Jul 12',
  },
]

const adminCompanies: AdminCompany[] = [
  {
    id: 1,
    name: 'Arcway Labs',
    industry: 'Software',
    status: 'Verified',
    documents: 'Business permit, SEC registration',
  },
  {
    id: 2,
    name: 'Harbor Analytics',
    industry: 'Business Intelligence',
    status: 'Pending',
    documents: 'DTI registration pending review',
  },
  {
    id: 3,
    name: 'Cebu Design Studio',
    industry: 'Creative Services',
    status: 'Rejected',
    documents: 'Missing address verification',
  },
]

const navigation: Record<Role, string[]> = {
  student: ['Dashboard', 'Browse', 'Applications', 'Profile'],
  company: ['Dashboard', 'Listings', 'Applicants', 'Profile'],
  admin: ['Dashboard', 'Users', 'Companies', 'Reports'],
}

function App() {
  const { session, profile, loading, signOut } = useAuth()
  const [activeView, setActiveView] = useState('Dashboard')

  // Auth gate — resolve the session before deciding what to render.
  if (loading) {
    return (
      <div className="auth-loading">
        <p>Loading InternConnect…</p>
      </div>
    )
  }

  if (!session) {
    return <LoginPage />
  }

  // Signed in, but the profile row hasn't materialised (or was removed).
  if (!profile) {
    return (
      <div className="auth-loading">
        <p>Finishing account setup…</p>
        <button className="primary" onClick={signOut} type="button">
          Sign out
        </button>
      </div>
    )
  }

  // Deactivated by an admin (UC-A01).
  if (!profile.is_active) {
    return (
      <div className="auth-loading">
        <p>Your account has been deactivated. Please contact the NLO office.</p>
        <button className="primary" onClick={signOut} type="button">
          Sign out
        </button>
      </div>
    )
  }

  // New students finish profile setup before entering the workspace (UC-S01 → UC-S02).
  if (profile.role === 'student' && !profile.profile_completed) {
    return <ProfileSetup />
  }

  const role = profile.role
  const displayName = profile.full_name?.trim() || profile.email
  const initials = displayName
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
  const roleLabel =
    role === 'student' ? 'Student' : role === 'company' ? 'Company' : 'Coordinator'

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div>
          <p className="eyebrow">InternConnect</p>
          <h1>Internship matching workspace</h1>
        </div>

        <nav className="nav-list">
          {navigation[role].map((item) => (
            <button
              className={activeView === item ? 'active' : ''}
              key={item}
              onClick={() => setActiveView(item)}
              type="button"
            >
              <span>{item}</span>
              <span aria-hidden="true">/</span>
            </button>
          ))}
        </nav>

        <div className="profile-chip">
          <span className="avatar">{initials || 'IC'}</span>
          <div>
            <strong>{displayName}</strong>
            <span>{roleLabel}</span>
          </div>
        </div>
        <button className="sign-out" onClick={signOut} type="button">
          Sign out
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{role} portal</p>
            <h2>{activeView}</h2>
          </div>
          <div className="quick-actions">
            <button type="button">Notifications</button>
            <button className="primary" type="button">
              {role === 'student' ? 'Apply' : role === 'company' ? 'Post listing' : 'Generate report'}
            </button>
          </div>
        </header>

        {role === 'student' && <StudentPortal activeView={activeView} onNavigate={setActiveView} />}
        {role === 'company' && <CompanyPortal activeView={activeView} />}
        {role === 'admin' && <AdminPortal activeView={activeView} />}
      </section>
    </main>
  )
}

function StudentPortal({
  activeView,
  onNavigate,
}: {
  activeView: string
  onNavigate: (view: string) => void
}) {
  if (activeView === 'Browse') return <BrowseInternships />
  if (activeView === 'Applications') return <StudentApplications />
  if (activeView === 'Profile') {
    return <ProfileSetup mode="edit" onDone={() => onNavigate('Dashboard')} />
  }

  return <StudentDashboard onNavigate={onNavigate} />
}

function BrowseInternships() {
  const [query, setQuery] = useState('')
  const [setup, setSetup] = useState('All')

  const filtered = useMemo(() => {
    return internships.filter((internship) => {
      const matchesQuery = [internship.title, internship.company, internship.industry, ...internship.skills]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase())
      const matchesSetup = setup === 'All' || internship.setup === setup
      return matchesQuery && matchesSetup
    })
  }, [query, setup])

  return (
    <div className="stack">
      <section className="toolbar">
        <input
          aria-label="Search internships"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search role, company, skill, or industry"
          value={query}
        />
        <select aria-label="Work setup" onChange={(event) => setSetup(event.target.value)} value={setup}>
          <option>All</option>
          <option>Onsite</option>
          <option>Remote</option>
          <option>Hybrid</option>
        </select>
      </section>

      <section className="listing-grid">
        {filtered.map((internship) => (
          <InternshipCard internship={internship} key={internship.id} />
        ))}
      </section>
    </div>
  )
}

function StudentApplications() {
  const [status, setStatus] = useState('All')
  const visible = applications.filter((application) => status === 'All' || application.status === status)

  return (
    <div className="stack">
      <section className="toolbar">
        <select aria-label="Application status" onChange={(event) => setStatus(event.target.value)} value={status}>
          <option>All</option>
          <option>Pending</option>
          <option>Under review</option>
          <option>Interview scheduled</option>
          <option>Accepted</option>
          <option>Rejected</option>
        </select>
        <button type="button">Withdraw selected</button>
      </section>
      <DataTable
        columns={['Company', 'Position', 'Applied', 'Status', 'Next step']}
        rows={visible.map((application) => [
          application.company,
          application.role,
          application.dateApplied,
          application.status,
          application.nextStep,
        ])}
      />
    </div>
  )
}

function CompanyPortal({ activeView }: { activeView: string }) {
  if (activeView === 'Listings') return <CompanyListings />
  if (activeView === 'Applicants') return <CompanyApplicants />
  if (activeView === 'Profile') return <CompanyProfile />

  return (
    <div className="content-grid">
      <Metric label="Active listings" value="8" detail="3 closing this week" />
      <Metric label="Applicants" value="126" detail="+21 this week" />
      <Metric label="Pending review" value="37" detail="Needs action" />
      <Metric label="Accepted" value="14" detail="For onboarding" />
      <section className="panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Recruitment queue</p>
            <h3>Applications needing review</h3>
          </div>
          <button type="button">Bulk reject</button>
        </div>
        <DataTable
          columns={['Applicant', 'Role', 'Match', 'Status']}
          rows={[
            ['Maria A.', 'Frontend Developer Intern', '92%', 'Shortlisted'],
            ['Althea K.', 'QA Automation Intern', '88%', 'Under review'],
            ['Chielsea N.', 'Technical Writer Intern', '84%', 'Pending'],
          ]}
        />
      </section>
    </div>
  )
}

function CompanyListings() {
  return (
    <div className="stack">
      <section className="toolbar">
        <input aria-label="Search listings" placeholder="Search listing title or status" />
        <button className="primary" type="button">Post new listing</button>
      </section>
      <DataTable
        columns={['Listing', 'Status', 'Applicants', 'Pending', 'Deadline']}
        rows={companyListings.map((listing) => [
          listing.title,
          listing.status,
          String(listing.applicants),
          String(listing.pending),
          listing.deadline,
        ])}
      />
    </div>
  )
}

function CompanyApplicants() {
  return (
    <div className="content-grid">
      <section className="panel wide">
        <p className="eyebrow">Applicant review</p>
        <h3>Selected application</h3>
        <div className="applicant-layout">
          <div>
            <strong>Maria Faith Antigua</strong>
            <p className="muted">React, TypeScript, UI testing - 92% match</p>
            <p>Resume, portfolio, certificates, and cover letter are attached.</p>
          </div>
          <div className="button-stack">
            <button className="primary" type="button">Shortlist</button>
            <button type="button">Schedule interview</button>
            <button type="button">Message</button>
            <button type="button">Reject</button>
          </div>
        </div>
      </section>
    </div>
  )
}

function CompanyProfile() {
  return (
    <section className="panel">
      <p className="eyebrow">Verification</p>
      <h3>Arcway Labs</h3>
      <span className="status success">Verified</span>
      <p className="muted">Business permit and SEC registration reviewed by NLO.</p>
    </section>
  )
}

function AdminPortal({ activeView }: { activeView: string }) {
  if (activeView === 'Companies') return <AdminCompanies />
  if (activeView === 'Users') return <AdminUsers />
  if (activeView === 'Reports') return <AdminReports />

  return (
    <div className="content-grid">
      <Metric label="Students" value="1,284" detail="94 active today" />
      <Metric label="Companies" value="86" detail="7 pending approval" />
      <Metric label="Internships" value="143" detail="112 active" />
      <Metric label="Applications" value="3,420" detail="This period" />
      <section className="panel wide">
        <p className="eyebrow">Pending approvals</p>
        <h3>Company verification queue</h3>
        <DataTable
          columns={['Company', 'Industry', 'Status', 'Documents']}
          rows={adminCompanies.map((company) => [
            company.name,
            company.industry,
            company.status,
            company.documents,
          ])}
        />
      </section>
    </div>
  )
}

function AdminUsers() {
  return (
    <DataTable
      columns={['Name', 'Type', 'Status', 'Action']}
      rows={[
        ['EJ Kate Alcover', 'Student', 'Active', 'Reset password'],
        ['Northstar Systems', 'Company', 'Active', 'Deactivate'],
        ['Cebu Design Studio', 'Company', 'Pending', 'Review'],
      ]}
    />
  )
}

function AdminCompanies() {
  return (
    <div className="stack">
      <section className="toolbar">
        <input aria-label="Search companies" placeholder="Search company or industry" />
        <button className="primary" type="button">Add NLO company</button>
      </section>
      <DataTable
        columns={['Company', 'Industry', 'Verification', 'Documents']}
        rows={adminCompanies.map((company) => [
          company.name,
          company.industry,
          company.status,
          company.documents,
        ])}
      />
    </div>
  )
}

function AdminReports() {
  return (
    <div className="content-grid">
      <section className="panel">
        <p className="eyebrow">Reports</p>
        <h3>Generate report</h3>
        <div className="form-grid single">
          <label>
            Report type
            <select defaultValue="Applications">
              <option>Applications</option>
              <option>Internship postings</option>
              <option>Placement</option>
              <option>Student participation</option>
            </select>
          </label>
          <label>
            Period
            <input defaultValue="July 2026" />
          </label>
        </div>
        <button className="primary" type="button">Export CSV</button>
      </section>
      <section className="panel">
        <p className="eyebrow">Status breakdown</p>
        <div className="bar-list">
          <Progress label="Pending" value={42} />
          <Progress label="Accepted" value={28} />
          <Progress label="Rejected" value={30} />
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <section className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </section>
  )
}

function InternshipCard({ internship }: { internship: Internship }) {
  return (
    <article className="internship-card">
      <div className="card-topline">
        <span className="company-mark">{internship.company.slice(0, 2).toUpperCase()}</span>
        <span className={`status ${internship.status === 'Open' ? 'success' : 'warning'}`}>{internship.status}</span>
      </div>
      <h3>{internship.title}</h3>
      <p className="muted">{internship.company} - {internship.location} - {internship.setup}</p>
      <p>{internship.summary}</p>
      <div className="tag-row">
        {internship.skills.map((skill) => (
          <span key={skill}>{skill}</span>
        ))}
      </div>
      <div className="card-footer">
        <strong>{internship.match}% match</strong>
        <span>{internship.slots} slots</span>
        <span>{internship.deadline}</span>
      </div>
    </article>
  )
}

function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="progress-block">
      {label && (
        <div className="progress-label">
          <span>{label}</span>
          <span>{value}%</span>
        </div>
      )}
      <div className="progress-track">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row[0]}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default App
