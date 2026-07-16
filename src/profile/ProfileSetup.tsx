import { useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  completeProfile,
  uploadAvatar,
  uploadDocument,
} from '../lib/profile'
import { useAuth } from '../auth/context'
import { TagInput } from './TagInput'
import './profile.css'

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return 'Something went wrong. Please try again.'
}

export function ProfileSetup({
  mode = 'setup',
  onDone,
}: {
  /** 'setup' = first-time full page; 'edit' = embedded in the workspace. */
  mode?: 'setup' | 'edit'
  /** Called after a successful save (e.g. redirect to the dashboard). */
  onDone?: () => void
} = {}) {
  const { session, profile, signOut, refreshProfile, demo, updateProfileLocal } = useAuth()
  const isEdit = mode === 'edit'

  const [skills, setSkills] = useState<string[]>(profile?.skills ?? [])
  const [specializations, setSpecializations] = useState<string[]>(
    profile?.specializations ?? [],
  )
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile?.photo_url ?? null)
  const [resume, setResume] = useState<File | null>(null)
  const [portfolioLink, setPortfolioLink] = useState(profile?.portfolio_link ?? '')
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const userId = session?.user.id
  const first = profile?.first_name ?? ''
  const mi = profile?.middle_initial ?? ''
  const last = profile?.last_name ?? ''
  const suffix = profile?.suffix ?? ''
  const age = profile?.age != null ? String(profile.age) : ''
  const gender = profile?.gender ?? ''
  const address = profile?.address ?? ''
  const personalEmail = profile?.personal_email ?? ''
  const contactNumber = profile?.contact_number ?? ''
  const initials = `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || 'IC'

  function handlePhoto(file: File | null) {
    setPhoto(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : profile?.photo_url ?? null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    // Required fields (UC-S02).
    if (skills.length === 0) {
      setError('Please add at least one skill.')
      return
    }
    if (specializations.length === 0) {
      setError('Please add at least one specialization.')
      return
    }
    if (!userId) {
      setError('Your session expired. Please sign in again.')
      return
    }

    // Offline demo: no Supabase, so persist to local state instead of uploading.
    if (demo) {
      updateProfileLocal({
        skills,
        specializations,
        photo_url: photoPreview ?? null,
        resume_url: resume ? resume.name : profile?.resume_url ?? null,
        portfolio_link: portfolioLink.trim() || null,
        portfolio_file_url: portfolioFile ? portfolioFile.name : profile?.portfolio_file_url ?? null,
        profile_completed: true,
      })
      onDone?.() // Redirect to the dashboard after saving.
      return
    }

    setBusy(true)
    try {
      const photoUrl = photo ? await uploadAvatar(userId, photo) : profile?.photo_url ?? null
      const resumePath = resume
        ? await uploadDocument(userId, 'resume', resume)
        : profile?.resume_url ?? null
      const portfolioFilePath = portfolioFile
        ? await uploadDocument(userId, 'portfolio', portfolioFile)
        : profile?.portfolio_file_url ?? null

      await completeProfile(userId, {
        skills,
        specializations,
        photoUrl,
        resumePath,
        portfolioLink: portfolioLink.trim() || null,
        portfolioFilePath,
      })
      await refreshProfile()
      onDone?.() // Redirect to the dashboard after saving.
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const formCard = (
      <form className={`profile-card${isEdit ? ' embedded' : ''}`} onSubmit={handleSubmit}>
        <div className="profile-head">
          <h1>{isEdit ? 'My Profile' : 'Set up your profile'}</h1>
          <p>
            {isEdit
              ? 'Keep your skills, documents, and portfolio up to date — changes feed the AI matching system.'
              : 'Complete your profile so companies and the AI matching system can see your qualifications.'}
          </p>
        </div>

        {!isSupabaseConfigured && (
          <p className="profile-info">
            Demo preview — Supabase isn't connected, so uploads and saving won't
            persist yet.
          </p>
        )}

        {/* Read-only name (from registration / database) */}
        <section className="profile-section">
          <div className="profile-section-head">
            <h2>Name</h2>
            <span className="profile-locked">Locked · from your account</span>
          </div>
          <div className="profile-name-grid">
            <label>
              First name
              <input readOnly value={first} />
            </label>
            <label>
              M.I.
              <input readOnly value={mi} />
            </label>
            <label>
              Last name
              <input readOnly value={last} />
            </label>
            <label>
              Suffix
              <input readOnly value={suffix} />
            </label>
          </div>
        </section>

        {/* Personal details — captured at registration */}
        <section className="profile-section">
          <div className="profile-section-head">
            <h2>Personal information</h2>
            <span className="profile-locked">Locked · from your account</span>
          </div>
          <div className="profile-personal-grid">
            <label>
              Age
              <input readOnly value={age} />
            </label>
            <label>
              Gender
              <input readOnly value={gender} />
            </label>
            <label className="profile-field-span">
              Address
              <input readOnly value={address} />
            </label>
            <label>
              Personal email address
              <input readOnly value={personalEmail} />
            </label>
            <label>
              Contact number
              <input readOnly value={contactNumber} />
            </label>
          </div>
        </section>

        {/* Photo — optional */}
        <section className="profile-section">
          <div className="profile-section-head">
            <h2>Profile photo</h2>
            <span className="profile-optional">Optional · editable later</span>
          </div>
          <div className="profile-photo-row">
            <span className="profile-avatar">
              {photoPreview ? (
                <img alt="Profile preview" src={photoPreview} />
              ) : (
                initials
              )}
            </span>
            <label className="profile-upload">
              <input
                accept="image/*"
                hidden
                onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
                type="file"
              />
              {photo ? 'Change photo' : 'Upload photo'}
            </label>
            {photo && <span className="profile-filename">{photo.name}</span>}
          </div>
        </section>

        {/* Skills — required */}
        <section className="profile-section">
          <div className="profile-section-head">
            <h2>Skills</h2>
            <span className="profile-required">Required</span>
          </div>
          <TagInput
            onChange={setSkills}
            placeholder="Type a skill and press Enter (e.g. React, SQL, Figma)"
            tags={skills}
          />
        </section>

        {/* Specializations — required */}
        <section className="profile-section">
          <div className="profile-section-head">
            <h2>Specializations</h2>
            <span className="profile-required">Required</span>
          </div>
          <TagInput
            onChange={setSpecializations}
            placeholder="e.g. Marketing, Frontend, Backend, Software Dev"
            tags={specializations}
          />
        </section>

        {/* Resume — upload */}
        <section className="profile-section">
          <div className="profile-section-head">
            <h2>Resume / CV</h2>
            <span className="profile-optional">PDF or DOCX</span>
          </div>
          <label className="profile-upload block">
            <input
              accept=".pdf,.doc,.docx"
              hidden
              onChange={(e) => setResume(e.target.files?.[0] ?? null)}
              type="file"
            />
            {resume ? resume.name : 'Upload resume'}
          </label>
        </section>

        {/* Portfolio — link OR file */}
        <section className="profile-section">
          <div className="profile-section-head">
            <h2>Portfolio</h2>
            <span className="profile-optional">Link or file</span>
          </div>
          <label className="profile-field-label">
            Portfolio link
            <input
              onChange={(e) => setPortfolioLink(e.target.value)}
              placeholder="https://your-portfolio.com"
              type="url"
              value={portfolioLink}
            />
          </label>
          <div className="profile-or">or</div>
          <label className="profile-upload block">
            <input
              accept=".pdf,.zip,.doc,.docx"
              hidden
              onChange={(e) => setPortfolioFile(e.target.files?.[0] ?? null)}
              type="file"
            />
            {portfolioFile ? portfolioFile.name : 'Upload portfolio file'}
          </label>
        </section>

        {error && <p className="profile-error">{error}</p>}

        <button className="profile-submit" disabled={busy} type="submit">
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Save and continue'}
        </button>
      </form>
  )

  // Edit mode renders inside the workspace; setup mode is a full page.
  if (isEdit) return formCard

  return (
    <div className="profile-page">
      <header className="profile-topbar">
        <div className="profile-brand">
          <span className="profile-logo">IC</span>
          <span className="profile-brand-name">InternConnect</span>
        </div>
        <button className="profile-signout" onClick={signOut} type="button">
          Sign out
        </button>
      </header>
      {formCard}
    </div>
  )
}
