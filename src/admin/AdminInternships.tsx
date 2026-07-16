import { useMemo, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { AdBadge, AdSearch } from './components'
import type { AdminListing, AdminListingStatus } from './adminData'

/** UC-A04 — Oversee internship listings platform-wide (flag / unflag). */
export function AdminInternships({
  listings,
  setListings,
}: {
  listings: AdminListing[]
  setListings: React.Dispatch<React.SetStateAction<AdminListing[]>>
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | AdminListingStatus>('all')

  const filtered = useMemo(
    () =>
      listings.filter(
        (l) =>
          (filter === 'all' || l.status === filter) &&
          (l.title.toLowerCase().includes(search.toLowerCase()) ||
            l.company.toLowerCase().includes(search.toLowerCase())),
      ),
    [listings, search, filter],
  )

  const setStatus = (id: number, status: AdminListingStatus) =>
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)))

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1 className="ad-title">Manage Internships</h1>
          <p className="ad-subtitle">{listings.length} total listings</p>
        </div>
      </div>

      <div className="ad-toolbar">
        <AdSearch onChange={setSearch} placeholder="Search by title or company…" value={search} />
        <select
          className="ad-select"
          onChange={(e) => setFilter(e.target.value as 'all' | AdminListingStatus)}
          value={filter}
        >
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="flagged">Flagged</option>
        </select>
      </div>

      <div className="ad-rows">
        {filtered.length === 0 ? (
          <div className="ad-card ad-empty">No listings found</div>
        ) : (
          filtered.map((l) => (
            <div className="ad-row" key={l.id}>
              <div>
                <div className="ad-row-title">
                  <p>{l.title}</p>
                  <AdBadge
                    text={l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                    variant={
                      l.status === 'open'
                        ? 'success'
                        : l.status === 'flagged'
                          ? 'rejected'
                          : 'neutral'
                    }
                  />
                </div>
                <p className="ad-muted">
                  {l.company} · {l.applicants} applicants · Posted {l.posted} · Deadline{' '}
                  {l.deadline}
                </p>
              </div>
              <div>
                {l.status === 'open' && (
                  <button
                    className="ad-secondary"
                    onClick={() => setStatus(l.id, 'flagged')}
                    type="button"
                  >
                    <AlertCircle size={12} /> Flag
                  </button>
                )}
                {l.status === 'flagged' && (
                  <button
                    className="ad-secondary"
                    onClick={() => setStatus(l.id, 'open')}
                    type="button"
                  >
                    <RefreshCw size={12} /> Unflag
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
