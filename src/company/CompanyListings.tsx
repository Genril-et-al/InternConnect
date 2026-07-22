import { useMemo, useState, useEffect } from 'react'
import { ArrowLeft, Plus, Search, Trash2, X } from 'lucide-react'
import type { CompanyApplicant, CompanyListing, PreEmploymentRequirement } from './companyData'
import type { NewListingInput } from './companyQueries'
import { useScrollLock } from '../lib/useScrollLock'

/** UC-C03 — view and search the company's listings with applicant counts. */
export function CompanyListings({
  listings,
  applicants,
  verification,
  onCreate,
  onSetStatus,
  onDelete,
  highlightedListingId,
}: {
  listings: CompanyListing[]
  applicants: CompanyApplicant[]
  verification: 'pending' | 'verified' | 'rejected'
  onCreate: (input: NewListingInput) => Promise<void>
  onSetStatus: (id: string, status: CompanyListing['status']) => Promise<void>
  onDelete: (id: string) => Promise<void>
  highlightedListingId?: string | null
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [isPosting, setIsPosting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [previewListing, setPreviewListing] = useState<CompanyListing | null>(null)

  useEffect(() => {
    if (highlightedListingId) {
      setTimeout(() => {
        const el = document.querySelector('.cp-card.highlighted')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    }
  }, [highlightedListingId])

  const run = (action: () => Promise<void>) => {
    setActionError(null)
    action().catch((err) => setActionError(err instanceof Error ? err.message : 'Action failed.'))
  }

  const filtered = useMemo(
    () => listings.filter((l) => {
      const matchesSearch = l.title.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'All' || l.status === statusFilter
      return matchesSearch && matchesStatus
    }),
    [listings, search, statusFilter],
  )

  const countFor = (listing: CompanyListing, status?: string) =>
    applicants.filter(
      (a) => a.listingId === listing.id && (!status || a.status === status),
    ).length

  return (
    <div className="cp-root">
      <div className="cp-head">
        <div>
          <h1 className="cp-title">My Listings</h1>
          <p className="cp-subtitle">{listings.length} internship listings</p>
        </div>
        <button className="cp-primary" type="button" onClick={() => setIsPosting(true)}>
          <Plus size={14} /> Post New Listing
        </button>
      </div>

      {verification !== 'verified' && (
        <p className="cp-notice rejected">
          Your company is not yet verified by the NLO — new listings cannot be posted until
          verification is approved.
        </p>
      )}
      {actionError && <p className="cp-notice rejected">{actionError}</p>}

      <div className="cp-toolbar" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div className="cp-search" style={{ flex: 1 }}>
          <Search size={14} />
          <input
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search listings…"
            value={search}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {['All', 'Open', 'Closed'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: statusFilter === status ? 'none' : '1px solid var(--border)',
                background: statusFilter === status ? 'var(--brand-orange)' : 'transparent',
                color: statusFilter === status ? 'white' : 'var(--text)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500
              }}
              type="button"
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="cp-rows" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filtered.length === 0 ? (
          <div className="cp-card cp-empty">No listings found.</div>
        ) : (
          filtered.map((l) => (
            <div className={`cp-card ${l.id === highlightedListingId ? 'highlighted' : ''}`} key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px', cursor: 'pointer' }} onClick={() => setPreviewListing(l)}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>{l.title}</h3>
                  <span
                    className={`cp-badge ${
                      l.status === 'Open' ? 'success' : l.status === 'Draft' ? 'neutral' : 'rejected'
                    }`}
                    style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 500 }}
                  >
                    {l.status}
                  </span>
                </div>
                <p className="cp-muted" style={{ margin: '0 0 8px 0', fontSize: '13px' }}>
                  {l.department} · {l.slots} slot{l.slots > 1 ? 's' : ''} · {countFor(l)} applicant{countFor(l) === 1 ? '' : 's'} · Deadline {l.deadline}
                </p>
                
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {l.skills.map(skill => (
                    <span key={skill} style={{ background: 'var(--brand-sand)', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', color: 'var(--brand-brown)', fontWeight: 500 }}>
                      {skill}
                    </span>
                  ))}
                </div>
                
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-light)' }}>
                  {l.description}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                
                {l.status === 'Closed' && (
                  <button 
                    type="button" 
                    onClick={() => run(() => onSetStatus(l.id, 'Open'))}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', border: 'none', background: 'var(--brand-orange)', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Open
                  </button>
                )}

                {l.status !== 'Closed' && (
                  <button 
                    type="button" 
                    onClick={() => run(() => onSetStatus(l.id, 'Closed'))}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', border: 'none', background: 'var(--brand-crimson)', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>
                    Close
                  </button>
                )}
                
                {l.status === 'Closed' && (
                  <button 
                    type="button" 
                    onClick={() => run(() => onDelete(l.id))}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--brand-crimson)', padding: '6px 12px', fontSize: '13px', fontWeight: 500 }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {isPosting && <PostListingModal onClose={() => setIsPosting(false)} onCreate={onCreate} />}
      {previewListing && !isPosting && (
        <PreviewListingView
          listing={previewListing}
          onBack={() => setPreviewListing(null)}
          onEdit={() => {
            setPreviewListing(null)
            setIsPosting(true)
          }}
        />
      )}
    </div>
  )
}

function PreviewListingView({
  listing,
  onBack,
  onEdit,
}: {
  listing: CompanyListing
  onBack: () => void
  onEdit: () => void
}) {
  useScrollLock()

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onBack() }}>
      <div className="modal-panel detail-view" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button className="detail-back" onClick={onBack} type="button">
            <ArrowLeft size={14} /> Back to listings
          </button>
          <button className="cp-primary" onClick={onEdit} type="button" style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: 'var(--brand-orange)', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            Edit Listing
          </button>
        </div>

        <div style={{ background: 'rgba(255, 165, 0, 0.1)', color: 'var(--brand-orange)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          This is a preview of how students will see your listing.
        </div>

        <div className="detail-header" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ flex: 1 }}>
            <h2 className="detail-title" style={{ margin: '0 0 8px 0', fontSize: '24px', color: 'var(--text)' }}>{listing.title}</h2>
            <p className="muted" style={{ margin: 0, color: 'var(--text-light)' }}>{listing.department}</p>
          </div>
          <span className={`status ${listing.status === 'Open' ? 'success' : listing.status === 'Draft' ? 'neutral' : 'rejected'}`} style={{ padding: '4px 12px', borderRadius: '16px', fontSize: '14px', fontWeight: 500, background: listing.status === 'Open' ? 'rgba(46, 160, 67, 0.15)' : listing.status === 'Draft' ? 'var(--bg-subtle)' : 'rgba(248, 81, 73, 0.15)', color: listing.status === 'Open' ? '#3fb950' : listing.status === 'Draft' ? 'var(--text)' : '#ff7b72' }}>
            {listing.status}
          </span>
        </div>

        <div className="detail-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <section className="detail-section">
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--brand-brown)', fontSize: '16px' }}>Description</h4>
            <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--text)' }}>{listing.description}</p>
          </section>

          <div className="detail-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
            <div className="detail-info-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="detail-info-label" style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Department</span>
              <span className="detail-info-value" style={{ fontSize: '15px', color: 'var(--text)', fontWeight: 500 }}>{listing.department}</span>
            </div>
            <div className="detail-info-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="detail-info-label" style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Available Slots</span>
              <span className="detail-info-value" style={{ fontSize: '15px', color: 'var(--text)', fontWeight: 500 }}>{listing.slots}</span>
            </div>
            <div className="detail-info-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="detail-info-label" style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Deadline</span>
              <span className="detail-info-value" style={{ fontSize: '15px', color: 'var(--text)', fontWeight: 500 }}>{listing.deadline}</span>
            </div>
          </div>

          <section className="detail-section">
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--brand-brown)', fontSize: '16px' }}>Required Skills</h4>
            <div className="tag-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {listing.skills.map((skill) => (
                <span key={skill} style={{ background: 'var(--brand-sand)', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', color: 'var(--brand-brown)', fontWeight: 500 }}>
                  {skill}
                </span>
              ))}
            </div>
          </section>

          {listing.requirements && listing.requirements.length > 0 && (
            <section className="detail-section" style={{ marginTop: '16px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--brand-brown)', fontSize: '16px' }}>Pre-employment Requirements</h4>
              <p className="cp-muted" style={{ fontSize: '13px', marginBottom: '16px', color: 'var(--text-light)' }}>
                These are hidden from students until they accept an offer.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {listing.requirements.map(req => (
                  <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text)', fontSize: '14px' }}>{req.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                        {req.type === 'file' ? 'File upload' : 'Text instruction'}
                        {req.isPrintable && ' · Needs to be printed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function newRequirementId(): string {
  return Math.random().toString(36).slice(2)
}

function PostListingModal({ onClose, onCreate }: { onClose: () => void; onCreate: (input: NewListingInput) => Promise<void> }) {
  useScrollLock()

  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [slots, setSlots] = useState('1')
  const [deadline, setDeadline] = useState('')
  const [skills, setSkills] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const publishImmediately = true
  // Lazy initializer keeps the impure id generation out of render.
  const [requirements, setRequirements] = useState<PreEmploymentRequirement[]>(() => [
    { id: newRequirementId(), name: '', type: 'text', isPrintable: false }
  ])

  const addRequirement = () => {
    setRequirements([
      ...requirements,
      { id: newRequirementId(), name: '', type: 'text', isPrintable: false }
    ])
  }
  
  const updateRequirement = (id: string, updates: Partial<PreEmploymentRequirement>) => {
    setRequirements(requirements.map(req => req.id === id ? { ...req, ...updates } : req))
  }
  
  const removeRequirement = (id: string) => {
    setRequirements(requirements.filter(req => req.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      await onCreate({
        title,
        department,
        slots: parseInt(slots) || 1,
        deadline,
        skills: skills.split(',').map(s => s.trim()).filter(Boolean),
        description,
        publish: publishImmediately,
        requirements: requirements
          .filter(r => r.name.trim() !== '')
          .map(r => ({ name: r.name.trim(), type: r.type, isPrintable: r.isPrintable })),
      })
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save the listing.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', padding: '0', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div className="modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--brand-brown)', fontSize: '20px' }}>Post New Listing</h3>
          <button aria-label="Close" className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--brand-brown)', fontSize: '14px' }}>Position Title <span style={{color:'var(--brand-crimson)'}}>*</span></label>
            <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Frontend Developer Intern" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)' }} />
          </div>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--brand-brown)', fontSize: '14px' }}>Department / Unit</label>
              <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Engineering" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)' }} />
            </div>
            <div style={{ width: '120px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--brand-brown)', fontSize: '14px' }}>Slots Available</label>
              <input type="number" min="1" value={slots} onChange={e => setSlots(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)' }} />
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--brand-brown)', fontSize: '14px' }}>Application Deadline</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)' }} />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--brand-brown)', fontSize: '14px' }}>Skills Needed <span style={{color:'var(--brand-crimson)'}}>*</span></label>
            <input required value={skills} onChange={e => setSkills(e.target.value)} placeholder="e.g. React, Figma, TypeScript" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)' }} />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--brand-brown)', fontSize: '14px' }}>Job Description / Responsibilities <span style={{color:'var(--brand-crimson)'}}>*</span></label>
            <textarea required value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the role, responsibilities, and qualifications..." style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', minHeight: '100px', resize: 'vertical' }} />
          </div>
          
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <h4 style={{ marginBottom: '8px', color: 'var(--brand-brown)', fontSize: '16px' }}>Pre-employment Requirements <span style={{color:'var(--brand-crimson)'}}>*</span></h4>
            <p className="cp-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
              These will only be visible to students after they accept the internship offer. Use this to request medical certificates, NDAs, or other documents.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {requirements.map((req) => (
                <div key={req.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'var(--bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <input 
                      required
                      placeholder="Requirement name (e.g., Medical Certificate)" 
                      value={req.name} 
                      onChange={e => updateRequirement(req.id, { name: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '12px' }}
                    />
                    
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '12px', flexWrap: 'wrap', color: 'var(--text-light)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input type="radio" name={`type-${req.id}`} checked={req.type === 'text'} onChange={() => updateRequirement(req.id, { type: 'text' })} style={{ width: '12px', height: '12px', margin: 0 }} />
                        Text instruction
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input type="radio" name={`type-${req.id}`} checked={req.type === 'file'} onChange={() => updateRequirement(req.id, { type: 'file' })} style={{ width: '12px', height: '12px', margin: 0 }} />
                        File upload
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', cursor: 'pointer', background: 'var(--bg-subtle)', padding: '4px 8px', borderRadius: '4px' }}>
                        <input type="checkbox" checked={req.isPrintable} onChange={e => updateRequirement(req.id, { isPrintable: e.target.checked })} style={{ width: '12px', height: '12px', margin: 0 }} />
                        Needs to be printed
                      </label>
                    </div>

                    {req.type === 'file' && (
                      <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-subtle)', borderRadius: '6px', border: '1px dashed var(--border)' }}>
                        <p style={{ fontSize: '12px', marginBottom: '8px', color: 'var(--text-light)' }}>Upload template or document for students to fill out (optional):</p>
                        <input type="file" style={{ fontSize: '12px' }} />
                      </div>
                    )}
                  </div>
                  {requirements.length > 1 && (
                    <button type="button" onClick={() => removeRequirement(req.id)} style={{ padding: '8px', background: 'transparent', color: 'var(--brand-crimson)', border: 'none', cursor: 'pointer', opacity: 0.7 }} title="Remove requirement">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <button 
              type="button" 
              onClick={addRequirement}
              style={{ marginTop: '12px', padding: '10px 16px', background: 'transparent', border: '1px dashed var(--brand-orange)', borderRadius: '8px', cursor: 'pointer', color: 'var(--brand-orange)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}
            >
              <Plus size={16} /> Add Requirement
            </button>
          </div>
          {saveError && <p className="cp-notice rejected" style={{ margin: 0 }}>{saveError}</p>}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end', paddingTop: '16px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontWeight: 500 }}>Discard</button>
            <button type="submit" disabled={saving} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'var(--brand-orange)', color: 'white', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: saving ? 0.7 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              Publish
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

