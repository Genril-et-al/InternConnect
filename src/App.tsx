import { useMemo, useState } from 'react'
import {
  Briefcase,
  Bookmark,
  FileText,
  LayoutDashboard,
  LogOut,
  Search,
  User,
  Users,
} from 'lucide-react'
import './App.css'
import { useAuth } from './auth/context'
import { LoginPage } from './auth/LoginPage'
import { ProfileSetup } from './profile/ProfileSetup'
import { StudentDashboard } from './dashboard/StudentDashboard'
import { AdminApp } from './admin/AdminApp'
import { CompanyPortal } from './company/CompanyPortal'
import { applications, internships } from './lib/mockData'
import type { Internship, Application } from './lib/mockData'

type Role = 'student' | 'company' | 'admin'

// Admins have their own separate portal (src/admin/AdminApp.tsx).
const STUDENT_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Search, label: 'Browse Internships' },
  { icon: FileText, label: 'Applications' },
  { icon: User, label: 'Profile' },
]

const COMPANY_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Briefcase, label: 'Listings' },
  { icon: Users, label: 'Applicants' },
  { icon: User, label: 'Profile' },
]

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

  const navItems = role === 'student' ? STUDENT_NAV : COMPANY_NAV
  const portalLabel = role === 'student' ? 'Student Portal' : 'Company Portal'

  return (
    <main className="app-shell">
      <aside className="ad-sidebar" aria-label="Main navigation">
        <div className="ad-brand">
          <span className="ad-logo">IC</span>
          <div>
            <div className="ad-brand-name">InternConnect</div>
            <div className="ad-brand-sub">{portalLabel}</div>
          </div>
        </div>

        <nav className="ad-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={activeView === item.label ? 'active' : ''}
                key={item.label}
                onClick={() => setActiveView(item.label)}
                type="button"
              >
                <Icon size={16} /> {item.label}
              </button>
            )
          })}
        </nav>

        <div className="ad-user">
          <span className="ad-user-avatar">{initials || 'IC'}</span>
          <div className="ad-user-main">
            <p className="ad-user-name">{displayName}</p>
            <p className="ad-user-role">{roleLabel}</p>
          </div>
          <button aria-label="Sign out" className="ad-signout" onClick={signOut} type="button">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <section className="workspace">
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
  if (activeView === 'Browse Internships') return <BrowseInternships />
  if (activeView === 'Applications') return <StudentApplications />
  if (activeView === 'Profile') {
    return <ProfileSetup mode="edit" onDone={() => onNavigate('Dashboard')} />
  }

  return <StudentDashboard onNavigate={onNavigate} />
}

function BrowseInternships() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('All Locations')
  const [matchFilter, setMatchFilter] = useState('All')
  const [selectedInternship, setSelectedInternship] = useState<Internship | null>(null)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set())
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false)

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

  const matchOrder = ['90+', '80+', '70+', '60+', 'All']

  const filtered = useMemo(() => {
    const pillMin = matchThresholds[matchFilter] ?? 0

    return internships.filter((internship) => {
      const matchesQuery = [internship.title, internship.company, internship.industry, ...internship.skills]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase())
      const matchesLocation = location === 'All Locations' || internship.location === location
      const matchesScore = internship.match >= pillMin
      const matchesBookmarks = !showBookmarksOnly || bookmarkedIds.has(internship.id)
      return matchesQuery && matchesLocation && matchesScore && matchesBookmarks
    })
  }, [query, location, matchFilter, showBookmarksOnly, bookmarkedIds])

  const toggleBookmark = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setBookmarkedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
        <button
          aria-label="Toggle bookmarks filter"
          className={`browse-bookmark-toggle ${showBookmarksOnly ? 'active' : ''}`}
          onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
          title="Show bookmarked only"
          type="button"
        >
          <Bookmark fill={showBookmarksOnly ? 'currentColor' : 'none'} size={18} />
        </button>
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
      </div>

      {/* Match filter pills + result count */}
      <div className="browse-filters-row">
        <div className="browse-pills">
          <span className="browse-pills-label">Filter by match:</span>
          {matchOrder.map((key) => (
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
              isBookmarked={bookmarkedIds.has(internship.id)}
              key={internship.id}
              onClick={() => setSelectedInternship(internship)}
              onToggleBookmark={(e) => toggleBookmark(internship.id, e)}
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
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)

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
          application.status === 'Accepted' && application.requirements?.length ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{application.nextStep}</span>
              <button 
                type="button"
                className="sd-primary" 
                style={{ padding: '4px 8px', fontSize: '12px' }}
                onClick={() => setSelectedApp(application)}
              >
                View Requirements
              </button>
            </div>
          ) : (
            application.nextStep
          ),
        ])}
      />
      {selectedApp && <RequirementsModal application={selectedApp} onClose={() => setSelectedApp(null)} />}
    </div>
  )
}

function RequirementsModal({ application, onClose }: { application: Application, onClose: () => void }) {
  const [uploads, setUploads] = useState<Record<string, File>>({})
  
  const handleUpload = (id: string, file: File | null) => {
    if (file) setUploads({ ...uploads, [id]: file })
    else {
      const newUploads = { ...uploads }
      delete newUploads[id]
      setUploads(newUploads)
    }
  }

  const requirements = application.requirements || []
  
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" style={{ maxWidth: '500px', background: 'var(--surface)', borderRadius: '12px', padding: 0 }}>
        <div className="modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--brand-brown)' }}>Pre-employment Requirements</h3>
            <p className="muted" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>{application.company} - {application.role}</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
        
        <div style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
          {requirements.length === 0 ? (
            <p className="muted">No additional requirements.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {requirements.map((req) => (
                <div key={req.id} style={{ padding: '16px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <strong style={{ display: 'block', color: 'var(--text)' }}>{req.name}</strong>
                    {req.isPrintable && <span style={{ fontSize: '11px', background: 'var(--brand-orange-soft)', padding: '2px 6px', borderRadius: '4px', color: 'var(--brand-brown)' }}>Needs to be printed</span>}
                  </div>
                  
                  {req.type === 'text' ? (
                    <p className="muted" style={{ fontSize: '14px', margin: 0 }}>Please prepare this document as instructed by the company.</p>
                  ) : (
                    <div style={{ marginTop: '12px' }}>
                      <p className="muted" style={{ fontSize: '13px', marginBottom: '8px' }}>Please upload the requested file.</p>
                      <input 
                        type="file" 
                        onChange={e => handleUpload(req.id, e.target.files?.[0] || null)} 
                        style={{ fontSize: '13px' }}
                      />
                      {uploads[req.id] && <span style={{ color: 'var(--brand-orange)', fontSize: '13px', marginLeft: '8px' }}>✓ Attached</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="modal-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}>Close</button>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--brand-orange)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Submit Requirements</button>
        </div>
      </div>
    </div>
  )
}

function InternshipStrip({
  internship,
  onClick,
  isBookmarked,
  onToggleBookmark,
}: {
  internship: Internship
  onClick: () => void
  isBookmarked?: boolean
  onToggleBookmark?: (e: React.MouseEvent) => void
}) {
  return (
    <article className="internship-strip" role="button" tabIndex={0}>
      <div className="strip-top">
        <span className="strip-avatar">{internship.company.slice(0, 2).toUpperCase()}</span>
        <div className="strip-main">
          <h3>{internship.title}</h3>
          <p className="strip-subtitle">
            {internship.company} · {internship.location} · {internship.slots} slots · {internship.duration}
          </p>
          <p className="strip-summary">{internship.summary}</p>
          <div className="strip-tags">
            {internship.skills.slice(0, 3).map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </div>
        <div className="strip-right">
          <div className="strip-match-container">
            <span className="strip-match-label">AI Match</span>
            <div className="strip-match-bar">
              <div className="strip-match-track">
                <div className="strip-match-progress" style={{ width: `${internship.match}%` }} />
              </div>
              <span className="strip-match-text">{internship.match}%</span>
            </div>
          </div>
          <button
            aria-label="Bookmark"
            className={`strip-bookmark ${isBookmarked ? 'active' : ''}`}
            onClick={onToggleBookmark}
            type="button"
          >
            <Bookmark fill={isBookmarked ? 'currentColor' : 'none'} size={18} />
          </button>
          <button className="strip-apply-btn primary" type="button" onClick={onClick}>
            Apply
          </button>
        </div>
      </div>
      <div className="strip-bottom">
        <span className="strip-deadline">Deadline: {internship.deadline.replace(', 2026', '')}</span>
      </div>
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

function DataTable({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
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
