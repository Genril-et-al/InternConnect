import { useState } from 'react'
import {
  BarChart3,
  Briefcase,
  Building2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../auth/context'
import { AdminDashboard } from './AdminDashboard'
import { AdminStudents } from './AdminStudents'
import { AdminCompanies } from './AdminCompanies'
import { AdminInternships } from './AdminInternships'
import { AdminReports } from './AdminReports'
import {
  SEED_ADMIN_COMPANIES,
  SEED_ADMIN_LISTINGS,
  SEED_ADMIN_STUDENTS,
} from './adminData'
import type { AdminCompany, AdminListing, AdminStudent } from './adminData'
import './admin.css'

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: GraduationCap, label: 'Students' },
  { icon: Building2, label: 'Companies' },
  { icon: Briefcase, label: 'Internships' },
  { icon: BarChart3, label: 'Reports' },
]

/**
 * Admin portal — a fully separate shell from the student/company workspace
 * (UC-A01…A06). Rendered whenever the signed-in profile has the admin role.
 */
export function AdminApp() {
  const { profile, signOut } = useAuth()
  const [active, setActive] = useState(0)

  // Admin-managed records (seed data until the Supabase slice lands).
  const [students, setStudents] = useState<AdminStudent[]>(SEED_ADMIN_STUDENTS)
  const [companies, setCompanies] = useState<AdminCompany[]>(SEED_ADMIN_COMPANIES)
  const [listings, setListings] = useState<AdminListing[]>(SEED_ADMIN_LISTINGS)

  const name = profile?.full_name?.trim() || profile?.email || 'NLO Admin'
  const initials =
    name
      .split(/[\s.@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'NA'

  return (
    <div className="ad-shell">
      <aside className="ad-sidebar">
        <div className="ad-brand">
          <span className="ad-logo">IC</span>
          <div>
            <div className="ad-brand-name">InternConnect</div>
            <div className="ad-brand-sub">Admin Panel</div>
          </div>
        </div>

        <nav className="ad-nav">
          {NAV.map((item, i) => {
            const Icon = item.icon
            return (
              <button
                className={i === active ? 'active' : ''}
                key={item.label}
                onClick={() => setActive(i)}
                type="button"
              >
                <Icon size={16} /> {item.label}
              </button>
            )
          })}
        </nav>

        <div className="ad-user">
          <span className="ad-user-avatar">{initials}</span>
          <div className="ad-user-main">
            <p className="ad-user-name">{name}</p>
            <p className="ad-user-role">NLO Admin</p>
          </div>
          <button aria-label="Sign out" className="ad-signout" onClick={signOut} type="button">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <main className="ad-main">
        {active === 0 && (
          <AdminDashboard
            companies={companies}
            listings={listings}
            onNav={setActive}
            students={students}
          />
        )}
        {active === 1 && <AdminStudents setStudents={setStudents} students={students} />}
        {active === 2 && <AdminCompanies companies={companies} setCompanies={setCompanies} />}
        {active === 3 && <AdminInternships listings={listings} setListings={setListings} />}
        {active === 4 && <AdminReports />}
      </main>
    </div>
  )
}
