import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Briefcase,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  Menu,
  FileText,
  LayoutDashboard,
  Link2,
  LogOut,
  Search,
  Upload,
  Users,
  XCircle,
} from 'lucide-react'
import './App.css'
import { useAuth } from './auth/context'
import { LoginPage } from './auth/LoginPage'
import { ResetPasswordPage } from './auth/ResetPasswordPage'
import { ProfileSetup } from './profile/ProfileSetup'
import { StudentDashboard } from './dashboard/StudentDashboard'
import { AdminApp } from './admin/AdminApp'
import { CompanyPortal } from './company/CompanyPortal'
import type { Internship, Application, ApplicationStatus } from './lib/mockData'
import {
  applyToListing,
  fetchBookmarks,
  fetchMyApplications,
  fetchOpenListings,
  matchPool,
  setBookmarked,
  acceptOffer,
  rejectOffer,
  withdrawAcceptance,
  submitRequirementFile,
  submitRequirementText,
} from './lib/listingsApi'
import type { PreEmploymentRequirement } from './lib/mockData'
import { useSidebarCollapsed } from './lib/useSidebar'
import { SignOutButton } from './components/SignOutButton'
import { Avatar } from './components/Avatar'
import { signedDocumentUrl } from './lib/profile'
import { requestLeave } from './lib/unsavedGuard'

// Admins have their own separate portal (src/admin/AdminApp.tsx).
// Profile isn't a nav item — users open their own profile from the account
// card at the bottom of the sidebar.
const STUDENT_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Search, label: 'Browse Internships' },
  { icon: FileText, label: 'Applications' },
]

const COMPANY_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Briefcase, label: 'Listings' },
  { icon: Users, label: 'Applicants' },
]

function App() {
  const { session, profile, loading, recovery, signOut } = useAuth()
  const [activeView, setActiveView] = useState('Dashboard')
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()

  // Every view switch goes through here so a form holding unsaved work (the
  // profile editor) can confirm before it's discarded. When nothing is
  // unsaved the switch happens immediately.
  function requestView(view: string) {
    if (view === activeView) return
    requestLeave(() => setActiveView(view))
  }

  // Auth gate — resolve the session before deciding what to render.
  if (loading) {
    return (
      <div className="auth-loading">
        <span className="ic-spinner" aria-hidden="true" />
        <p>Loading InternConnect…</p>
      </div>
    )
  }

  if (!session) {
    return <LoginPage />
  }

  // Arrived from a password-recovery email — set the new password before
  // anything else, since the link's session is only meant for that.
  if (recovery) {
    return <ResetPasswordPage />
  }

  // Signed in, but the profile row hasn't materialised (or was removed).
  if (!profile) {
    return (
      <div className="auth-loading">
        <span className="ic-spinner" aria-hidden="true" />
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
  const roleLabel =
    role === 'student' ? 'Student' : role === 'company' ? 'Company' : 'Coordinator'

  const navItems = role === 'student' ? STUDENT_NAV : COMPANY_NAV
  const portalLabel = role === 'student' ? 'Student Portal' : 'Company Portal'

  return (
    <main className={`app-shell${collapsed ? ' sb-collapsed' : ''}`}>
      <aside className="ad-sidebar" aria-label="Main navigation">
        <div className="ad-brand">
          <img className="ad-logo" src="/logo.png" alt="InternConnect" />
          <div className="ad-brand-text">
            <div className="ad-brand-name">InternConnect</div>
            <div className="ad-brand-sub">{portalLabel}</div>
          </div>
          <button
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="ad-collapse"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="ad-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={activeView === item.label ? 'active' : ''}
                key={item.label}
                onClick={() => requestView(item.label)}
                title={item.label}
                type="button"
              >
                <Icon size={16} /> <span className="ad-nav-label">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="ad-user">
          <button
            className={`ad-user-trigger${activeView === 'Profile' ? ' active' : ''}`}
            onClick={() => requestView('Profile')}
            title="View your profile"
            type="button"
          >
            <Avatar className="ad-user-avatar" name={displayName} photoUrl={profile.photo_url} />
            <div className="ad-user-main">
              <p className="ad-user-name">{displayName}</p>
              <p className="ad-user-role">{roleLabel}</p>
            </div>
          </button>
          <SignOutButton ariaLabel="Sign out" className="ad-signout">
            <LogOut size={15} />
          </SignOutButton>
        </div>
      </aside>

      <section className="workspace">
        {role === 'student' && <StudentPortal activeView={activeView} onNavigate={requestView} />}
        {role === 'company' && <CompanyPortal activeView={activeView} onNavigate={requestView} />}
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
  const { profile } = useAuth()
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [applicationFilter, setApplicationFilter] = useState('All')
  const [selectedInternship, setSelectedInternship] = useState<Internship | null>(null)
  const [highlightedAppId, setHighlightedAppId] = useState<string | null>(null)

  // Live data — listings, my applications, my bookmarks (UC-S03..S05).
  const [internships, setInternships] = useState<Internship[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const userId = profile?.id
  // Compared by value, not reference: every refreshProfile() hands back a new
  // profile object with new (but usually identical) arrays, and keying the
  // refresh on those references made the whole portal flip back to its loading
  // state — unmounting whatever view the student was working in.
  const matchKey = JSON.stringify([profile?.skills ?? [], profile?.specializations ?? []])

  const refresh = useCallback(async () => {
    if (!userId) return
    const [skills, specializations] = JSON.parse(matchKey) as [string[], string[]]
    const [l, a, b] = await Promise.all([
      // Match against the full profile pool: resume-extracted skills plus any
      // manually added skills and specializations.
      fetchOpenListings(matchPool(skills, specializations)),
      fetchMyApplications(userId),
      fetchBookmarks(userId),
    ])
    setInternships(l)
    setApplications(a)
    setBookmarkedIds(b)
  }, [userId, matchKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // `loading` starts true and is cleared in the finally below, so only the
      // first load shows the spinner. Later refetches (a profile save, an
      // apply) swap the data in underneath whatever view is open rather than
      // unmounting it.
      setLoadError(null)
      try {
        await refresh()
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load internships.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const handleToggleBookmark = useCallback(
    (listingId: string) => {
      if (!userId) return
      const willBookmark = !bookmarkedIds.has(listingId)
      // Optimistic — revert on failure.
      setBookmarkedIds((prev) => {
        const next = new Set(prev)
        if (willBookmark) next.add(listingId)
        else next.delete(listingId)
        return next
      })
      setBookmarked(userId, listingId, willBookmark).catch(() => {
        setBookmarkedIds((prev) => {
          const next = new Set(prev)
          if (willBookmark) next.delete(listingId)
          else next.add(listingId)
          return next
        })
      })
    },
    [userId, bookmarkedIds],
  )

  // Derived so the open progress modal stays fresh when applications refresh.
  const selectedApp = selectedAppId
    ? (applications.find((a) => a.id === selectedAppId) ?? null)
    : null
  const openProgress = (app: Application) => setSelectedAppId(app.id)

  const handleApply = useCallback(
    async (listingId: string) => {
      if (!userId) throw new Error('Not signed in.')
      await applyToListing(userId, listingId)
      await refresh()
    },
    [userId, refresh],
  )

  const handleNavigate = (view: string) => {
    onNavigate(view)
    if (view !== 'Applications') {
      setApplicationFilter('All')
    }
    if (view !== 'Browse Internships') {
      setSelectedInternship(null)
    }
  }

  if (loading) {
    return <div className="auth-loading"><span className="ic-spinner" aria-hidden="true" /><p>Loading internships…</p></div>
  }
  if (loadError) {
    return <div className="auth-loading"><p>{loadError}</p></div>
  }

  return (
    <>
      {activeView === 'Browse Internships' && (
        <BrowseInternships
          internships={internships}
          appliedIds={new Set(applications.map((a) => a.internshipId))}
          bookmarkedIds={bookmarkedIds}
          onToggleBookmark={handleToggleBookmark}
          onApply={handleApply}
          selectedInternship={selectedInternship}
          onSelectInternship={setSelectedInternship}
        />
      )}
      {activeView === 'Applications' && <StudentApplications applications={applications} onOpenProgress={openProgress} filter={applicationFilter} onFilterChange={setApplicationFilter} highlightedAppId={highlightedAppId} />}
      {activeView === 'Profile' && <ProfileSetup mode="edit" onDone={() => handleNavigate('Dashboard')} />}
      {activeView === 'Dashboard' && (
        <StudentDashboard
          internships={internships}
          applications={applications}
          onNavigate={handleNavigate}
          onOpenProgress={openProgress} 
          onFilterApplications={(filter) => {
            setApplicationFilter(filter)
            onNavigate('Applications') // Use raw onNavigate so we don't reset
          }}
          onOpenInternship={(id) => {
            const internship = internships.find(i => i.id === id)
            if (internship) {
              setSelectedInternship(internship)
              onNavigate('Browse Internships')
            }
          }}
          onHighlightApplication={(id) => {
            setHighlightedAppId(id)
            if (id) setTimeout(() => setHighlightedAppId(null), 3000)
          }}
        />
      )}
      
      {selectedApp && (
        <ProgressModal
          application={selectedApp}
          internships={internships}
          userId={userId}
          onSubmitted={() => refresh().catch(() => {})}
          onClose={() => setSelectedAppId(null)}
        />
      )}
    </>
  )
}

// Minimum match thresholds. Module-scope so the object identity is stable —
// as a component-body literal it was a new object every render, which the
// filter useMemo below cannot list as a dependency without re-running always.
const matchThresholds: Record<string, number> = {
  'All': 0,
  '60+': 60,
  '70+': 70,
  '80+': 80,
  '90+': 90,
}

const matchOrder = ['90+', '80+', '70+', '60+', 'All']

function BrowseInternships({
  internships,
  appliedIds,
  bookmarkedIds,
  onToggleBookmark,
  onApply,
  selectedInternship,
  onSelectInternship
}: {
  internships: Internship[]
  appliedIds: Set<string>
  bookmarkedIds: Set<string>
  onToggleBookmark: (listingId: string) => void
  onApply: (listingId: string) => Promise<void>
  selectedInternship: Internship | null
  onSelectInternship: (internship: Internship | null) => void
}) {
  const [query, setQuery] = useState('')
  const [searchField, setSearchField] = useState('All')
  const [matchFilter, setMatchFilter] = useState('All')
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false)
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    const pillMin = matchThresholds[matchFilter] ?? 0

    return internships.filter((internship) => {
      let textToSearch: string;
      if (searchField === 'Title') textToSearch = internship.title
      else if (searchField === 'Company') textToSearch = internship.company
      else if (searchField === 'Location') textToSearch = internship.location
      else if (searchField === 'Skill') textToSearch = internship.skills.join(' ')
      else textToSearch = [internship.title, internship.company, internship.industry, ...internship.skills, internship.location].join(' ')

      const matchesQuery = textToSearch.toLowerCase().includes(query.toLowerCase())
      // An unscored listing can only satisfy the "All" pill.
      const matchesScore = internship.match === null 
        ? pillMin === 0 
        : (internship.match >= pillMin && internship.match > 0)
      const matchesBookmarks = !showBookmarksOnly || bookmarkedIds.has(internship.id)
      return matchesQuery && matchesScore && matchesBookmarks
    })
  }, [internships, query, searchField, matchFilter, showBookmarksOnly, bookmarkedIds])

  // Nothing could be scored — the profile carries no skills the AI or the
  // student has supplied.
  const unscored = internships.length > 0 && internships.every((i) => i.match === null)

  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleBookmark(id)
  }

  // Detail view — full internship page
  if (selectedInternship && !showApplyModal) {
    return (
      <InternshipDetailView
        internship={selectedInternship}
        alreadyApplied={appliedIds.has(selectedInternship.id)}
        onBack={() => onSelectInternship(null)}
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
          alreadyApplied={appliedIds.has(selectedInternship.id)}
          onBack={() => onSelectInternship(null)}
          onApply={() => setShowApplyModal(true)}
        />
        <ApplyModal
          internship={selectedInternship}
          onSubmit={() => onApply(selectedInternship.id)}
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
        <p className="browse-subtitle">
          {unscored ? 'Ranked once your skills are on file' : 'Ranked by how well your skills match'}
        </p>
      </div>

      {unscored && (
        <p className="browse-unscored" role="status">
          No match scores yet — we could not read any skills from your resume. Add skills and
          specializations on your profile, or upload a resume the AI can read, and the
          percentages will appear here automatically.
        </p>
      )}

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
            placeholder={searchField === 'All' ? "Search by title, company, skill, or location..." : `Search by ${searchField.toLowerCase()}...`}
            value={query}
          />
          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
          <div style={{ position: 'relative', height: '100%' }} ref={dropdownRef}>
            <button 
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{ 
                margin: 0, 
                border: 'none', 
                background: 'transparent', 
                fontWeight: 600, 
                color: 'var(--text)', 
                cursor: 'pointer',
                padding: '0 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '100%',
                outline: 'none',
                fontSize: '14px'
              }}
            >
              {searchField}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {isDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                zIndex: 100,
                minWidth: '140px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {['All', 'Location', 'Title', 'Company', 'Skill'].map(opt => (
                  <div 
                    key={opt}
                    role="button"
                    tabIndex={0}
                    onClick={() => { setSearchField(opt); setIsDropdownOpen(false) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setSearchField(opt); setIsDropdownOpen(false) } }}
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: searchField === opt ? 'var(--accent)' : 'var(--text)',
                      background: searchField === opt ? 'var(--accent-soft)' : 'transparent',
                      fontWeight: searchField === opt ? 600 : 400,
                      transition: 'background 0.2s',
                      userSelect: 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (searchField !== opt) e.currentTarget.style.background = 'var(--surface-strong)'
                    }}
                    onMouseLeave={(e) => {
                      if (searchField !== opt) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            )}
          </div>
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
              onClick={() => onSelectInternship(internship)}
              onToggleBookmark={(e) => toggleBookmark(internship.id, e)}
            />
          ))
        )}
      </section>
    </div>
  )
}

/**
 * Statuses that get their own tab on My Applications. Typed as
 * ApplicationStatus so a renamed status breaks the build rather than leaving a
 * tab that silently matches nothing -- the filter compares the label against
 * application.status directly.
 */
const FILTER_STATUSES: ApplicationStatus[] = ['Pending', 'Accepted', 'Rejected', 'Withdrawn']

/** Accepted sorts to the top of My Applications; all other statuses hold their order. */
const statusRank = (status: ApplicationStatus): number => (status === 'Accepted' ? 0 : 1)

/**
 * Badge colour per status. Keyed by ApplicationStatus rather than matched with
 * an if-chain so that adding a status to the union fails the build here instead
 * of silently falling through to the neutral badge -- which is exactly what
 * happened to 'Withdrawn', styled as if it were still live.
 */
const STATUS_BADGE: Record<ApplicationStatus, string> = {
  Pending: 'pending',
  'Under review': 'warning',
  Shortlisted: 'pending',
  'Interview scheduled': 'warning',
  Offered: 'success',
  Accepted: 'success',
  Rejected: 'error',
  Discarded: 'error',
  Withdrawn: 'error',
}

function ApplicationStrip({ application, onClick, isHighlighted, isShaded }: { application: Application; onClick: () => void; isHighlighted?: boolean; isShaded?: boolean }) {
  const statusClass = STATUS_BADGE[application.status] ?? 'pending'

  return (
    <article className={`application-strip ${isHighlighted ? 'highlighted' : ''} ${isShaded ? 'shaded' : ''}`} role="button" tabIndex={0} onClick={isShaded ? undefined : onClick}>
      {application.companyLogo ? (
        <img src={application.companyLogo} alt={application.company} className="strip-avatar" style={{ objectFit: 'contain' }} />
      ) : (
        <span className="strip-avatar">{application.company.slice(0, 2).toUpperCase()}</span>
      )}
      <div className="strip-main">
        <h3>{application.role}</h3>
        <p className="strip-subtitle">
          {application.company} · Applied {application.dateApplied}
        </p>
      </div>
      <div className="strip-right">
        <span className={`status ${statusClass}`}>{application.status}</span>
      </div>
    </article>
  )
}

function ProgressModal({
  application,
  internships,
  userId,
  onSubmitted,
  onClose,
}: {
  application: Application
  internships: Internship[]
  userId?: string
  onSubmitted?: () => void
  onClose: () => void
}) {
  const internship = useMemo(() => internships.find(i => i.id === application.internshipId), [internships, application.internshipId])

  // In-app confirmation for offer/acceptance actions (replaces window.confirm).
  const [confirmAction, setConfirmAction] = useState<'accept' | 'decline' | 'withdraw' | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const confirmCopy = {
    accept: {
      title: 'Accept Offer',
      message: 'Are you sure you want to accept this offer? All other pending applications and offers will be discarded.',
      cta: 'Accept Offer',
      danger: false,
    },
    decline: {
      title: 'Decline Offer',
      message: 'Are you sure you want to decline this offer?',
      cta: 'Decline Offer',
      danger: true,
    },
    withdraw: {
      title: 'Withdraw Acceptance',
      message: 'Are you sure you want to withdraw your acceptance? This will cancel your internship and restore any discarded applications.',
      cta: 'Withdraw',
      danger: true,
    },
  } as const

  async function runConfirmedAction() {
    if (!confirmAction || confirmBusy) return
    setConfirmBusy(true)
    setConfirmError(null)
    try {
      if (confirmAction === 'accept') {
        if (!userId) return
        await acceptOffer(userId, application.id)
      } else if (confirmAction === 'decline') {
        await rejectOffer(application.id)
      } else {
        if (!userId) return
        await withdrawAcceptance(userId, application.id)
      }
      setConfirmAction(null)
      onSubmitted?.()
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setConfirmBusy(false)
    }
  }

  const rejectedAtInterview = application.status === 'Rejected' && !!application.nextStep
  const steps = [
    { label: 'Application Submitted', active: true, done: true },
    { label: 'Under Review', active: application.status !== 'Pending', done: application.status !== 'Pending', status: (application.status === 'Rejected' && !application.nextStep) ? 'error' : '' },
    { 
      label: 'Interview', 
      active: ['Interview scheduled', 'Offered', 'Accepted'].includes(application.status) || rejectedAtInterview, 
      done: ['Interview scheduled', 'Offered', 'Accepted'].includes(application.status) || rejectedAtInterview,
      status: application.status === 'Interview scheduled' ? 'warning' : (rejectedAtInterview ? 'error' : '') 
    },
    { label: 'Offer Extended', active: ['Offered', 'Accepted'].includes(application.status), done: ['Offered', 'Accepted'].includes(application.status), status: application.status === 'Offered' ? 'warning' : '' },
    { label: 'Pre-Employment Requirements', active: application.status === 'Accepted' && (application.approvedRequirements || 0) < (application.requirements?.length || 0), done: application.status === 'Accepted' && application.approvedRequirements === application.requirements?.length },
    { label: 'Ready to Start', active: application.status === 'Accepted' && application.approvedRequirements === application.requirements?.length, done: false },
    { label: 'Internship Started', active: false, done: false },
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel progress-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button">×</button>
        
        {internship && (
          <div className="progress-header-card">
            <div className="progress-header-main">
              <h2>{application.role}</h2>
              <p>{application.company}</p>
              <div className="progress-header-meta">
                <span>📍 {internship.location}</span>
                <span>📅 Starts Aug 4, 2026</span>
                <span>⏱️ {internship.duration}</span>
              </div>
            </div>
            {application.status === 'Accepted' && (
              <span className="status success">
                <CheckCircle2 size={14} style={{ marginRight: 4 }} />
                Application Accepted
              </span>
            )}
            {application.status === 'Offered' && (
              <span className="status success">
                <CheckCircle2 size={14} style={{ marginRight: 4 }} />
                Offer Extended
              </span>
            )}
            {application.status === 'Pending' && (
              <span className="status warning">
                Pending
              </span>
            )}
            {application.status === 'Interview scheduled' && (
              <span className="status warning">
                Interview Scheduled
              </span>
            )}
            {application.status === 'Rejected' && (
              <span className="status error">
                Rejected
              </span>
            )}
            {application.status === 'Discarded' && (
              <span className="status error">
                Discarded
              </span>
            )}
            {application.status === 'Withdrawn' && (
              <span className="status error">
                Withdrawn
              </span>
            )}
          </div>
        )}

        <div className="progress-stepper-card">
          <h3>Your Progress</h3>
          <div className="progress-stepper">
            {steps.map((step, index) => (
              <div className={`stepper-item ${step.done && !step.status ? 'done' : ''} ${step.active && !step.done && !step.status ? 'active' : ''} ${!step.active && !step.done ? 'inactive' : ''} ${step.status || ''}`} key={step.label}>
                <div className="stepper-circle">
                  {step.status === 'error' ? <XCircle size={16} /> : (step.done || step.status === 'warning') ? <CheckCircle2 size={16} /> : step.active ? <div className="dot" /> : <span>{index + 1}</span>}
                </div>
                <span className="stepper-label">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        {application.status === 'Interview scheduled' && application.nextStep && (
          <div className="progress-reqs-card">
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--brand-brown)' }}>Interview Details</h3>
            <div style={{ fontSize: '14px', color: 'var(--text)' }}>
              {(() => {
                try {
                  const details = JSON.parse(application.nextStep)
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px' }}>
                      <strong style={{ color: 'var(--brand-brown)' }}>Date:</strong> <span>{details.date}</span>
                      <strong style={{ color: 'var(--brand-brown)' }}>Time:</strong> <span>{details.time}</span>
                      <strong style={{ color: 'var(--brand-brown)' }}>Mode:</strong> <span style={{ textTransform: 'capitalize' }}>{details.mode}</span>
                      <strong style={{ color: 'var(--brand-brown)' }}>Location/Link:</strong> <span>{details.mode === 'online' ? <a href={details.locationOrLink} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-orange)' }}>{details.locationOrLink}</a> : details.locationOrLink}</span>
                    </div>
                  )
                } catch {
                  return <p>{application.nextStep}</p>
                }
              })()}
            </div>
          </div>
        )}

        {application.status === 'Offered' && (
          <div className="progress-reqs-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px' }}>
            <h3 style={{ margin: 0, color: 'var(--brand-brown)', textAlign: 'center' }}>Congratulations! You have an offer.</h3>
            <p style={{ margin: 0, color: 'var(--text)', textAlign: 'center', fontSize: '14px' }}>
              The company has extended an internship offer to you. Please accept or decline the offer below.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                className="sd-primary"
                onClick={() => setConfirmAction('accept')}
              >
                Accept Offer
              </button>
              <button 
                className="sd-btn-secondary"
                style={{ color: 'var(--brand-crimson)', borderColor: 'var(--brand-crimson)' }}
                onClick={() => setConfirmAction('decline')}
              >
                Decline Offer
              </button>
            </div>
          </div>
        )}

        {application.status === 'Accepted' && application.requirements && (
          <div className="progress-reqs-card">
            <div className="progress-reqs-header">
              <div>
                <h3>Pre-Employment Progress</h3>
                <p className="muted">{application.approvedRequirements || 0} of {application.requirements.length} requirements approved</p>
              </div>
              <strong className="progress-pct">
                {Math.round(((application.approvedRequirements || 0) / application.requirements.length) * 100)}%
              </strong>
            </div>
            <div className="strip-match-track" style={{ width: '100%', marginTop: '12px' }}>
              <div className="strip-match-progress" style={{ width: `${Math.round(((application.approvedRequirements || 0) / application.requirements.length) * 100)}%` }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              {application.requirements.map((req) => (
                <RequirementSubmitRow
                  applicationId={application.id}
                  key={req.id}
                  onSubmitted={onSubmitted}
                  requirement={req}
                  userId={userId}
                />
              ))}
            </div>
            
            <div style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button 
                className="sd-btn-secondary"
                style={{ color: 'var(--brand-crimson)', borderColor: 'var(--brand-crimson)' }}
                onClick={() => setConfirmAction('withdraw')}
              >
                Withdraw Acceptance
              </button>
            </div>
          </div>
        )}

        {confirmAction && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !confirmBusy) { setConfirmAction(null); setConfirmError(null) } }}>
            <div className="modal-panel" style={{ width: '400px' }}>
              <h3 style={{ margin: '0 0 12px', color: 'var(--brand-brown)' }}>{confirmCopy[confirmAction].title}</h3>
              <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--text)' }}>{confirmCopy[confirmAction].message}</p>
              {confirmError && (
                <p style={{ margin: '0 0 16px', color: 'var(--brand-crimson, #c0392b)', fontSize: '13px' }}>{confirmError}</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  className="sd-btn-secondary"
                  disabled={confirmBusy}
                  onClick={() => { setConfirmAction(null); setConfirmError(null) }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={confirmCopy[confirmAction].danger ? 'sd-btn-secondary' : 'sd-primary'}
                  disabled={confirmBusy}
                  onClick={runConfirmedAction}
                  style={confirmCopy[confirmAction].danger ? { color: 'var(--brand-crimson)', borderColor: 'var(--brand-crimson)' } : undefined}
                  type="button"
                >
                  {confirmBusy ? 'Working…' : confirmCopy[confirmAction].cta}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** One pre-employment requirement with its review state and submit controls. */
function RequirementSubmitRow({
  applicationId,
  requirement,
  userId,
  onSubmitted,
}: {
  applicationId: string
  requirement: PreEmploymentRequirement
  userId?: string
  onSubmitted?: () => void
}) {
  const [text, setText] = useState(requirement.submittedText ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = requirement.submissionStatus ?? 'not_submitted'
  const [isEditing, setIsEditing] = useState(status === 'not_submitted')
  const statusLabel =
    status === 'approved'
      ? 'Approved'
      : status === 'rejected'
        ? 'Needs revision'
        : status === 'pending'
          ? 'Submitted — awaiting review'
          : 'Not submitted'
  const statusColor =
    status === 'approved'
      ? '#3fb950'
      : status === 'rejected'
        ? 'var(--brand-crimson)'
        : status === 'pending'
          ? 'var(--brand-orange)'
          : 'var(--text-light)'


  const submit = async () => {
    if (!userId) return
    setBusy(true)
    setError(null)
    try {
      if (requirement.type === 'file') {
        if (!file) throw new Error('Choose a file first.')
        await submitRequirementFile(userId, applicationId, requirement.id, file)
      } else {
        if (!text.trim()) throw new Error('Enter your response first.')
        await submitRequirementText(applicationId, requirement.id, text)
      }
      setFile(null)
      setIsEditing(false)
      onSubmitted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 500, fontSize: '14px' }}>{requirement.name}</p>
          <p className="muted" style={{ margin: '2px 0 0 0', fontSize: '12px' }}>
            {requirement.type === 'file' ? 'File upload' : 'Text response'}
            {requirement.isPrintable && ' · Needs to be printed'}
          </p>
        </div>
        <span style={{ fontSize: '12px', fontWeight: 600, color: statusColor, whiteSpace: 'nowrap' }}>
          {statusLabel}
        </span>
      </div>

      {!isEditing && status !== 'not_submitted' && (
        <div style={{ marginTop: '10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, marginRight: '16px', overflow: 'hidden' }}>
              <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-light)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>
                Your Submission
              </span>
              {requirement.type === 'text' ? (
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {requirement.submittedText}
                </p>
              ) : (
                <button
                  className="sd-link"
                  disabled={busy}
                  onClick={async () => {
                    if (!requirement.submittedFilePath) return
                    try {
                      setBusy(true)
                      // No download name: "View submitted document" should render
                      // the file, not save it.
                      const url = await signedDocumentUrl(requirement.submittedFilePath)
                      window.open(url, '_blank', 'noopener,noreferrer')
                    } catch {
                      setError('Failed to load document')
                    } finally {
                      setBusy(false)
                    }
                  }}
                  style={{ textAlign: 'left', padding: 0 }}
                  type="button"
                >
                  {busy ? 'Loading document...' : 'View submitted document'}
                </button>
              )}
              {error && !isEditing && <p className="muted" style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--brand-crimson)' }}>{error}</p>}
            </div>
            
            {status !== 'approved' && (
              <button 
                className="sd-primary sm" 
                onClick={() => setIsEditing(true)} 
                style={{ flexShrink: 0, background: 'var(--border)', color: 'var(--text)', border: 'none' }}
                type="button"
              >
                Edit
              </button>
            )}
          </div>
          {status === 'rejected' && requirement.feedback && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)', fontSize: '13px', color: 'var(--brand-crimson)' }}>
              <strong>Reason for revision:</strong> {requirement.feedback}
            </div>
          )}
        </div>
      )}

      {isEditing && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {requirement.type === 'file' ? (
            <label className={`upload-zone ${file ? 'has-file' : ''}`}>
              <input
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                type="file"
              />
              {file ? (
                <div className="upload-file-info">
                  <span className="upload-file-icon">📄</span>
                  <div>
                    <p className="upload-file-name">{file.name}</p>
                    <p className="muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              ) : (
                <div className="upload-placeholder">
                  <div className="upload-icon">
                    <Upload size={18} />
                  </div>
                  <p>
                    <strong>Click to browse</strong> or drag file here
                  </p>
                  <p className="muted">Supported: PDF, DOCX, JPG, PNG</p>
                </div>
              )}
            </label>
          ) : (
            <textarea
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your response…"
              rows={2}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', resize: 'vertical', fontSize: '13px', color: 'var(--text)' }}
              value={text}
            />
          )}
          {error && <p className="muted" style={{ margin: 0, fontSize: '12px', color: 'var(--brand-crimson)' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-start' }}>
            <button
              className="primary"
              disabled={busy || (requirement.type === 'file' ? !file : !text.trim())}
              onClick={submit}
              style={{ padding: '6px 14px', fontSize: '13px' }}
              type="button"
            >
              {busy ? 'Submitting…' : 'Submit'}
            </button>
            {status !== 'not_submitted' && (
              <button
                className="sd-link"
                disabled={busy}
                onClick={() => {
                  setIsEditing(false)
                  setText(requirement.submittedText ?? '')
                  setFile(null)
                  setError(null)
                }}
                style={{ padding: '6px 14px', fontSize: '13px', textDecoration: 'none' }}
                type="button"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StudentApplications({
  applications,
  onOpenProgress,
  filter,
  onFilterChange,
  highlightedAppId
}: {
  applications: Application[]
  onOpenProgress: (app: Application) => void
  filter: string
  onFilterChange: (filter: string) => void
  highlightedAppId?: string | null
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const hasAccepted = applications.some(a => a.status === 'Accepted')

  useEffect(() => {
    if (highlightedAppId) {
      // Small delay to ensure render is complete
      setTimeout(() => {
        const el = document.querySelector('.application-strip.highlighted')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    }
  }, [highlightedAppId])

  const visible = applications.filter((application) => {
    const matchesFilter = filter === 'All' || application.status === filter
    const matchesSearch = [application.company, application.role]
      .join(' ')
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
    // Accepted first; everything else keeps the newest-first order the API
    // returned. .filter() above already returned a fresh array, so this sorts a
    // copy rather than mutating the applications prop, and Array#sort is stable,
    // so the within-group ordering survives.
  }).sort((a, b) => statusRank(a.status) - statusRank(b.status))

  // One pass instead of a .filter() per tab, so a tab can't end up counting a
  // status string that no longer exists in the union.
  const counts = applications.reduce<Partial<Record<ApplicationStatus, number>>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1
    return acc
  }, {})
  const total = applications.length

  const filters: { label: string; count: number }[] = [
    { label: 'All', count: total },
    ...FILTER_STATUSES.map((status) => ({ label: status, count: counts[status] ?? 0 })),
  ]

  return (
    <div className="applications-root">
      <div className="applications-header">
        <h2 className="applications-title">My Applications</h2>
        <p className="applications-subtitle">{total} total applications</p>
      </div>

      <div className="browse-search-field">
        <span className="browse-search-icon">
          <Search size={16} />
        </span>
        <input
          aria-label="Search applications"
          className="browse-search-input"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by role or company..."
          value={searchQuery}
        />
      </div>

      <div className="applications-filters" style={{ alignItems: 'center' }}>
        <span className="browse-pills-label" style={{ marginRight: 4 }}>Filter by status:</span>
        {filters.map(f => (
          <button
            key={f.label}
            className={`app-filter-pill ${filter === f.label ? 'active' : ''}`}
            onClick={() => onFilterChange(f.label)}
            type="button"
          >
            {f.label} {f.label !== 'All' ? `(${f.count} · ${Math.round(f.count / total * 100)}%)` : `(${f.count})`}
          </button>
        ))}
      </div>

      <div className="application-strips">
        {visible.map(app => (
          <ApplicationStrip 
            key={app.id} 
            application={app} 
            onClick={() => onOpenProgress(app)}
            isHighlighted={app.id === highlightedAppId}
            isShaded={hasAccepted && app.status !== 'Accepted'}
          />
        ))}
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
    <article className="internship-strip clickable" onClick={onClick} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
      <div className="strip-top">
        {internship.companyLogo ? (
          <img src={internship.companyLogo} alt={internship.company} className="strip-avatar" style={{ objectFit: 'contain' }} />
        ) : (
          <span className="strip-avatar">{internship.company.slice(0, 2).toUpperCase()}</span>
        )}
        <div className="strip-main">
          <h3>{internship.title}</h3>
          <p className="strip-subtitle">
            {internship.company} · {internship.location} · {internship.slots} slots · {internship.duration}
          </p>
          <p className="strip-summary">{internship.summary}</p>
          <div className="strip-tags" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontStyle: 'italic', color: 'var(--text-light)', background: 'transparent', padding: 0 }}>Skills Required:</span>
            {internship.skills.slice(0, 3).map((skill) => (
              <span key={skill} style={{ borderRadius: '16px', padding: '2px 10px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: '12px' }}>{skill}</span>
            ))}
          </div>
        </div>
        <div className="strip-right">
          <div className="strip-match-container">
            <span className="strip-match-label">Skill Match</span>
            {internship.match === null ? (
              <span className="strip-match-text muted" title="Add skills to your profile, or upload a resume the AI can read, to see a match score.">
                Not available
              </span>
            ) : (
              <div className="strip-match-bar">
                <div className="strip-match-track">
                  <div className="strip-match-progress" style={{ width: `${internship.match}%` }} />
                </div>
                <span className="strip-match-text">{internship.match}%</span>
              </div>
            )}
          </div>
          <button
            aria-label="Bookmark"
            className={`strip-bookmark ${isBookmarked ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleBookmark?.(e); }}
            type="button"
          >
            <Bookmark fill={isBookmarked ? 'currentColor' : 'none'} size={18} />
          </button>
          <button className="strip-apply-btn primary" type="button" onClick={(e) => { e.stopPropagation(); onClick(); }}>
            Learn More
          </button>
        </div>
      </div>
      <div className="strip-bottom">
        <span className="strip-deadline">Deadline: <span className="strip-deadline-date">{internship.deadline.replace(', 2026', '')}</span></span>
      </div>
    </article>
  )
}

function InternshipDetailView({
  internship,
  alreadyApplied,
  onBack,
  onApply,
}: {
  internship: Internship
  alreadyApplied?: boolean
  onBack: () => void
  onApply: () => void
}) {
  return (
    <div className="detail-view">
      <button className="detail-back" onClick={onBack} type="button">
        ← Back to listings
      </button>

      <div className="detail-header">
        {internship.companyLogo ? (
          <img src={internship.companyLogo} alt={internship.company} className="company-mark detail-mark" style={{ objectFit: 'contain' }} />
        ) : (
          <span className="company-mark detail-mark">{internship.company.slice(0, 2).toUpperCase()}</span>
        )}
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
            <span className="detail-info-label">Skill Match Score</span>
            <span className="detail-info-value detail-match">
              {internship.match === null ? '—' : `${internship.match}%`}
            </span>
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
        <button className="primary detail-apply-btn" disabled={alreadyApplied} onClick={onApply} type="button">
          {alreadyApplied ? 'Already Applied' : 'Apply Now'}
        </button>
      </div>
    </div>
  )
}

/** Last path segment of a stored document path, for display. */
function documentFileName(path?: string | null): string {
  if (!path) return ''
  return decodeURIComponent(path.split('/').pop() ?? path)
}

/**
 * One profile document listed in the apply modal, with a view action.
 * `external` marks the portfolio link, which leaves the app rather than opening
 * the in-app preview -- so it gets a link icon and an "Open" label instead.
 */
function ApplyDocumentRow({
  label,
  name,
  onView,
  busy,
  required,
  external,
}: {
  label: string
  name: string
  onView: () => void
  busy?: boolean
  required?: boolean
  external?: boolean
}) {
  return (
    <div className="apply-doc">
      <span className="apply-doc-icon">
        {external ? <Link2 size={18} /> : <FileText size={18} />}
      </span>
      <div className="apply-doc-main">
        <p className="apply-doc-label">
          {label} {required && <span className="required">*</span>}
        </p>
        <p className="apply-doc-name">{name}</p>
      </div>
      <button className="apply-doc-view" disabled={busy} onClick={onView} type="button">
        {busy ? 'Opening…' : external ? 'Open' : 'View'}
      </button>
    </div>
  )
}

function ApplyModal({
  internship,
  onSubmit,
  onClose,
}: {
  internship: Internship
  onSubmit: () => Promise<void>
  onClose: () => void
}) {
  const { profile, demo } = useAuth()
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [openingDoc, setOpeningDoc] = useState(false)
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)

  const hasResume = Boolean(profile?.resume_url)

  /**
   * Preview a stored profile document in-app. The student is only confirming
   * what gets sent -- they already have these files -- so this renders in an
   * overlay rather than handing off to the browser. No download name is passed:
   * that sets Content-Disposition: attachment and saves the file instead.
   */
  const viewDocument = async (path: string | null | undefined, name: string) => {
    if (!path) return
    if (demo) {
      setSubmitError('In demo mode, files are not uploaded to the server, so they cannot be viewed.')
      return
    }
    setOpeningDoc(true)
    setSubmitError(null)
    try {
      const url = await signedDocumentUrl(path)
      setPreview({ url, name })
    } catch {
      setSubmitError('Failed to load the document.')
    } finally {
      setOpeningDoc(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit()
      setSubmitted(true)
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit the application.')
    } finally {
      setSubmitting(false)
    }
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
                {internship.companyLogo ? (
                  <img src={internship.companyLogo} alt={internship.company} className="company-mark" style={{ objectFit: 'contain' }} />
                ) : (
                  <span className="company-mark">{internship.company.slice(0, 2).toUpperCase()}</span>
                )}
                <div>
                  <strong>{internship.title}</strong>
                  <p className="muted">{internship.company} · {internship.location} · {internship.setup}</p>
                </div>
              </div>
              <div className="modal-preview-details">
                <span><strong>Duration:</strong> {internship.duration}</span>
                <span><strong>Deadline:</strong> {internship.deadline}</span>
                <span>
                  <strong>Match:</strong> {internship.match === null ? '—' : `${internship.match}%`}
                </span>
              </div>
            </div>

            {/* Documents pulled straight from the student's profile — nothing is
                typed or uploaded here, so they can see exactly what gets sent. */}
            <div className="modal-uploads">
              <div className="modal-upload-field">
                <label>What {internship.company} will receive</label>

                <div className="apply-doc-list">
                  {hasResume ? (
                    <ApplyDocumentRow
                      busy={openingDoc}
                      label="Resume"
                      name={documentFileName(profile?.resume_url)}
                      onView={() => viewDocument(profile?.resume_url, 'Resume')}
                      required
                    />
                  ) : (
                    <p className="muted">
                      No resume on your profile yet — upload one from your profile before applying.
                    </p>
                  )}

                  {profile?.cover_letter_url && (
                    <ApplyDocumentRow
                      busy={openingDoc}
                      label="Cover Letter"
                      name={documentFileName(profile.cover_letter_url)}
                      onView={() => viewDocument(profile.cover_letter_url, 'Cover Letter')}
                    />
                  )}

                  {profile?.portfolio_file_url && (
                    <ApplyDocumentRow
                      busy={openingDoc}
                      label="Portfolio"
                      name={documentFileName(profile.portfolio_file_url)}
                      onView={() => viewDocument(profile.portfolio_file_url, 'Portfolio')}
                    />
                  )}

                  {profile?.portfolio_link && (
                    <ApplyDocumentRow
                      busy={openingDoc}
                      external
                      label="Portfolio Link"
                      name={profile.portfolio_link}
                      onView={() => window.open(profile.portfolio_link!, '_blank', 'noopener,noreferrer')}
                    />
                  )}
                </div>

                <p className="muted" style={{ marginTop: '10px' }}>
                  These come from your profile — update them there to change what is sent.
                </p>
              </div>
            </div>

            {submitError && <p className="muted" style={{ color: 'var(--brand-crimson)' }}>{submitError}</p>}

            <div className="modal-footer">
              <button onClick={onClose} type="button">Cancel</button>
              <button
                className="primary"
                disabled={!hasResume || submitting}
                onClick={handleSubmit}
                type="button"
              >
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Renders the document in place. Stops propagation so clicking inside the
          preview doesn't reach the apply modal's overlay and close the form. */}
      {preview && (
        <div
          className="modal-overlay"
          onClick={() => setPreview(null)}
          style={{ zIndex: 9999, display: 'flex', flexDirection: 'column', padding: '40px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', flex: 1, borderRadius: '8px', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{preview.name}</h3>
              <button
                aria-label="Close preview"
                onClick={() => setPreview(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-light)' }}
                type="button"
              >
                <XCircle size={20} />
              </button>
            </div>
            <iframe
              src={preview.url}
              style={{ flex: 1, width: '100%', border: 'none', background: 'var(--bg-subtle)' }}
              title={preview.name}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function DataTable({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
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
