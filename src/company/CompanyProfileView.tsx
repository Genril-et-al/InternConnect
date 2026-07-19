import { useState, useRef, useEffect } from 'react'
import { CheckCircle2, FileText, Upload, Pencil, X } from 'lucide-react'
import { TagInput } from '../profile/TagInput'
import { useAuth } from '../auth/context'
import { uploadAvatar, removeAvatar } from '../lib/profile'
import { supabase } from '../lib/supabase'

/**
 * UC-C01 — company profile with logo, details, verification documents, and
 * job specialty/fields (used to route relevant student matches).
 */
export function CompanyProfileView() {
  const { profile, updateProfileLocal } = useAuth()
  const [name, setName] = useState('Arcway Labs')
  const [industry, setIndustry] = useState('Software')
  const [contactNumber, setContactNumber] = useState('09123456789')
  const [logoPreview, setLogoPreview] = useState<string | null>(profile?.photo_url ?? null)
  const [showLogoMenu, setShowLogoMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowLogoMenu(false)
      }
    }
    if (showLogoMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showLogoMenu])
  const [description, setDescription] = useState(
    'A Cebu-based software studio building internal tools and dashboards for growing companies.',
  )
  const [address, setAddress] = useState('IT Park, Lahug, Cebu City')
  const [website, setWebsite] = useState('https://arcwaylabs.com')
  const [contact, setContact] = useState('hr@arcwaylabs.com')
  // Job specialty / fields the company hires for.
  const [specialties, setSpecialties] = useState<string[]>([
    'Frontend',
    'Backend',
    'QA Automation',
  ])
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleLogo(file: File | null) {
    if (!profile) return
    try {
      if (file) {
        // Just optimistic UI preview before upload finishes could be added,
        // but since we want the sidebar to update reliably, we await it.
        const url = await uploadAvatar(profile.id, file)
        setLogoPreview(url)
        updateProfileLocal({ photo_url: url })
        await supabase.from('companies').update({ logo_url: url }).eq('owner_id', profile.id)
        await supabase.from('profiles').update({ photo_url: url }).eq('id', profile.id)
      } else {
        setLogoPreview(null)
        updateProfileLocal({ photo_url: null })
        await supabase.from('companies').update({ logo_url: null }).eq('owner_id', profile.id)
        await supabase.from('profiles').update({ photo_url: null }).eq('id', profile.id)
        if (profile.photo_url) {
          await removeAvatar(profile.id, profile.photo_url)
        }
      }
    } catch (err) {
      console.error('Failed to update logo:', err)
      alert('Failed to update logo')
    }
  }

  return (
    <div className="cp-root">
      <div className="cp-head">
        <div>
          <h1 className="cp-title">Company Profile</h1>
          <p className="cp-subtitle">Keep your profile accurate — students see this on your listings</p>
        </div>
      </div>

      {saved && (
        <p className="cp-toast">
          <CheckCircle2 size={14} /> Profile saved successfully!
        </p>
      )}

      {showPhotoModal && logoPreview && (
        <div 
          className="photo-modal-overlay"
          onClick={() => setShowPhotoModal(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button 
              onClick={() => setShowPhotoModal(false)}
              style={{ position: 'absolute', top: '-40px', right: 0, background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
              type="button"
            >
              <X size={32} />
            </button>
            <img src={logoPreview} alt="Company logo" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
          </div>
        </div>
      )}

      <section className="cp-card">
        <div className="cp-detail-head" style={{ marginBottom: 18 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <span 
              className="cp-detail-avatar" 
              onClick={() => { if (logoPreview) setShowPhotoModal(true) }}
              style={{ overflow: 'hidden', cursor: logoPreview ? 'pointer' : 'default' }}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Company logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                name.slice(0, 2).toUpperCase()
              )}
            </span>
            <div ref={menuRef} style={{ position: 'absolute', bottom: '0', right: '-4px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowLogoMenu(!showLogoMenu)
                }}
                style={{ 
                  background: 'var(--brand-orange)', color: 'white', borderRadius: '50%', width: '22px', 
                  height: '22px', minWidth: '22px', minHeight: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  cursor: 'pointer', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: 0, boxSizing: 'border-box'
                }}
                title="Edit logo options"
                type="button"
              >
                <Pencil size={10} />
              </button>
              
              {showLogoMenu && (
                <div 
                  style={{ 
                    position: 'absolute', top: '0', left: '100%', marginLeft: '8px',
                    background: 'var(--surface)', border: '1px solid var(--border)', 
                    borderRadius: '8px', padding: '4px', zIndex: 10, 
                    display: 'flex', flexDirection: 'column', gap: '2px', 
                    width: '130px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      fileInputRef.current?.click()
                      setShowLogoMenu(false)
                    }}
                    type="button"
                    style={{ background: 'transparent', border: 'none', padding: '6px 12px', fontSize: '13px', textAlign: 'left', cursor: 'pointer', borderRadius: '4px', width: '100%', color: 'var(--text)' }}
                  >
                    Change Photo
                  </button>
                  {logoPreview && (
                    <button
                      onClick={() => {
                        handleLogo(null)
                        setShowLogoMenu(false)
                      }}
                      type="button"
                      style={{ background: 'transparent', border: 'none', padding: '6px 12px', fontSize: '13px', textAlign: 'left', cursor: 'pointer', color: 'var(--brand-crimson)', borderRadius: '4px', width: '100%' }}
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
              )}
              
              <input 
                ref={fileInputRef}
                hidden 
                type="file" 
                accept="image/*" 
                onChange={(e) => {
                  handleLogo(e.target.files?.[0] ?? null)
                  setShowLogoMenu(false)
                }} 
              />
            </div>
          </div>
          <div className="cp-detail-main">
            <h2 className="cp-detail-name">{name}</h2>
            <span className="cp-badge success">Verified</span>
          </div>
        </div>

        <div className="cp-form-grid">
          <label>
            Company Name
            <input onChange={(e) => setName(e.target.value)} value={name} />
          </label>
          <label>
            Industry
            <input onChange={(e) => setIndustry(e.target.value)} value={industry} />
          </label>
          <label>
            Contact Number
            <input type="tel" onChange={(e) => setContactNumber(e.target.value)} value={contactNumber} />
          </label>
          <label>
            Contact Person Email
            <input onChange={(e) => setContact(e.target.value)} type="email" value={contact} />
          </label>
          <label className="cp-form-span cp-form-label">
            Description
            <textarea onChange={(e) => setDescription(e.target.value)} value={description} />
          </label>
          <label>
            Address
            <input onChange={(e) => setAddress(e.target.value)} value={address} />
          </label>
          <label>
            Website / LinkedIn
            <input onChange={(e) => setWebsite(e.target.value)} type="url" value={website} />
          </label>
        </div>
      </section>

      {/* Job specialty / fields */}
      <section className="cp-card">
        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0', color: 'var(--brand-brown)' }}>Job Specialty / Fields</h3>
        <p className="cp-muted" style={{ marginBottom: 16 }}>
          The fields your company hires interns for (e.g. Marketing, Frontend, Backend,
          Software Dev). These improve matching with student specializations.
        </p>
        <TagInput
          onChange={setSpecialties}
          placeholder="Type a field and press Enter (e.g. Frontend, Marketing)"
          tags={specialties}
        />
      </section>

      <section className="cp-card">
        <h3>Verification documents</h3>
        {['Business_Permit_2026.pdf', 'DTI_Registration.pdf'].map((doc) => (
          <div className="cp-doc" key={doc}>
            <FileText size={14} />
            <span className="cp-doc-name">{doc}</span>
            <span className="cp-badge success">Verified</span>
          </div>
        ))}
        <label className="cp-upload" style={{ marginTop: 8 }}>
          <input hidden type="file" />
          <Upload size={14} /> Upload new document
        </label>
      </section>

      <button className="cp-primary" onClick={handleSave} style={{ alignSelf: 'flex-start' }} type="button">
        Save Changes
      </button>
    </div>
  )
}
