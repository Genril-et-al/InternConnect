import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import type { CompanyApplicant, CompanyListing } from './companyData'

/** UC-C03 — view and search the company's listings with applicant counts. */
export function CompanyListings({
  listings,
  applicants,
}: {
  listings: CompanyListing[]
  applicants: CompanyApplicant[]
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () => listings.filter((l) => l.title.toLowerCase().includes(search.toLowerCase())),
    [listings, search],
  )

  const countFor = (listing: CompanyListing, status?: string) =>
    applicants.filter(
      (a) => a.role === listing.title && (!status || a.status === status),
    ).length

  return (
    <div className="cp-root">
      <div className="cp-head">
        <div>
          <h1 className="cp-title">My Listings</h1>
          <p className="cp-subtitle">{listings.length} internship listings</p>
        </div>
        <button className="cp-primary" type="button">
          <Plus size={14} /> Post New Listing
        </button>
      </div>

      <div className="cp-toolbar">
        <div className="cp-search">
          <Search size={14} />
          <input
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search listing title…"
            value={search}
          />
        </div>
      </div>

      <div className="cp-rows">
        {filtered.length === 0 ? (
          <div className="cp-card cp-empty">No listings found.</div>
        ) : (
          filtered.map((l) => (
            <div className="cp-row" key={l.id} style={{ cursor: 'default' }}>
              <div className="cp-row-main">
                <p className="cp-row-name">{l.title}</p>
                <p className="cp-muted">
                  {l.slots} slot{l.slots > 1 ? 's' : ''} · Deadline {l.deadline} ·{' '}
                  {countFor(l)} applicant{countFor(l) === 1 ? '' : 's'} ·{' '}
                  {countFor(l, 'Pending')} pending
                </p>
              </div>
              <span
                className={`cp-badge ${
                  l.status === 'Open' ? 'success' : l.status === 'Draft' ? 'neutral' : 'rejected'
                }`}
              >
                {l.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
