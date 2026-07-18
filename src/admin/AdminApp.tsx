import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3,
  Briefcase,
  Building2,
  ChevronLeft,
  Menu,
  GraduationCap,
  LayoutDashboard,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../auth/context'
import { useSidebarCollapsed } from '../lib/useSidebar'
import { SignOutButton } from '../components/SignOutButton'
import { Avatar } from '../components/Avatar'
import { AdminDashboard } from './AdminDashboard'
import { AdminStudents } from './AdminStudents'
import { AdminCompanies } from './AdminCompanies'
import { AdminInternships } from './AdminInternships'
import { AdminReports } from './AdminReports'
import { EMPTY_APP_STATS } from './adminData'
import type { AdminAppStats, AdminCompany, AdminListing, AdminStudent } from './adminData'
import {
  fetchAdminListings,
  fetchAppStats,
  fetchCompanies,
  fetchStudents,
  setListingFlagged,
} from './adminQueries'
import './admin.css'

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: GraduationCap, label: 'Manage Students' },
  { icon: Building2, label: 'Manage Companies' },
  { icon: Briefcase, label: 'Manage Internships' },
  { icon: BarChart3, label: 'Reports' },
]

/**
 * Admin portal — a fully separate shell from the student/company workspace
 * (UC-A01…A06). Rendered whenever the signed-in profile has the admin role.
 */
export function AdminApp() {
  const { profile } = useAuth()
  const [active, setActive] = useState(0)
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()

  // Students, companies, listings, and application stats — all live.
  const [students, setStudents] = useState<AdminStudent[]>([])
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [listings, setListings] = useState<AdminListing[]>([])
  const [appStats, setAppStats] = useState<AdminAppStats>(EMPTY_APP_STATS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refreshStudents = useCallback(async () => {
    setStudents(await fetchStudents())
  }, [])
  const refreshCompanies = useCallback(async () => {
    setCompanies(await fetchCompanies())
  }, [])
  const refreshListings = useCallback(async () => {
    setListings(await fetchAdminListings())
  }, [])

  const handleSetFlagged = useCallback(
    async (id: string, flagged: boolean) => {
      await setListingFlagged(id, flagged)
      await refreshListings()
    },
    [refreshListings],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const [s, c, l, stats] = await Promise.all([
          fetchStudents(),
          fetchCompanies(),
          fetchAdminListings(),
          fetchAppStats(),
        ])
        if (!cancelled) {
          setStudents(s)
          setCompanies(c)
          setListings(l)
          setAppStats(stats)
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load admin data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const name = profile?.full_name?.trim() || profile?.email || 'NLO Admin'

  return (
    <div className={`ad-shell${collapsed ? ' sb-collapsed' : ''}`}>
      <aside className="ad-sidebar">
        <div className="ad-brand">
          <img className="ad-logo" src="/logo.png" alt="InternConnect" />
          <div className="ad-brand-text">
            <div className="ad-brand-name">InternConnect</div>
            <div className="ad-brand-sub">Admin Panel</div>
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
          {NAV.map((item, i) => {
            const Icon = item.icon
            return (
              <button
                className={i === active ? 'active' : ''}
                key={item.label}
                onClick={() => setActive(i)}
                title={item.label}
                type="button"
              >
                <Icon size={16} /> <span className="ad-nav-label">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="ad-user">
          <Avatar
            className="ad-user-avatar"
            fallback="NA"
            name={name}
            photoUrl={profile?.photo_url}
          />
          <div className="ad-user-main">
            <p className="ad-user-name">{name}</p>
            <p className="ad-user-role">NLO Admin</p>
          </div>
          <SignOutButton ariaLabel="Sign out" className="ad-signout">
            <LogOut size={15} />
          </SignOutButton>
        </div>
      </aside>

      <main className="ad-main">
        {active === 0 && (
          <AdminDashboard
            appStats={appStats}
            companies={companies}
            listings={listings}
            onNav={setActive}
            students={students}
          />
        )}
        {active === 1 && (
          <AdminStudents
            students={students}
            loading={loading}
            loadError={loadError}
            onRefresh={refreshStudents}
          />
        )}
        {active === 2 && (
          <AdminCompanies
            companies={companies}
            loading={loading}
            loadError={loadError}
            onRefresh={refreshCompanies}
          />
        )}
        {active === 3 && <AdminInternships listings={listings} onSetFlagged={handleSetFlagged} />}
        {active === 4 && (
          <AdminReports
            appStats={appStats}
            companies={companies}
            listings={listings}
            students={students}
          />
        )}
      </main>
    </div>
  )
}
