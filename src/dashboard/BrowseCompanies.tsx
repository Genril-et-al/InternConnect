import { useEffect, useMemo, useState } from 'react'
import { Building2, ChevronLeft, MapPin, Search } from 'lucide-react'
import { fetchAllCompanies, type StudentCompany } from '../lib/listingsApi'
import { Dropdown } from '../components/Dropdown'
import type { Internship } from '../lib/mockData'

export function BrowseCompanies({
  internships,
  onOpenInternship,
}: {
  internships: Internship[]
  onOpenInternship: (id: string) => void
}) {
  const [companies, setCompanies] = useState<StudentCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [companyFilter, setCompanyFilter] = useState('All')
  const [locationFilter, setLocationFilter] = useState('All')
  const [selectedCompany, setSelectedCompany] = useState<StudentCompany | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAllCompanies()
      .then((data) => {
        if (!cancelled) {
          setCompanies(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Options come from whatever actually loaded, so the dropdowns never offer a
  // company or a location that would filter the grid down to nothing.
  const companyOptions = useMemo(
    () => ['All', ...Array.from(new Set(companies.map((c) => c.name).filter(Boolean))).sort()],
    [companies]
  )

  const locationOptions = useMemo(
    () => ['All', ...Array.from(new Set(companies.map((c) => c.location).filter(Boolean))).sort()],
    [companies]
  )

  const filteredCompanies = useMemo(
    () =>
      companies.filter((c) => {
        const matchesQuery = (c.name + ' ' + c.location)
          .toLowerCase()
          .includes(query.toLowerCase())
        const matchesCompany = companyFilter === 'All' || c.name === companyFilter
        const matchesLocation = locationFilter === 'All' || c.location === locationFilter
        return matchesQuery && matchesCompany && matchesLocation
      }),
    [companies, query, companyFilter, locationFilter]
  )

  if (selectedCompany) {
    const companyInternships = internships.filter(
      (i) => i.companyId === selectedCompany.id || i.company === selectedCompany.name
    )

    return (
      <div className="view-swap">
        <button
          className="sd-link"
          style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={() => setSelectedCompany(null)}
          type="button"
        >
          <ChevronLeft size={16} /> Back to Companies
        </button>

        <div className="sd-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', marginBottom: '24px' }}>
            {selectedCompany.logo_url ? (
              <img
                src={selectedCompany.logo_url}
                alt={selectedCompany.name}
                style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border)' }}
              />
            ) : (
              <div style={{ width: '80px', height: '80px', background: 'var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 600, color: 'var(--muted)' }}>
                {selectedCompany.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>{selectedCompany.name}</h2>
              <p className="sd-muted" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Building2 size={16} /> {selectedCompany.industry}
              </p>
              <p className="sd-muted" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} /> {selectedCompany.location}
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>About the Company</h3>
            <p style={{ lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{selectedCompany.description}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '40px' }}>
            {selectedCompany.website && (
              <div>
                <h4 style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '4px' }}>Website</h4>
                <a href={selectedCompany.website} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-orange)', textDecoration: 'none' }}>
                  {selectedCompany.website}
                </a>
              </div>
            )}
            {selectedCompany.contact_email && (
              <div>
                <h4 style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '4px' }}>Contact Email</h4>
                <a href={`mailto:${selectedCompany.contact_email}`} style={{ color: 'var(--brand-orange)', textDecoration: 'none' }}>
                  {selectedCompany.contact_email}
                </a>
              </div>
            )}
            {selectedCompany.contact_phone && (
              <div>
                <h4 style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '4px' }}>Contact Phone</h4>
                <span style={{ color: 'var(--text)' }}>{selectedCompany.contact_phone}</span>
              </div>
            )}
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Open Roles at {selectedCompany.name}</h3>
          <div className="sd-list">
            {companyInternships.length === 0 ? (
              <p className="sd-muted">No open internships currently available.</p>
            ) : (
              companyInternships.map((job) => (
                <div
                  className="sd-list-row clickable"
                  key={job.id}
                  onClick={() => onOpenInternship(job.id)}
                  role="button"
                  tabIndex={0}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px', borderRadius: '8px' }}
                >
                  <div className="sd-list-main">
                    <p className="sd-list-title">{job.title}</p>
                    <p className="sd-muted">
                      {job.setup} · {job.slots} slot{job.slots !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button className="sd-primary sm" type="button" onClick={(e) => { e.stopPropagation(); onOpenInternship(job.id); }}>
                    View Role
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="browse-root view-swap">
      <div className="browse-heading">
        <h2 className="browse-title">Browse Companies</h2>
        <p className="browse-subtitle">Explore partner companies and their internship opportunities</p>
      </div>

      <div className="browse-search-row">
        <div className="browse-search-field">
          <span className="browse-search-icon">
            <Search size={16} />
          </span>
          <input
            aria-label="Search companies"
            className="browse-search-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or location..."
            value={query}
          />
        </div>
      </div>

      {/* Company + location filters, with the result count on the right */}
      <div className="browse-filters-row">
        <div className="browse-pills browse-company-filters">
          <span className="browse-pills-label">Filter by company:</span>
          <Dropdown
            ariaLabel="Filter by company"
            onChange={setCompanyFilter}
            options={companyOptions}
            value={companyFilter}
          />
          <span className="browse-pills-label browse-pills-label--gap">Filter by location:</span>
          <Dropdown
            ariaLabel="Filter by location"
            onChange={setLocationFilter}
            options={locationOptions}
            value={locationFilter}
          />
        </div>
        <span className="browse-result-count">
          {filteredCompanies.length} result{filteredCompanies.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Loading companies...</div>
      ) : (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {filteredCompanies.length === 0 ? (
            <p className="muted" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '32px 0' }}>
              No companies match your search.
            </p>
          ) : (
            filteredCompanies.map((company) => (
              <article
                key={company.id}
                className="sd-card clickable"
                style={{ padding: '24px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onClick={() => setSelectedCompany(company)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  {company.logo_url ? (
                    <img src={company.logo_url} alt={company.name} style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border)' }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', background: 'var(--border)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500, color: 'var(--muted)' }}>
                      {company.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {company.name}
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {company.industry}
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text)', margin: '0 0 16px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {company.description}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--muted)' }}>
                  <MapPin size={14} />
                  {company.location}
                </div>
              </article>
            ))
          )}
        </section>
      )}
    </div>
  )
}
