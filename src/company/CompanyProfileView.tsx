import { useState } from 'react'
import { CheckCircle2, FileText, Upload } from 'lucide-react'
import { TagInput } from '../profile/TagInput'

/**
 * UC-C01 — company profile with logo, details, verification documents, and
 * job specialty/fields (used to route relevant student matches).
 */
export function CompanyProfileView() {
  const [name, setName] = useState('Arcway Labs')
  const [industry, setIndustry] = useState('Software')
  const [size, setSize] = useState('51-200')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
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

  function handleLogo(file: File | null) {
    if (file) {
      const url = URL.createObjectURL(file)
      setLogoPreview(url)
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

      <section className="cp-card">
        <div className="cp-detail-head" style={{ marginBottom: 18 }}>
          <span className="cp-detail-avatar" style={{ overflow: 'hidden' }}>
            {logoPreview ? (
              <img src={logoPreview} alt="Company logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              name.slice(0, 2).toUpperCase()
            )}
          </span>
          <div className="cp-detail-main">
            <h2 className="cp-detail-name">{name}</h2>
            <span className="cp-badge success">Verified</span>
          </div>
          <label className="cp-secondary" style={{ display: 'inline-flex', cursor: 'pointer', alignItems: 'center', gap: '6px' }}>
            <Upload size={12} /> Upload logo
            <input 
              hidden 
              type="file" 
              accept="image/*" 
              onChange={(e) => handleLogo(e.target.files?.[0] ?? null)} 
            />
          </label>
        </div>

        <div className="cp-form-grid">
          <label>
            Company name
            <input onChange={(e) => setName(e.target.value)} value={name} />
          </label>
          <label>
            Industry
            <input onChange={(e) => setIndustry(e.target.value)} value={industry} />
          </label>
          <label>
            Company size
            <select onChange={(e) => setSize(e.target.value)} value={size}>
              {['1-10', '11-50', '51-200', '201-500', '500+'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Contact person email
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
        <h3>Job specialty / fields</h3>
        <p className="cp-muted" style={{ marginBottom: 10 }}>
          The fields your company hires interns for (e.g. Marketing, Frontend, Backend,
          Software Dev). These improve AI matching with student specializations.
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
