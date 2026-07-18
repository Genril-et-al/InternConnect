import { useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  completeProfile,
  markResumeReplaced,
  removeAvatar,
  removeDocument,
  uploadAvatar,
  uploadDocument,
  signedDocumentUrl,
} from '../lib/profile'
import { analyzeResume, NO_SKILLS_MESSAGE } from '../lib/resumeAnalysis'
import { formatMiddleInitial } from '../lib/name'
import { useAuth } from '../auth/context'
import { SignOutButton } from '../components/SignOutButton'
import { TagInput } from './TagInput'
import { Pencil, Trash2, X } from 'lucide-react'
import './profile.css'

/** Case-insensitive union of manually typed and AI-extracted tags. */
function mergeTags(current: string[], extracted: string[]): string[] {
  const seen = new Set(current.map((t) => t.toLowerCase()))
  const merged = [...current]
  for (const tag of extracted) {
    if (!seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase())
      merged.push(tag)
    }
  }
  return merged
}

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
  const { session, profile, refreshProfile, demo, updateProfileLocal } = useAuth()
  const isEdit = mode === 'edit'

  const [skills, setSkills] = useState<string[]>(profile?.skills ?? [])
  const [specializations, setSpecializations] = useState<string[]>(
    profile?.specializations ?? [],
  )
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile?.photo_url ?? null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [resume, setResume] = useState<File | null>(null)
  const [portfolioLink, setPortfolioLink] = useState(profile?.portfolio_link ?? '')
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null)
  // Personal details — filled here on the profile (not during sign-up).
  const [age, setAge] = useState(profile?.age != null ? String(profile.age) : '')
  const [sex, setSex] = useState(profile?.gender ?? '')
  const [address, setAddress] = useState(profile?.address ?? '')
  const [personalEmail, setPersonalEmail] = useState(profile?.personal_email ?? '')
  const [contactNumber, setContactNumber] = useState(profile?.contact_number ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  // Set when the AI found nothing to match in the uploaded resume — the
  // student must upload a new one before it counts for matching.
  const [resumeRejected, setResumeRejected] = useState<{
    fileName: string
    message: string
    suggestion: string | null
  } | null>(
    profile?.resume_status === 'no_skills_found'
      ? {
        fileName: 'your current resume',
        message: NO_SKILLS_MESSAGE,
        suggestion: profile?.resume_ai_suggestion ?? null,
      }
      : null,
  )

  const userId = session?.user.id
  const first = profile?.first_name ?? ''
  const mi = formatMiddleInitial(profile?.middle_initial)
  const last = profile?.last_name ?? ''
  const suffix = profile?.suffix ?? ''
  const initials = `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || 'IC'

  const displayResumeName = resume 
    ? (last ? `${last}_resume.${resume.name.split('.').pop()}` : resume.name)
    : profile?.resume_url 
      ? (last ? `${last}_resume.${profile.resume_url.split('.').pop()}` : profile.resume_url.split('/').pop())
      : null

  function handlePhoto(file: File | null) {
    setPhoto(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : profile?.photo_url ?? null)
  }

  function handleDeletePhoto() {
    setPhoto(null)
    setPhotoPreview(null)
  }

  async function handleViewDocument(path: string | null | undefined, downloadName?: string) {
    if (!path) return
    if (demo) {
      alert('In demo mode, files are not actually uploaded to the server, so they cannot be viewed.')
      return
    }
    setBusy(true)
    try {
      const url = await signedDocumentUrl(path, downloadName)
      window.open(url, '_blank')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Re-run the AI over the resume already on file. Without this, analysis only
   * ever ran on a fresh upload, so a resume stored before the AI worked could
   * never get a status without re-uploading the same document.
   */
  async function handleAnalyzeExisting() {
    if (!profile?.resume_url || demo) return
    setAnalyzing(true)
    setError('')
    try {
      const result = await analyzeResume(profile.resume_url)
      if (result.status === 'no_skills_found') {
        setResumeRejected({
          fileName: displayResumeName ?? 'your current resume',
          message: result.message || NO_SKILLS_MESSAGE,
          suggestion: result.suggestion ?? null,
        })
      } else if (result.status === 'unsupported_format') {
        setError(result.message)
      } else {
        setSkills((prev) => mergeTags(prev, result.skills))
        setSpecializations((prev) => mergeTags(prev, result.specializations))
        setResumeRejected(null)
      }
      await refreshProfile()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setAnalyzing(false)
    }
  }

  /**
   * Picking a new resume clears the previous AI rejection straight away — that
   * banner described the old file, so leaving it up makes a fresh upload look
   * rejected before it has even been analyzed.
   */
  function handlePickResume(file: File | null) {
    setResume(file)
    if (file) {
      setResumeRejected(null)
      setError('')
    }

  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    // Required fields (UC-S02). When a new resume is attached, the AI analysis
    // below may fill these in — so only hard-require them if there's no resume
    // for the AI to read.
    if (!resume) {
      if (skills.length === 0) {
        setError('Please add at least one skill.')
        return
      }
      if (specializations.length === 0) {
        setError('Please add at least one specialization.')
        return
      }
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
        age: Number.parseInt(age, 10) || null,
        gender: sex.trim() || null,
        address: address.trim() || null,
        personal_email: personalEmail.trim() || null,
        contact_number: contactNumber.trim() || null,
        profile_completed: true,
      })
      onDone?.() // Redirect to the dashboard after saving.
      return
    }

    setBusy(true)
    // Captured up front so the files being replaced can be cleaned up *after*
    // the profile row commits, never before.
    const prevPhotoUrl = profile?.photo_url ?? null
    const prevResumePath = profile?.resume_url ?? null
    const prevPortfolioPath = profile?.portfolio_file_url ?? null
    try {
      const photoUrl = photo
        ? await uploadAvatar(userId, photo)
        : (photoPreview ? profile?.photo_url : null)
      const resumePath = resume
        ? await uploadDocument(userId, 'resume', resume)
        : profile?.resume_url ?? null

      // A new resume invalidates the previous AI verdict immediately, so a
      // stale rejection can't outlive the file it was about.
      if (resume && resumePath) {
        await markResumeReplaced(userId)
      }

      // AI analysis (cloud-side): read the new resume with Gemini and extract
      // skills/specializations. Runs only when a new resume was uploaded.
      let mergedSkills = skills
      let mergedSpecializations = specializations
      if (resume && resumePath) {
        setAnalyzing(true)
        try {
          const result = await analyzeResume(resumePath)
          if (result.status === 'no_skills_found') {
            // The resume can't be matched — flag it and require a new upload.
            setResumeRejected({
              fileName: resume.name,
              message: result.message || NO_SKILLS_MESSAGE,
              suggestion: result.suggestion ?? null,
            })
            setResume(null)
            return
          }
          if (result.status === 'unsupported_format') {
            setError(result.message)
            setResume(null)
            return
          }
          // Merge AI-extracted tags with anything the student typed; the
          // student sees the combined list and can edit it afterwards.
          mergedSkills = mergeTags(skills, result.skills)
          mergedSpecializations = mergeTags(specializations, result.specializations)
          setSkills(mergedSkills)
          setSpecializations(mergedSpecializations)
          setResumeRejected(null)
        } catch {
          // AI is an accelerator, not a gate — a Gemini outage shouldn't block
          // saving, as long as the student entered skills manually.
          if (skills.length === 0 || specializations.length === 0) {
            setError(
              'We could not analyze your resume right now. Please add your skills and specializations manually, then save again.',
            )
            return
          }
        } finally {
          setAnalyzing(false)
        }
      }

      if (mergedSkills.length === 0 || mergedSpecializations.length === 0) {
        setError(
          'Your resume did not include enough to fill your skills and specializations. Please add them manually.',
        )
        return
      }

      const portfolioFilePath = portfolioFile
        ? await uploadDocument(userId, 'portfolio', portfolioFile)
        : profile?.portfolio_file_url ?? null

      await completeProfile(userId, {
        skills: mergedSkills,
        specializations: mergedSpecializations,
        photoUrl,
        resumePath,
        portfolioLink: portfolioLink.trim() || null,
        portfolioFilePath,
        age: age.trim() ? Number(age) : null,
        gender: sex.trim() || null,
        address: address.trim() || null,
        personalEmail: personalEmail.trim() || null,
        contactNumber: contactNumber.trim() || null,
      })
      await refreshProfile()

      // The row now points at the new files, so the replaced ones are safe to
      // drop. Best-effort: an orphaned file is harmless, a missing one is not.
      try {
        if (resumePath !== prevResumePath) await removeDocument(userId, prevResumePath)
        if (portfolioFilePath !== prevPortfolioPath) await removeDocument(userId, prevPortfolioPath)
        if (photoUrl !== prevPhotoUrl) await removeAvatar(userId, prevPhotoUrl)
      } catch {
        /* cleanup failure must not fail the save */
      }

      onDone?.() // Redirect to the dashboard after saving.
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const formCard = (
    <>
      {showPhotoModal && photoPreview && (
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
            <img src={photoPreview} alt="Profile" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
          </div>
        </div>
      )}
      <form className={`profile-card${isEdit ? ' embedded' : ''}`} onSubmit={handleSubmit}>
      <div className="profile-head">
        <h1>{isEdit ? 'My Profile' : 'Set up your profile'}</h1>
        <p>
          {isEdit
            ? 'Keep your skills, documents, and portfolio up to date — changes feed the matching system.'
            : 'Complete your profile so companies and the matching system can see your qualifications.'}
        </p>
      </div>

      {!isSupabaseConfigured && (
        <p className="profile-info">
          Demo preview — Supabase isn't connected, so uploads and saving won't
          persist yet.
        </p>
      )}

      {/* Photo — required */}
      <section className="profile-section">
        <div className="profile-section-head">
          <h2>Formal photo</h2>
          <span className="profile-required">Required</span>
        </div>
        <p className="profile-subtext">
          Upload a recent 2×2 ID photo with a white background and a formal, front-facing pose.
        </p>
        <div className="profile-photo-row">
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <span 
              className="profile-avatar" 
              onClick={() => { if (photoPreview) setShowPhotoModal(true) }}
              style={{ cursor: photoPreview ? 'pointer' : 'default' }}
            >
              {photoPreview ? (
                <img alt="Profile preview" src={photoPreview} />
              ) : (
                initials
              )}
            </span>
            <label 
              style={{ 
                position: 'absolute', bottom: '0px', right: '-8px', background: 'var(--brand-orange)', 
                color: 'white', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', 
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              title="Edit photo"
            >
              <Pencil size={14} />
              <input
                accept="image/*"
                hidden
                onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
          </div>
          {photoPreview && (
            <button
              className="profile-delete-btn"
              onClick={handleDeletePhoto}
              title="Delete photo"
              type="button"
            >
              <Trash2 size={16} />
            </button>
          )}
          {photo && <span className="profile-filename">{photo.name}</span>}
        </div>
      </section>

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

      {/* Personal details — filled here, not during sign-up */}
      <section className="profile-section">
        <div className="profile-section-head">
          <h2>Personal information</h2>
          <span className="profile-optional">Optional · editable anytime</span>
        </div>
        <div className="profile-personal-grid">
          <label>
            Age
            <input
              inputMode="numeric"
              min={0}
              onChange={(e) => setAge(e.target.value)}
              type="number"
              value={age}
            />
          </label>
          <label>
            Sex
            <select
              onChange={(e) => setSex(e.target.value)}
              required
              value={sex}
            >
              <option value="" disabled>Select...</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </label>
          <label className="profile-field-span">
            Address
            <input
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, City, Province"
              value={address}
            />
          </label>
          <label>
            Personal email address
            <input
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="name@gmail.com"
              type="email"
              value={personalEmail}
            />
          </label>
          <label>
            Contact number
            <input
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="09XX XXX XXXX"
              type="tel"
              value={contactNumber}
            />
          </label>
        </div>
      </section>

      {/* Skills — optional */}
      <section className="profile-section">
        <div className="profile-section-head">
          <h2>Skills</h2>
          <span className="profile-optional">Optional</span>
        </div>
        <TagInput
          onChange={setSkills}
          placeholder="Type a skill and press Enter (e.g. React, SQL, Figma)"
          tags={skills}
        />
      </section>

      {/* Specializations — optional */}
      <section className="profile-section">
        <div className="profile-section-head">
          <h2>Specializations</h2>
          <span className="profile-optional">Optional</span>
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
        <div>
          {resume || profile?.resume_url ? (
            <div className="profile-upload block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'default' }}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
              <button
                type="button"
                onClick={() => {
                  if (resume) {
                    window.open(URL.createObjectURL(resume), '_blank')
                  } else {
                    handleViewDocument(profile?.resume_url)
                  }
                }}
                style={{ background: 'none', border: 'none', color: 'var(--brand-orange)', textDecoration: 'underline', padding: 0, cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
              >
                {displayResumeName}
              </button>
              {/*
                The display name is derived from the surname, so picking a new
                file of the same type produces an identical label and the card
                looks unchanged. Name the pending file explicitly.
              */}
              {resume && (
                <span style={{ fontSize: '12px', color: 'var(--brand-orange)', fontWeight: 500 }}>
                  New file selected: {resume.name} — save to apply
                </span>
              )}
              </span>
              <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {!resume && profile?.resume_url && !demo && (
                  <button
                    disabled={analyzing || busy}
                    onClick={handleAnalyzeExisting}
                    style={{ cursor: analyzing ? 'wait' : 'pointer', background: 'var(--surface)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-strong)' }}
                    title="Run the AI over the resume already on file"
                    type="button"
                  >
                    {analyzing ? 'Analyzing…' : 'Analyze with AI'}
                  </button>
                )}
                <label style={{ cursor: 'pointer', background: 'var(--surface)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-strong)' }}>
                  Change
                  <input
                    accept=".pdf,.doc,.docx"
                    hidden
                    onChange={(e) => {
                      handlePickResume(e.target.files?.[0] ?? null)
                      // Clearing the value lets re-selecting the SAME filename
                      // fire change again; otherwise the picker looks dead.
                      e.target.value = ''
                    }}
                    type="file"
                  />
                </label>
              </span>
            </div>
          ) : (
            <label className="profile-upload block">
              <input
                accept=".pdf,.doc,.docx"
                hidden
                onChange={(e) => {
                  handlePickResume(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
                type="file"
              />
              {resumeRejected ? 'Upload a new resume' : 'Upload resume'}
            </label>
          )}
        </div>
        {!resume && resumeRejected && (
          <p className="profile-resume-rejected" role="alert">
            <strong>{resumeRejected.message}</strong>{' '}
            The resume you submitted ({resumeRejected.fileName}) could not be
            matched — please upload a new one.
            {resumeRejected.suggestion && (
              <>
                {' '}
                <em>Recommendation: {resumeRejected.suggestion}</em>
              </>
            )}
          </p>
        )}
        <p className="profile-info">
          Your resume is read by our AI (in the cloud) to auto-fill your
          skills and specializations for matching.
        </p>
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
        <div>
          {portfolioFile || profile?.portfolio_file_url ? (
            <div className="profile-upload block" style={{ display: 'flex', justifyContent: 'space-between', cursor: 'default' }}>
              <button
                type="button"
                onClick={() => {
                  if (portfolioFile) {
                    window.open(URL.createObjectURL(portfolioFile), '_blank')
                  } else {
                    handleViewDocument(profile?.portfolio_file_url)
                  }
                }}
                style={{ background: 'none', border: 'none', color: 'var(--brand-orange)', textDecoration: 'underline', padding: 0, cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
              >
                {portfolioFile ? portfolioFile.name : profile?.portfolio_file_url?.split('/').pop()}
              </button>
              <label style={{ cursor: 'pointer', background: 'var(--surface)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-strong)' }}>
                Change
                <input
                  accept=".pdf,.zip,.doc,.docx"
                  hidden
                  onChange={(e) => setPortfolioFile(e.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>
            </div>
          ) : (
            <label className="profile-upload block">
              <input
                accept=".pdf,.zip,.doc,.docx"
                hidden
                onChange={(e) => setPortfolioFile(e.target.files?.[0] ?? null)}
                type="file"
              />
              Upload portfolio file
            </label>
          )}
        </div>
      </section>

      {error && <p className="profile-error">{error}</p>}

      <button className="profile-submit" disabled={busy} type="submit">
        {analyzing
          ? 'Analyzing your resume…'
          : busy
            ? 'Saving…'
            : isEdit
              ? 'Save changes'
              : 'Save and continue'}
      </button>
    </form>
    </>
  )

  // Edit mode renders inside the workspace; setup mode is a full page.
  if (isEdit) return formCard

  return (
    <div className="profile-page">
      <header className="profile-topbar">
        <div className="profile-brand">
          <img className="profile-logo" src="/logo.png" alt="InternConnect" />
          <span className="profile-brand-name">InternConnect</span>
        </div>
        <SignOutButton className="profile-signout">
          Sign out
        </SignOutButton>
      </header>
      {formCard}
    </div>
  )
}
