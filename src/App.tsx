import { useMemo, useState } from 'react'
import './App.css'
import { useAuth } from './auth/context'
import { LoginPage } from './auth/LoginPage'
import { ProfileSetup } from './profile/ProfileSetup'
import { StudentDashboard } from './dashboard/StudentDashboard'
import { AdminApp } from './admin/AdminApp'
import { CompanyPortal } from './company/CompanyPortal'
import { applications, internships } from './lib/mockData'
import type { Internship } from './lib/mockData'

type Role = 'student' | 'company' | 'admin'

// Admins have their own separate portal (src/admin/AdminApp.tsx).
const navigation: Record<Exclude<Role, 'admin'>, string[]> = {
  student: ['Dashboard', 'Browse', 'Applications', 'Profile'],
  company: ['Dashboard', 'Listings', 'Applicants', 'Profile'],
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

  // Admins get their own portal, fully separate from the student/company workspace.
  if (profile.role === 'admin') {
    return <AdminApp />
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
        {role === 'company' && <CompanyPortal activeView={activeView} onNavigate={setActiveView} />}
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
  const [location, setLocation] = useState('All Locations')
  const [matchDropdown, setMatchDropdown] = useState('Any Match %')
  const [matchFilter, setMatchFilter] = useState('All')
  const [selectedInternship, setSelectedInternship] = useState<Internship | null>(null)
  const [showApplyModal, setShowApplyModal] = useState(false)

  // Derive unique locations from data
  const locations = useMemo(() => {
    const locs = Array.from(new Set(internships.map((i) => i.location)))
    return ['All Locations', ...locs.sort()]
  }, [])

  // Minimum match thresholds
  const matchThresholds: Record<string, number> = {
    'All': 0,
    '60+': 60,
    '70+': 70,
    '80+': 80,
    '90+': 90,
  }

  const matchDropdownThresholds: Record<string, number> = {
    'Any Match %': 0,
    '60% +': 60,
    '70% +': 70,
    '80% +': 80,
    '90% +': 90,
  }

  const filtered = useMemo(() => {
    const pillMin = matchThresholds[matchFilter] ?? 0
    const dropdownMin = matchDropdownThresholds[matchDropdown] ?? 0
    const minMatch = Math.max(pillMin, dropdownMin)

    return internships.filter((internship) => {
      const matchesQuery = [internship.title, internship.company, internship.industry, ...internship.skills]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase())
      const matchesLocation = location === 'All Locations' || internship.location === location
      const matchesScore = internship.match >= minMatch
      return matchesQuery && matchesLocation && matchesScore
    })
  }, [query, location, matchDropdown, matchFilter])

  // Detail view — full internship page
  if (selectedInternship && !showApplyModal) {
    return (
      <InternshipDetailView
        internship={selectedInternship}
        onBack={() => setSelectedInternship(null)}
        onApply={() => setShowApplyModal(true)}
      />
    )
  }

  // Apply modal overlay
  if (selectedInternship && showApplyModal) {
    return (
      <>
        <InternshipDetailView
          internship={selectedInternship}
          onBack={() => setSelectedInternship(null)}
          onApply={() => setShowApplyModal(true)}
        />
        <ApplyModal
          internship={selectedInternship}
          onClose={() => setShowApplyModal(false)}
        />
      </>
    )
  }

  return (
    <div className="browse-root">
      {/* Heading */}
      <div className="browse-heading">
        <h2 className="browse-title">Browse Internships</h2>
        <p className="browse-subtitle">AI-ranked by your resume skills</p>
      </div>

      {/* Search + dropdowns row */}
      <div className="browse-search-row">
        <div className="browse-search-field">
          <span className="browse-search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input
            aria-label="Search internships"
            className="browse-search-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, company, or skill..."
            value={query}
          />
        </div>
        <select
          aria-label="Location"
          className="browse-dropdown"
          onChange={(event) => setLocation(event.target.value)}
          value={location}
        >
          {locations.map((loc) => (
            <option key={loc}>{loc}</option>
          ))}
        </select>
        <select
          aria-label="Match percentage"
          className="browse-dropdown"
          onChange={(event) => setMatchDropdown(event.target.value)}
          value={matchDropdown}
        >
          <option>Any Match %</option>
          <option>60% +</option>
          <option>70% +</option>
          <option>80% +</option>
          <option>90% +</option>
        </select>
      </div>

      {/* Match filter pills + result count */}
      <div className="browse-filters-row">
        <div className="browse-pills">
          <span className="browse-pills-label">Filter by match:</span>
          {Object.keys(matchThresholds).map((key) => (
            <button
              className={`browse-pill ${matchFilter === key ? 'active' : ''}`}
              key={key}
              onClick={() => setMatchFilter(key)}
              type="button"
            >
              {key}
            </button>
          ))}
        </div>
        <span className="browse-result-count">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Listing strips */}
      <section className="listing-strips">
        {filtered.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
            No internships match your search.
          </p>
        ) : (
          filtered.map((internship) => (
            <InternshipStrip
              internship={internship}
              key={internship.id}
              onClick={() => setSelectedInternship(internship)}
            />
          ))
        )}
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

function InternshipStrip({ internship, onClick }: { internship: Internship; onClick: () => void }) {
  return (
    <article className="internship-strip" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}>
      <span className="company-mark">{internship.company.slice(0, 2).toUpperCase()}</span>
      <div className="strip-main">
        <h3>{internship.title}</h3>
        <p className="muted">{internship.company} · {internship.location} · {internship.setup}</p>
      </div>
      <div className="strip-tags">
        {internship.skills.slice(0, 3).map((skill) => (
          <span key={skill}>{skill}</span>
        ))}
      </div>
      <div className="strip-meta">
        <strong className="strip-match">{internship.match}% match</strong>
        <span className="muted">{internship.slots} slots · {internship.deadline}</span>
      </div>
      <span className={`status ${internship.status === 'Open' ? 'success' : 'warning'}`}>{internship.status}</span>
    </article>
  )
}

function InternshipDetailView({
  internship,
  onBack,
  onApply,
}: {
  internship: Internship
  onBack: () => void
  onApply: () => void
}) {
  return (
    <div className="detail-view">
      <button className="detail-back" onClick={onBack} type="button">
        ← Back to listings
      </button>

      <div className="detail-header">
        <span className="company-mark detail-mark">{internship.company.slice(0, 2).toUpperCase()}</span>
        <div>
          <h2 className="detail-title">{internship.title}</h2>
          <p className="muted">{internship.company} · {internship.industry}</p>
        </div>
        <span className={`status ${internship.status === 'Open' ? 'success' : 'warning'}`}>{internship.status}</span>
      </div>

      <div className="detail-body">
        <section className="detail-section">
          <h4>Description</h4>
          <p>{internship.summary}</p>
        </section>

        <div className="detail-info-grid">
          <div className="detail-info-item">
            <span className="detail-info-label">Location</span>
            <span className="detail-info-value">{internship.location}</span>
          </div>
          <div className="detail-info-item">
            <span className="detail-info-label">Work Setup</span>
            <span className="detail-info-value">{internship.setup}</span>
          </div>
          <div className="detail-info-item">
            <span className="detail-info-label">Duration</span>
            <span className="detail-info-value">{internship.duration}</span>
          </div>
          <div className="detail-info-item">
            <span className="detail-info-label">Deadline</span>
            <span className="detail-info-value">{internship.deadline}</span>
          </div>
          <div className="detail-info-item">
            <span className="detail-info-label">Available Slots</span>
            <span className="detail-info-value">{internship.slots}</span>
          </div>
          <div className="detail-info-item">
            <span className="detail-info-label">AI Match Score</span>
            <span className="detail-info-value detail-match">{internship.match}%</span>
          </div>
        </div>

        <section className="detail-section">
          <h4>Required Skills</h4>
          <div className="tag-row">
            {internship.skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </section>
      </div>

      <div className="detail-actions">
        <button className="primary detail-apply-btn" onClick={onApply} type="button">
          Apply Now
        </button>
      </div>
    </div>
  )
}

function ApplyModal({
  internship,
  onClose,
}: {
  internship: Internship
  onClose: () => void
}) {
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    setSubmitted(true)
    setTimeout(() => {
      onClose()
    }, 2000)
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel">
        {submitted ? (
          <div className="modal-success">
            <div className="modal-success-icon">✓</div>
            <h3>Application Submitted!</h3>
            <p className="muted">Your application for <strong>{internship.title}</strong> at {internship.company} has been sent.</p>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <h3>Apply for Internship</h3>
              <button className="modal-close" onClick={onClose} type="button">✕</button>
            </div>

            {/* Internship preview */}
            <div className="modal-preview">
              <div className="modal-preview-header">
                <span className="company-mark">{internship.company.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{internship.title}</strong>
                  <p className="muted">{internship.company} · {internship.location} · {internship.setup}</p>
                </div>
              </div>
              <div className="modal-preview-details">
                <span><strong>Duration:</strong> {internship.duration}</span>
                <span><strong>Deadline:</strong> {internship.deadline}</span>
                <span><strong>Match:</strong> {internship.match}%</span>
              </div>
            </div>

            {/* File attachments */}
            <div className="modal-uploads">
              <div className="modal-upload-field">
                <label htmlFor="resume-upload">
                  Resume <span className="required">*</span>
                </label>
                <div className={`upload-zone ${resumeFile ? 'has-file' : ''}`}>
                  {resumeFile ? (
                    <div className="upload-file-info">
                      <span className="upload-file-icon">📄</span>
                      <div>
                        <p className="upload-file-name">{resumeFile.name}</p>
                        <p className="muted">{(resumeFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button className="upload-remove" onClick={() => setResumeFile(null)} type="button">✕</button>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <span className="upload-icon">↑</span>
                      <p>Drop your resume here or <strong>browse</strong></p>
                      <p className="muted">PDF, DOC, or DOCX (max 5 MB)</p>
                    </div>
                  )}
                  <input
                    accept=".pdf,.doc,.docx"
                    id="resume-upload"
                    onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                    type="file"
                  />
                </div>
              </div>

              <div className="modal-upload-field">
                <label htmlFor="cover-letter-upload">
                  Cover Letter <span className="optional">(optional)</span>
                </label>
                <div className={`upload-zone ${coverLetterFile ? 'has-file' : ''}`}>
                  {coverLetterFile ? (
                    <div className="upload-file-info">
                      <span className="upload-file-icon">📄</span>
                      <div>
                        <p className="upload-file-name">{coverLetterFile.name}</p>
                        <p className="muted">{(coverLetterFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button className="upload-remove" onClick={() => setCoverLetterFile(null)} type="button">✕</button>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <span className="upload-icon">↑</span>
                      <p>Drop your cover letter here or <strong>browse</strong></p>
                      <p className="muted">PDF, DOC, or DOCX (max 5 MB)</p>
                    </div>
                  )}
                  <input
                    accept=".pdf,.doc,.docx"
                    id="cover-letter-upload"
                    onChange={(e) => setCoverLetterFile(e.target.files?.[0] ?? null)}
                    type="file"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={onClose} type="button">Cancel</button>
              <button
                className="primary"
                disabled={!resumeFile}
                onClick={handleSubmit}
                type="button"
              >
                Submit Application
              </button>
            </div>
          </>
        )}
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
