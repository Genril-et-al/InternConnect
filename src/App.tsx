import { useMemo, useState } from 'react'
import './App.css'

type Role = 'student' | 'company' | 'admin'
type Status =
  | 'Pending'
  | 'Under review'
  | 'Shortlisted'
  | 'Interview scheduled'
  | 'Accepted'
  | 'Rejected'

type Internship = {
  id: number
  title: string
  company: string
  industry: string
  location: string
  setup: 'Onsite' | 'Remote' | 'Hybrid'
  deadline: string
  duration: string
  slots: number
  match: number
  status: 'Open' | 'Closing soon' | 'Closed'
  skills: string[]
  summary: string
}

type Application = {
  id: number
  company: string
  role: string
  dateApplied: string
  status: Status
  nextStep: string
}

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

const internships: Internship[] = [
  {
    id: 1,
    title: 'Frontend Developer Intern',
    company: 'Arcway Labs',
    industry: 'Software',
    location: 'Cebu City',
    setup: 'Hybrid',
    deadline: 'Jul 29, 2026',
    duration: '480 hours',
    slots: 4,
    match: 94,
    status: 'Open',
    skills: ['React', 'TypeScript', 'UI QA'],
    summary: 'Build internal dashboards with a product team and ship small features weekly.',
  },
  {
    id: 2,
    title: 'Data Operations Intern',
    company: 'Harbor Analytics',
    industry: 'Business Intelligence',
    location: 'Mandaue',
    setup: 'Onsite',
    deadline: 'Jul 22, 2026',
    duration: '360 hours',
    slots: 3,
    match: 87,
    status: 'Closing soon',
    skills: ['SQL', 'Excel', 'Reporting'],
    summary: 'Clean operational datasets and prepare weekly placement reports.',
  },
  {
    id: 3,
    title: 'QA Automation Intern',
    company: 'Northstar Systems',
    industry: 'Software',
    location: 'Remote',
    setup: 'Remote',
    deadline: 'Aug 8, 2026',
    duration: '480 hours',
    slots: 2,
    match: 81,
    status: 'Open',
    skills: ['Testing', 'Playwright', 'Documentation'],
    summary: 'Write browser checks and document regression coverage for releases.',
  },
]

const applications: Application[] = [
  {
    id: 1,
    company: 'Arcway Labs',
    role: 'Frontend Developer Intern',
    dateApplied: 'Jul 10',
    status: 'Under review',
    nextStep: 'Company reviewed resume and portfolio.',
  },
  {
    id: 2,
    company: 'Cebu Fintech Group',
    role: 'Product Support Intern',
    dateApplied: 'Jul 7',
    status: 'Interview scheduled',
    nextStep: 'Interview on Jul 18, 10:00 AM.',
  },
  {
    id: 3,
    company: 'Harbor Analytics',
    role: 'Data Operations Intern',
    dateApplied: 'Jul 2',
    status: 'Pending',
    nextStep: 'Waiting for first company action.',
  },
]

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
  const [role, setRole] = useState<Role>('student')
  const [activeView, setActiveView] = useState('Dashboard')

  function changeRole(nextRole: Role) {
    setRole(nextRole)
    setActiveView('Dashboard')
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div>
          <p className="eyebrow">InternConnect</p>
          <h1>Internship matching workspace</h1>
        </div>

        <div className="role-switcher" aria-label="Choose portal">
          {(['student', 'company', 'admin'] as Role[]).map((item) => (
            <button
              className={role === item ? 'active' : ''}
              key={item}
              onClick={() => changeRole(item)}
              type="button"
            >
              {item}
            </button>
          ))}
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
          <span className="avatar">GS</span>
          <div>
            <strong>{role === 'student' ? 'Genril S.' : role === 'company' ? 'Arcway HR' : 'NLO Admin'}</strong>
            <span>{role === 'student' ? 'BSIT - 4th Year' : role === 'company' ? 'Verified company' : 'Coordinator'}</span>
          </div>
        </div>
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

        {role === 'student' && <StudentPortal activeView={activeView} />}
        {role === 'company' && <CompanyPortal activeView={activeView} />}
        {role === 'admin' && <AdminPortal activeView={activeView} />}
      </section>
    </main>
  )
}

function StudentPortal({ activeView }: { activeView: string }) {
  if (activeView === 'Browse') return <BrowseInternships />
  if (activeView === 'Applications') return <StudentApplications />
  if (activeView === 'Profile') return <StudentProfile />

  return (
    <div className="content-grid">
      <Metric label="Applied" value="12" detail="+3 this month" />
      <Metric label="Pending" value="5" detail="2 newly reviewed" />
      <Metric label="Accepted" value="1" detail="Offer awaiting decision" />
      <Metric label="Profile" value="82%" detail="Resume parsed for matching" />

      <section className="panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Recommended</p>
            <h3>High-match internships</h3>
          </div>
          <button type="button">View all</button>
        </div>
        <div className="card-row">
          {internships.slice(0, 2).map((internship) => (
            <InternshipCard internship={internship} key={internship.id} />
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">OJT progress</p>
        <h3>326 of 480 hours</h3>
        <Progress value={68} />
        <p className="muted">Projected completion: Sep 4, 2026</p>
      </section>

      <section className="panel">
        <p className="eyebrow">Recent activity</p>
        <ul className="activity-list">
          <li>Interview schedule received from Cebu Fintech Group.</li>
          <li>Arcway Labs viewed your portfolio.</li>
          <li>New React internship posted near Cebu City.</li>
        </ul>
      </section>
    </div>
  )
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

function StudentProfile() {
  return (
    <div className="content-grid">
      <section className="panel wide">
        <p className="eyebrow">Student information</p>
        <h3>Profile setup</h3>
        <div className="form-grid">
          <label>
            Full name
            <input defaultValue="Genril Theo Sorono" />
          </label>
          <label>
            University email
            <input defaultValue="genril.sorono@cit.edu" />
          </label>
          <label>
            Course
            <input defaultValue="BS Information Technology" />
          </label>
          <label>
            Skills
            <input defaultValue="React, TypeScript, SQL, Documentation" />
          </label>
        </div>
      </section>
      <section className="panel">
        <p className="eyebrow">Documents</p>
        <h3>Resume and portfolio</h3>
        <div className="document-box">resume_genril_2026.pdf</div>
        <div className="document-box">portfolio_site.zip</div>
      </section>
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
