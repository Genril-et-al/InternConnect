import { useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  completeProfile,
  uploadAvatar,
  uploadDocument,
} from '../lib/profile'
import { analyzeResume, NO_SKILLS_MESSAGE } from '../lib/resumeAnalysis'
import { useAuth } from '../auth/context'
import { SignOutButton } from '../components/SignOutButton'
import { TagInput } from './TagInput'
import { Trash2 } from 'lucide-react'
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
  const [resume, setResume] = useState<File | null>(null)
  const [portfolioLink, setPortfolioLink] = useState(profile?.portfolio_link ?? '')
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null)
  // Personal details — filled here on the profile (not during sign-up).
  const [age, setAge] = useState(profile?.age != null ? String(profile.age) : '')
  const [gender, setGender] = useState(profile?.gender ?? '')
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
  const mi = profile?.middle_initial ?? ''
  const last = profile?.last_name ?? ''
  const suffix = profile?.suffix ?? ''
  const initials = `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || 'IC'

  function handlePhoto(file: File | null) {
    setPhoto(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : profile?.photo_url ?? null)
  }

  function handleDeletePhoto() {
    setPhoto(null)
    setPhotoPreview(null)
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
        age: age.trim() ? Number(age) : null,
        gender: gender.trim() || null,
        address: address.trim() || null,
        personal_email: personalEmail.trim() || null,
        contact_number: contactNumber.trim() || null,
        profile_completed: true,
      })
      onDone?.() // Redirect to the dashboard after saving.
      return
    }

    setBusy(true)
    try {
      const photoUrl = photo 
        ? await uploadAvatar(userId, photo) 
        : (photoPreview ? profile?.photo_url : null)
      const resumePath = resume
        ? await uploadDocument(userId, 'resume', resume)
        : profile?.resume_url ?? null

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
        gender: gender.trim() || null,
        address: address.trim() || null,
        personalEmail: personalEmail.trim() || null,
        contactNumber: contactNumber.trim() || null,
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
            Gender
            <input
              onChange={(e) => setGender(e.target.value)}
              placeholder="e.g. Male, Female, Non-binary"
              value={gender}
            />
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
        <label className="profile-upload block">
          <input
            accept=".pdf,.doc,.docx"
            hidden
            onChange={(e) => setResume(e.target.files?.[0] ?? null)}
            type="file"
          />
          {resume
            ? resume.name
            : resumeRejected
              ? 'Upload a new resume'
              : 'Upload resume'}
        </label>
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
        {analyzing
          ? 'Analyzing your resume…'
          : busy
            ? 'Saving…'
            : isEdit
              ? 'Save changes'
              : 'Save and continue'}
      </button>
    </form>
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
