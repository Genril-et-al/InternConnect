import { useMemo, useState } from 'react'
import { Plus, Search, Trash2, X } from 'lucide-react'
import type { CompanyApplicant, CompanyListing, PreEmploymentRequirement } from './companyData'

/** UC-C03 — view and search the company's listings with applicant counts. */
export function CompanyListings({
  listings,
  applicants,
}: {
  listings: CompanyListing[]
  applicants: CompanyApplicant[]
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [isPosting, setIsPosting] = useState(false)

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
      (a) => a.role === listing.title && (!status || a.status === status),
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
          {['All', 'Open', 'Draft', 'Closed'].map(status => (
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

      {isPosting && <PostListingModal onClose={() => setIsPosting(false)} />}
    </div>
  )
}

function PostListingModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [slots, setSlots] = useState('1')
  const [deadline, setDeadline] = useState('')
  const [skills, setSkills] = useState('')
  const [description, setDescription] = useState('')
  
  const [publishImmediately, setPublishImmediately] = useState(true)
  const [requirements, setRequirements] = useState<PreEmploymentRequirement[]>([
    { id: Math.random().toString(36).slice(2), name: '', type: 'text', isPrintable: false }
  ])
  
  const addRequirement = () => {
    setRequirements([
      ...requirements,
      { id: Math.random().toString(36).slice(2), name: '', type: 'text', isPrintable: false }
    ])
  }
  
  const updateRequirement = (id: string, updates: Partial<PreEmploymentRequirement>) => {
    setRequirements(requirements.map(req => req.id === id ? { ...req, ...updates } : req))
  }
  
  const removeRequirement = (id: string) => {
    setRequirements(requirements.filter(req => req.id !== id))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Mock submit logic
    console.log('Submitted', { title, department, slots, deadline, skills, description, requirements })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', padding: '0', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div className="modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--brand-brown)', fontSize: '20px' }}>Post New Listing</h3>
          <button className="modal-close" onClick={onClose} type="button" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)' }}><X size={18} /></button>
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
          
          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>
              <input 
                type="checkbox" 
                checked={publishImmediately} 
                onChange={e => setPublishImmediately(e.target.checked)} 
                style={{ width: '16px', height: '16px' }}
              />
              Publish immediately (uncheck to save as draft)
            </label>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end', paddingTop: '16px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontWeight: 500 }}>Discard</button>
            <button type="submit" style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'var(--brand-orange)', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {publishImmediately ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  Publish
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"/></svg>
                  Save Draft
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

