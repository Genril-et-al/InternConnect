import { useMemo, useState, useEffect } from 'react'
import { Eye, Plus, Search, Trash2, X } from 'lucide-react'
import type { CompanyApplicant, CompanyListing, PreEmploymentRequirement } from './companyData'
import type { NewListingInput } from './companyQueries'
import { useScrollLock } from '../lib/useScrollLock'
import { TagInput } from '../profile/TagInput'
import { SKILL_SUGGESTIONS } from '../lib/suggestions'
import { supabase } from '../lib/supabase'
import { signedDocumentUrl } from '../lib/profile'
import { ADMIN_EMAIL } from '../lib/constants'
import '../profile/profile.css'

/** UC-C03 — view and search the company's listings with applicant counts. */
export function CompanyListings({
  listings,
  applicants,
  verification,
  onCreate,
  onUpdate,
  onSetStatus,
  onDelete,
  highlightedListingId,
}: {
  listings: CompanyListing[]
  applicants: CompanyApplicant[]
  verification: 'pending' | 'verified' | 'rejected'
  onCreate: (input: NewListingInput) => Promise<void>
  onUpdate: (id: string, input: NewListingInput) => Promise<void>
  onSetStatus: (id: string, status: CompanyListing['status']) => Promise<void>
  onDelete: (id: string) => Promise<void>
  highlightedListingId?: string | null
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [isPosting, setIsPosting] = useState(false)
  const [editingListing, setEditingListing] = useState<CompanyListing | null>(null)
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
        <button
          className="cp-primary"
          type="button"
          disabled={verification !== 'verified'}
          onClick={() => setIsPosting(true)}
          style={{
            opacity: verification !== 'verified' ? 0.6 : 1,
            cursor: verification !== 'verified' ? 'not-allowed' : 'pointer'
          }}
        >
          <Plus size={14} /> Post New Listing
        </button>
      </div>

      {verification !== 'verified' && (
        <p className="cp-notice rejected">
          Your company is not yet verified — new listings cannot be posted until verification is approved.
          Contact the admin at{' '}
          <a href={`mailto:${ADMIN_EMAIL}`} style={{ color: 'inherit', fontWeight: 600 }}>{ADMIN_EMAIL}</a>{' '}
          to follow up.
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
                
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-light)', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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

      {(isPosting || editingListing) && (
        <PostListingModal 
          initialListing={editingListing}
          onClose={() => {
            setIsPosting(false)
            setEditingListing(null)
          }} 
          onSave={async (input) => {
            if (editingListing) {
              await onUpdate(editingListing.id, input)
            } else {
              await onCreate(input)
            }
          }} 
        />
      )}
      {previewListing && !isPosting && !editingListing && (
        <PreviewListingView
          listing={previewListing}
          onBack={() => setPreviewListing(null)}
          onEdit={() => {
            setEditingListing(previewListing)
            setPreviewListing(null)
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

  // The status pill's own variants — .status.success / .warning / .error in
  // App.css. The old markup asked for `neutral` and `rejected`, neither of
  // which exists, which is why every colour here used to be repeated inline.
  const statusVariant =
    listing.status === 'Open' ? 'success' : listing.status === 'Draft' ? 'warning' : 'error'

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onBack() }}>
      <div className="modal-panel listing-preview">
        <div className="listing-preview-bar">
          <button aria-label="Close" className="modal-close" onClick={onBack} type="button">
            <X size={16} />
          </button>
          <button className="cp-primary" onClick={onEdit} type="button">
            Edit Listing
          </button>
        </div>

        <p className="listing-preview-note">
          <Eye size={16} />
          This is a preview of how students will see your listing.
        </p>

        <div className="listing-preview-card listing-preview-header">
          <div>
            <h2>{listing.title}</h2>
            <p>{listing.department}</p>
          </div>
          <span className={`status ${statusVariant}`}>{listing.status}</span>
        </div>

        <div className="listing-preview-card">
          <h4 style={{ margin: '0 0 12px 0', color: 'var(--brand-brown)' }}>Description</h4>
          <p className="listing-preview-description" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{listing.description}</p>
        </div>

        <div className="listing-preview-card listing-preview-grid">
          <div>
            <span className="listing-preview-label">Department</span>
            <span className="listing-preview-value">{listing.department}</span>
          </div>
          <div>
            <span className="listing-preview-label">Available Slots</span>
            <span className="listing-preview-value">{listing.slots}</span>
          </div>
          <div>
            <span className="listing-preview-label">Deadline</span>
            <span className="listing-preview-value">{listing.deadline}</span>
          </div>
          <div>
            <span className="listing-preview-label">Allowance</span>
            <span className="listing-preview-value">{listing.hasAllowance ? 'Provided' : 'None'}</span>
          </div>
        </div>

        <section className="listing-preview-card">
          <h4>Required Skills</h4>
          <div className="listing-preview-tags">
            {listing.skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </section>

        {listing.requirements && listing.requirements.length > 0 && (
          <section className="listing-preview-card">
            <h4>Pre-employment Requirements</h4>
            <p className="listing-preview-subtext">
              These are hidden from students until they accept an offer.
            </p>
            <div className="listing-preview-reqs">
              {listing.requirements.map(req => (
                <div key={req.id} style={{ marginBottom: '12px' }}>
                  <span className="listing-preview-req-name">{req.name}</span>
                  <span className="listing-preview-req-meta">
                    {req.isPrintable ? 'Hardcopy Required' : 'File upload'}
                  </span>
                  {req.templateFileUrl && (
                    <div style={{ marginTop: '4px' }}>
                      <span className="listing-preview-req-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Template: <a href="#" onClick={async (e) => { e.preventDefault(); try { const url = await signedDocumentUrl(req.templateFileUrl!); window.open(url, '_blank'); } catch (err) { alert('Failed to get download link'); } }} style={{ color: 'var(--brand-orange)', textDecoration: 'underline' }}>Download template file</a>
                      </span>
                    </div>
                  )}
                  {req.description && (
                    <p style={{ marginTop: '6px', fontSize: '14px', color: 'var(--text-light)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                      {req.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function newRequirementId(): string {
  return Math.random().toString(36).slice(2)
}

function PostListingModal({ 
  initialListing,
  onClose, 
  onSave 
}: { 
  initialListing?: CompanyListing | null;
  onClose: () => void; 
  onSave: (input: NewListingInput) => Promise<void> 
}) {
  useScrollLock()

  const [title, setTitle] = useState(initialListing?.title || '')
  const [department, setDepartment] = useState(initialListing?.department || '')
  const [slots, setSlots] = useState(initialListing?.slots.toString() || '1')
  const [deadline, setDeadline] = useState(initialListing?.deadline || '')
  const [skills, setSkills] = useState<string[]>(() => {
    const initial = initialListing?.skills || []
    const splitTags = new Set<string>()
    for (const skill of initial) {
      for (const part of skill.split(',')) {
        if (part.trim()) splitTags.add(part.trim())
      }
    }
    return Array.from(splitTags)
  })
  const [description, setDescription] = useState(initialListing?.description || '')
  const [hasAllowance, setHasAllowance] = useState(initialListing?.hasAllowance ?? false)
  const [offerDeadlineDays, setOfferDeadlineDays] = useState(initialListing?.offerDeadlineDays?.toString() || '3')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const minDeadlineStr = initialListing
    ? ''
    : new Date(Date.now() + 7 * 86400000 - (new Date()).getTimezoneOffset() * 60000).toISOString().slice(0, 10)

  const [interviewMode, setInterviewMode] = useState<'none' | 'single' | 'multi'>(
    initialListing?.interviewProcess?.rounds.length === 0 ? 'none' : (initialListing?.interviewProcess?.rounds.length === 1 ? 'single' : 'multi')
  )
  const [interviewRounds, setInterviewRounds] = useState<string[]>(
    initialListing?.interviewProcess?.rounds || ['HR Screen', 'Technical Interview']
  )

  const publishImmediately = true
  const [requirements, setRequirements] = useState<PreEmploymentRequirement[]>(() => 
    initialListing?.requirements?.length ? initialListing.requirements : [{ id: newRequirementId(), name: '', type: 'text', isPrintable: false }]
  )

  const [uploadingReqId, setUploadingReqId] = useState<string | null>(null)

  const handleUploadTemplate = async (reqId: string, file: File) => {
    try {
      setUploadingReqId(reqId)
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
      const path = `templates/${reqId}-${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type, cacheControl: '0' })
      if (error) throw error
      updateRequirement(reqId, { templateFileUrl: path })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingReqId(null)
    }
  }

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
    if (description.length < 50) {
      setSaveError('Job description must be at least 50 characters long.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await onSave({
        title,
        department,
        slots: parseInt(slots) || 1,
        deadline,
        skills: skills,
        description,
        hasAllowance,
        offerDeadlineDays: parseInt(offerDeadlineDays) || 3,
        publish: publishImmediately,
        requirements: requirements
          .filter(r => r.name.trim() !== '')
          .map(r => ({
            name: r.name.trim(),
            type: r.isPrintable ? ('text' as const) : ('file' as const),
            isPrintable: r.isPrintable,
            description: r.description?.trim(),
            templateFileUrl: r.templateFileUrl || null
          })),
        interviewProcess: {
          rounds: interviewMode === 'none' ? [] : interviewMode === 'single' ? ['Interview'] : interviewRounds.filter(r => r.trim() !== '')
        }
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
        <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10, padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--brand-brown)', fontSize: '20px' }}>{initialListing ? 'Edit Listing' : 'Post New Listing'}</h3>
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
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--brand-brown)', fontSize: '14px' }}>Application Deadline</label>
              <input type="date" min={minDeadlineStr} value={deadline} onChange={e => setDeadline(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)' }} />
            </div>
            <div style={{ width: '180px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--brand-brown)', fontSize: '14px' }}>Offer Expiration (Days)</label>
              <input type="number" min="1" value={offerDeadlineDays} onChange={e => setOfferDeadlineDays(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)' }} title="Number of days the student has to accept an offer." />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-strong)', cursor: 'pointer', fontWeight: 500 }}>
            <input type="checkbox" checked={hasAllowance} onChange={e => setHasAllowance(e.target.checked)} style={{ width: '16px', height: '16px', margin: 0, cursor: 'pointer', accentColor: 'var(--brand-orange)' }} />
            Allowance provided
          </label>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--brand-brown)', fontSize: '14px' }}>Skills Needed <span style={{color:'var(--brand-crimson)'}}>*</span></label>
            <TagInput
              onChange={setSkills}
              placeholder="Type a skill and press Enter (e.g. React, Figma, TypeScript)"
              tags={skills}
              suggestions={SKILL_SUGGESTIONS}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--brand-brown)', fontSize: '14px' }}>Job Description / Responsibilities <span style={{color:'var(--brand-crimson)'}}>*</span></label>
            <textarea required value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the role, responsibilities, and qualifications..." style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', minHeight: '100px', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <h4 style={{ marginBottom: '8px', color: 'var(--brand-brown)', fontSize: '16px' }}>Interview Process <span style={{color:'var(--brand-crimson)'}}>*</span></h4>
            <p className="cp-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
              Configure how you want to interview applicants before making an offer.
            </p>
            
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '14px', color: 'var(--text)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="radio" checked={interviewMode === 'none'} onChange={() => setInterviewMode('none')} style={{ width: '16px', height: '16px', margin: 0 }} /> No Interview
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="radio" checked={interviewMode === 'single'} onChange={() => setInterviewMode('single')} style={{ width: '16px', height: '16px', margin: 0 }} /> Single Interview
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="radio" checked={interviewMode === 'multi'} onChange={() => setInterviewMode('multi')} style={{ width: '16px', height: '16px', margin: 0 }} /> Multi-stage Interview
              </label>
            </div>

            {interviewMode === 'multi' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-subtle)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                {interviewRounds.map((round, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--brand-brown)', width: '70px', fontSize: '13px' }}>Round {index + 1}</span>
                    <input 
                      required
                      placeholder="e.g. Technical Test" 
                      value={round} 
                      onChange={e => {
                        const newRounds = [...interviewRounds]
                        newRounds[index] = e.target.value
                        setInterviewRounds(newRounds)
                      }}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                    {interviewRounds.length > 1 && (
                      <button type="button" onClick={() => setInterviewRounds(interviewRounds.filter((_, i) => i !== index))} style={{ padding: '8px', background: 'transparent', color: 'var(--brand-crimson)', border: 'none', cursor: 'pointer' }} title="Remove round">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  type="button" 
                  onClick={() => setInterviewRounds([...interviewRounds, ''])}
                  style={{ alignSelf: 'flex-start', padding: '6px 12px', background: 'transparent', border: '1px dashed var(--brand-orange)', borderRadius: '6px', cursor: 'pointer', color: 'var(--brand-orange)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                >
                  <Plus size={14} /> Add another round
                </button>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <h4 style={{ marginBottom: '8px', color: 'var(--brand-brown)', fontSize: '16px' }}>Pre-employment Requirements <span className="cp-muted" style={{ fontSize: '13px', fontWeight: 400 }}>(optional)</span></h4>
            <p className="cp-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
              These will only be visible to students after they accept the internship offer. Use this to request medical certificates, NDAs, or other documents.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {requirements.map((req) => (
                <div key={req.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'var(--bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      placeholder="Requirement name (e.g., Medical Certificate)"
                      value={req.name} 
                      onChange={e => updateRequirement(req.id, { name: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '12px' }}
                    />
                    
                    <textarea 
                      placeholder="Text instruction for the student (optional)..." 
                      value={req.description || ''} 
                      onChange={e => updateRequirement(req.id, { description: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '12px', fontFamily: 'inherit', minHeight: '60px', resize: 'vertical', fontSize: '13px' }}
                    />

                    <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '6px', border: '1px dashed var(--border)', marginBottom: '12px' }}>
                      <p style={{ fontSize: '12px', marginBottom: '8px', color: 'var(--text-light)' }}>File upload (Optional template/document for the student):</p>
                      {req.templateFileUrl ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg)', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-strong)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            📄 {req.templateFileUrl.split('/').pop()}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateRequirement(req.id, { templateFileUrl: null })}
                            style={{ background: 'transparent', border: 'none', color: 'var(--brand-crimson)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <input 
                          type="file" 
                          disabled={uploadingReqId === req.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadTemplate(req.id, file)
                          }}
                          style={{ fontSize: '12px' }} 
                        />
                      )}
                      {uploadingReqId === req.id && <span style={{ fontSize: '12px', color: 'var(--brand-orange)', display: 'block', marginTop: '4px' }}>Uploading...</span>}
                    </div>

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'var(--bg-subtle)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: 'var(--text-light)' }}>
                      <input type="checkbox" checked={req.isPrintable} onChange={e => updateRequirement(req.id, { isPrintable: e.target.checked })} style={{ width: '14px', height: '14px', margin: 0 }} />
                      Hardcopy Required
                    </label>
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
              {initialListing ? (saving ? 'Saving...' : 'Save Changes') : (saving ? 'Publishing...' : 'Publish')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

