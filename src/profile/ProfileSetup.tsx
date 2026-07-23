import { useEffect, useRef, useState } from 'react'
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
import { analyzeResume, NO_SKILLS_MESSAGE, NAME_MISMATCH_MESSAGE } from '../lib/resumeAnalysis'
import { formatMiddleInitial } from '../lib/name'
import { setUnsavedGuard } from '../lib/unsavedGuard'
import { useAuth } from '../auth/context'
import { SignOutButton } from '../components/SignOutButton'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TagInput } from './TagInput'
import { SKILL_SUGGESTIONS, SPECIALIZATION_SUGGESTIONS } from '../lib/suggestions'
import { PhotoLightbox } from '../components/PhotoLightbox'
import { Pencil, Trash2 } from 'lucide-react'
import './profile.css'
/**
 * Tag lists compare as unordered sets — analysis reorders skills (AI-extracted
 * ones move to the front), and a reorder alone isn't an unsaved change.
 */
function sameTags(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const normalise = (list: string[]) => list.map((t) => t.toLowerCase()).sort()
  const [left, right] = [normalise(a), normalise(b)]
  return left.every((tag, i) => tag === right[i])
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

  // When the ai_skills column hasn't been populated yet (migration not applied
  // or profile predates the feature) but the resume was already analyzed, fall
  // back to treating all existing skills as AI-extracted. Once the student
  // re-analyzes or saves, the real ai_skills column takes over.
  const fallbackAiSkills =
    (profile?.ai_skills?.length ?? 0) === 0 && profile?.resume_status === 'analyzed'
      ? (profile?.skills ?? [])
      : (profile?.ai_skills ?? [])
  const fallbackAiSpecializations =
    (profile?.ai_specializations?.length ?? 0) === 0 && profile?.resume_status === 'analyzed'
      ? (profile?.specializations ?? [])
      : (profile?.ai_specializations ?? [])

  const [aiSkills, setAiSkills] = useState<string[]>(fallbackAiSkills)
  const [aiSpecializations, setAiSpecializations] = useState<string[]>(fallbackAiSpecializations)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile?.photo_url ?? null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [resume, setResume] = useState<File | null>(null)
  const [coverLetter, setCoverLetter] = useState<File | null>(null)
  const [portfolioLink, setPortfolioLink] = useState(profile?.portfolio_link ?? '')
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null)
  const [portfolioFileRemoved, setPortfolioFileRemoved] = useState(false)

  const hasLink = portfolioLink.trim().length > 0
  const hasFile = portfolioFile !== null || (!!profile?.portfolio_file_url && !portfolioFileRemoved)

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
    profile?.resume_status === 'no_skills_found' || profile?.resume_status === 'name_mismatch'
      ? {
        fileName: 'your current resume',
        message:
          profile.resume_status === 'name_mismatch' ? NAME_MISMATCH_MESSAGE : NO_SKILLS_MESSAGE,
        suggestion: profile?.resume_ai_suggestion ?? null,
      }
      : null,
  )

  // Set while saving (and after a successful save) so the unsaved-changes
  // guard doesn't challenge the redirect the save itself triggers.
  const savingRef = useRef(false)

  // Unsaved work is anything the student changed that isn't on the profile row
  // yet: edited fields, files picked but not uploaded, or a resume analysis
  // whose extracted skills only exist in local state until Save.
  const dirty =
    !sameTags(skills, profile?.skills ?? []) ||
    !sameTags(specializations, profile?.specializations ?? []) ||
    // Compared against the same fallback the state was seeded from, so a legacy
    // profile with an empty ai_skills column doesn't read as dirty on mount.
    !sameTags(aiSkills, fallbackAiSkills) ||
    !sameTags(aiSpecializations, fallbackAiSpecializations) ||
    photo !== null ||
    resume !== null ||
    coverLetter !== null ||
    portfolioFile !== null ||
    portfolioFileRemoved ||
    photoPreview !== (profile?.photo_url ?? null) ||
    portfolioLink !== (profile?.portfolio_link ?? '') ||
    age !== (profile?.age != null ? String(profile.age) : '') ||
    sex !== (profile?.gender ?? '') ||
    address !== (profile?.address ?? '') ||
    personalEmail !== (profile?.personal_email ?? '') ||
    contactNumber !== (profile?.contact_number ?? '')

  // In-app navigation (sidebar, account card) routes through this guard. The
  // navigation is parked here while the student answers the modal below.
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)

  useEffect(() => {
    if (!dirty) return
    setUnsavedGuard((proceed) => {
      if (savingRef.current) {
        proceed()
        return
      }
      // Wrapped in a function: setState treats a bare function argument as an
      // updater, which would call the navigation instead of storing it.
      setPendingLeave(() => proceed)
    })
    return () => setUnsavedGuard(null)
  }, [dirty])

  // Closing or reloading the tab is outside React's reach — the browser shows
  // its own generic prompt when the event is cancelled.
  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) {
      if (savingRef.current) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

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

  const displayCoverLetterName = coverLetter
    ? (last ? `${last}_cover_letter.${coverLetter.name.split('.').pop()}` : coverLetter.name)
    : profile?.cover_letter_url
      ? (last ? `${last}_cover_letter.${profile.cover_letter_url.split('.').pop()}` : profile.cover_letter_url.split('/').pop())
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
      } else if (result.status === 'name_mismatch') {
        // The resume on file belongs to someone else — drop its extracted
        // skills so a stale match can't linger, and flag it for re-upload.
        setAiSkills([])
        setAiSpecializations([])
        setResumeRejected({
          fileName: displayResumeName ?? 'your current resume',
          message: result.message || NAME_MISMATCH_MESSAGE,
          suggestion: result.suggestion ?? null,
        })
      } else if (result.status === 'unsupported_format') {
        setError(result.message)
      } else {
        setAiSkills(result.skills)
        setAiSpecializations(result.specializations)
        setSkills((prev) => {
          const oldManualSkills = prev.filter(s => !aiSkills.some(oldAi => oldAi.toLowerCase() === s.toLowerCase()))
          return [...result.skills, ...oldManualSkills.filter(s => !result.skills.some(rs => rs.toLowerCase() === s.toLowerCase()))]
        })
        setSpecializations((prev) => {
          const oldManualSpecializations = prev.filter(s => !aiSpecializations.some(oldAi => oldAi.toLowerCase() === s.toLowerCase()))
          return [...result.specializations, ...oldManualSpecializations.filter(s => !result.specializations.some(rs => rs.toLowerCase() === s.toLowerCase()))]
        })
        setResumeRejected(null)
      }
      // Deliberately no refreshProfile() here. The extracted skills live in
      // local state until the student saves, and pulling a fresh profile
      // re-runs StudentPortal's listings effect, which blanks the workspace
      // long enough to unmount this form — taking the new skills with it.
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
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setError('Only PDF files are supported for resume uploads.')
        return
      }
      setResume(file)
      setResumeRejected(null)
      setError('')
    } else {
      setResume(null)
    }
  }

  function handlePickPortfolio(file: File | null) {
    if (hasLink) return
    if (file) {
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'
      if (!isPdf) {
        setError('Only PDF files are supported for portfolio uploads.')
        return
      }
      setPortfolioFile(file)
      setPortfolioFileRemoved(false)
      setError('')
    } else {
      setPortfolioFile(null)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (!address.trim()) {
      setError('Please provide your address.')
      return
    }
    if (!contactNumber.trim()) {
      setError('Please provide your contact number.')
      return
    }

    // Required fields (UC-S02). When a new resume is attached, the AI analysis
    // below may fill these in — so only hard-require them if there's no resume
    // for the AI to read.
    if (!resume) {
      // First-time setup has no tag inputs, so the resume is the only way in:
      // point at the upload instead of a field that isn't on the page.
      if (!isEdit && (skills.length === 0 || specializations.length === 0)) {
        setError(
          'Please upload your resume so we can fill in your skills and specializations.',
        )
        return
      }
      if (isEdit && skills.length === 0) {
        setError('Please add at least one skill.')
        return
      }
      if (isEdit && specializations.length === 0) {
        setError('Please add at least one specialization.')
        return
      }
    }
    if (!userId) {
      setError('Your session expired. Please sign in again.')
      return
    }

    // Past validation, so the save is going ahead — stop the guard challenging
    // the redirect this triggers. Cleared again if the save fails.
    savingRef.current = true

    // Offline demo: no Supabase, so persist to local state instead of uploading.
    if (demo) {
      updateProfileLocal({
        skills,
        specializations,
        ai_skills: aiSkills,
        ai_specializations: aiSpecializations,
        photo_url: photoPreview ?? null,
        resume_url: resume ? resume.name : profile?.resume_url ?? null,
        cover_letter_url: coverLetter ? coverLetter.name : profile?.cover_letter_url ?? null,
        portfolio_link: hasLink ? portfolioLink.trim() : null,
        portfolio_file_url: hasLink
          ? null
          : portfolioFileRemoved
            ? null
            : portfolioFile
              ? portfolioFile.name
              : (profile?.portfolio_file_url ?? null),
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
    const prevCoverLetterPath = profile?.cover_letter_url ?? null
    const prevPortfolioPath = profile?.portfolio_file_url ?? null
    try {
      const photoUrl = photo
        ? await uploadAvatar(userId, photo)
        : (photoPreview ? profile?.photo_url : null)
      const resumePath = resume
        ? await uploadDocument(userId, 'resume', resume)
        : profile?.resume_url ?? null
      const coverLetterPath = coverLetter
        ? await uploadDocument(userId, 'cover_letter', coverLetter)
        : profile?.cover_letter_url ?? null

      // A new resume invalidates the previous AI verdict immediately, so a
      // stale rejection can't outlive the file it was about.
      if (resume && resumePath) {
        await markResumeReplaced(userId)
      }

      // AI analysis (cloud-side): read the new resume with Gemini and extract
      // skills/specializations. Runs only when a new resume was uploaded.
      let mergedSkills = skills
      let mergedSpecializations = specializations
      let finalAiSkills = aiSkills
      let finalAiSpecializations = aiSpecializations
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
          if (result.status === 'name_mismatch') {
            // Resume names someone else — refuse it and require the student's own.
            setAiSkills([])
            setAiSpecializations([])
            setResumeRejected({
              fileName: resume.name,
              message: result.message || NAME_MISMATCH_MESSAGE,
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
          finalAiSkills = result.skills
          finalAiSpecializations = result.specializations
          
          const oldManualSkills = skills.filter(s => !aiSkills.some(oldAi => oldAi.toLowerCase() === s.toLowerCase()))
          mergedSkills = [...result.skills, ...oldManualSkills.filter(s => !result.skills.some(rs => rs.toLowerCase() === s.toLowerCase()))]
          
          const oldManualSpecializations = specializations.filter(s => !aiSpecializations.some(oldAi => oldAi.toLowerCase() === s.toLowerCase()))
          mergedSpecializations = [...result.specializations, ...oldManualSpecializations.filter(s => !result.specializations.some(rs => rs.toLowerCase() === s.toLowerCase()))]
          setAiSkills(finalAiSkills)
          setAiSpecializations(finalAiSpecializations)
          setSkills(mergedSkills)
          setSpecializations(mergedSpecializations)
          setResumeRejected(null)
        } catch {
          // AI is an accelerator, not a gate — a Gemini outage shouldn't block
          // saving, as long as the student entered skills manually.
          if (skills.length === 0 || specializations.length === 0) {
            setError(
              isEdit
                ? 'We could not analyze your resume right now. Please add your skills and specializations manually, then save again.'
                : 'We could not analyze your resume right now. Please try saving again in a moment.',
            )
            return
          }
        } finally {
          setAnalyzing(false)
        }
      }

      if (mergedSkills.length === 0 || mergedSpecializations.length === 0) {
        setError(
          isEdit
            ? 'Your resume did not include enough to fill your skills and specializations. Please add them manually.'
            : 'Your resume did not include enough to fill your skills and specializations. Please upload a more detailed resume.',
        )
        savingRef.current = false
        return
      }

      const portfolioFilePath = hasLink
        ? null
        : portfolioFileRemoved
          ? null
          : portfolioFile
            ? await uploadDocument(userId, 'portfolio', portfolioFile)
            : (profile?.portfolio_file_url ?? null)

      await completeProfile(userId, {
        skills: mergedSkills,
        specializations: mergedSpecializations,
        aiSkills: finalAiSkills,
        aiSpecializations: finalAiSpecializations,
        photoUrl,
        resumePath,
        coverLetterPath,
        portfolioLink: hasLink ? portfolioLink.trim() : null,
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
        if (coverLetterPath !== prevCoverLetterPath) await removeDocument(userId, prevCoverLetterPath)
        if (portfolioFilePath !== prevPortfolioPath) await removeDocument(userId, prevPortfolioPath)
        if (photoUrl !== prevPhotoUrl) await removeAvatar(userId, prevPhotoUrl)
      } catch {
        /* cleanup failure must not fail the save */
      }

      onDone?.() // Redirect to the dashboard after saving.
    } catch (err) {
      setError(errorMessage(err))
      savingRef.current = false // Changes are still unsaved — re-arm the guard.
    } finally {
      setBusy(false)
    }
  }

  const formCard = (
    <>
      <ConfirmDialog
        cancelLabel="Keep editing"
        confirmLabel="Leave without saving"
        danger
        message="Your edits — including any skills the resume analysis found — will be lost unless you save first."
        onCancel={() => setPendingLeave(null)}
        onConfirm={() => {
          const leave = pendingLeave
          setPendingLeave(null)
          leave?.()
        }}
        open={pendingLeave !== null}
        title="Unsaved changes"
      />
      {showPhotoModal && photoPreview && (
        <PhotoLightbox
          alt="Profile photo"
          onClose={() => setShowPhotoModal(false)}
          src={photoPreview}
        />
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
                position: 'absolute', bottom: '0px', right: '-4px', background: 'var(--brand-orange)', 
                color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', 
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              title="Edit photo"
            >
              <Pencil size={12} />
              {/* Matches the avatars bucket allowlist (20260720000000_storage_bucket_limits) —
                  image/* would let the picker offer SVG/HEIC, which the bucket rejects. */}
              <input
                accept="image/png,image/jpeg,image/webp,image/gif"
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

      {/* Basic details */}
      <section className="profile-section">
        <div className="profile-section-head">
          <h2>Name</h2>
          <span className="profile-optional">Locked · from your account</span>
        </div>
        <div className="profile-name-grid">
          <label>
            First Name
            <input disabled value={first} />
          </label>
          <label>
            M.I.
            <input disabled value={mi} />
          </label>
          <label>
            Last Name
            <input disabled value={last} />
          </label>
          <label>
            Suffix
            <input disabled value={suffix} />
          </label>
        </div>
      </section>

      {/* University */}
      <section className="profile-section">
        <div className="profile-section-head">
          <h2>University</h2>
          <span className="profile-optional">Locked</span>
        </div>
        <div className="profile-name-grid">
          <label className="profile-field-span">
            University
            <input
              disabled
              value={profile?.university ?? 'Cebu Institute of Technology – University'}
            />
          </label>
          <label className="profile-field-span">
            Course / Programme
            <input disabled value={profile?.course ?? '—'} />
          </label>
          <label className="profile-field-span">
            Year Level
            <input disabled value={profile?.year_level ?? '—'} />
          </label>
        </div>
      </section>

      {/* Personal Information */}
      <section className="profile-section">
        <div className="profile-section-head">
          <h2>Personal Information</h2>
          <span className="profile-required">Required</span>
        </div>
        <div className="profile-personal-grid">
          <label>
            Age
            <input
              inputMode="numeric"
              onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 21"
              value={age}
            />
          </label>
          <label>
            Sex
            <div className="profile-sex-toggle">
              {['Male', 'Female', 'Prefer not to say'].map((option) => (
                <button
                  type="button"
                  key={option}
                  className={`profile-sex-btn ${sex === option ? 'active' : ''}`}
                  onClick={() => setSex(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </label>
          <label className="profile-field-span">
            <span>Address <span style={{ color: 'var(--brand-crimson)' }}>*</span></span>
            <input
              onChange={(e) => setAddress(e.target.value)}
              placeholder="City, Province"
              required
              value={address}
            />
          </label>
          <label>
            Personal Email Address
            <input
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="Not your @cit.edu email"
              type="email"
              value={personalEmail}
            />
          </label>
          <label>
            <span>Contact Number <span style={{ color: 'var(--brand-crimson)' }}>*</span></span>
            <input
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="09..."
              required
              type="tel"
              value={contactNumber}
            />
          </label>
        </div>
      </section>

      {/* Skills and specializations are only editable from the workspace
          profile. First-time setup takes them from the resume alone, so the
          student isn't asked to type what the AI is about to extract. */}
      {isEdit && (
        <>
          {/* Skills — optional */}
          <section className="profile-section">
            <div className="profile-section-head">
              <h2>Skills</h2>
            </div>
            <TagInput
              onChange={setSkills}
              placeholder="Type a skill and press Enter (e.g. React, SQL, Figma)"
              tags={skills}
              lockedTags={aiSkills}
              suggestions={SKILL_SUGGESTIONS}
            />
            <p className="profile-info-subtext" style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
              Faded tags represent skills automatically extracted from your resume and cannot be removed. You can still manually add additional skills and remove them.
            </p>
          </section>

          {/* Specializations — optional */}
          <section className="profile-section">
            <div className="profile-section-head">
              <h2>Specializations</h2>
            </div>
            <TagInput
              onChange={setSpecializations}
              placeholder="e.g. Marketing, Frontend, Backend, Software Dev"
              tags={specializations}
              lockedTags={aiSpecializations}
              suggestions={SPECIALIZATION_SUGGESTIONS}
            />
            <p className="profile-info-subtext" style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
              Faded tags represent specializations automatically extracted from your resume and cannot be removed. You can still manually add additional specializations and remove them.
            </p>
          </section>
        </>
      )}

      {/* Resume & Cover Letter — upload */}
      <section className="profile-section">
        <div className="profile-section-head">
          <h2>Resume & Cover Letter</h2>
        </div>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Resume <span className="profile-optional" style={{ fontWeight: 400 }}>PDF</span></h4>
          {!isEdit && (
            <p className="profile-subtext" style={{ marginBottom: '8px' }}>
              Your skills and specializations are read from this resume, so upload
              it here — there's nothing to type in.
            </p>
          )}
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
                      accept=".pdf"
                      hidden
                      onChange={(e) => {
                        handlePickResume(e.target.files?.[0] ?? null)
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
                  accept=".pdf"
                  hidden
                  onChange={(e) => {
                    handlePickResume(e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
                  type="file"
                />
                {resumeRejected ? 'Upload a new PDF resume' : 'Upload PDF resume'}
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
          <p className="profile-info" style={{ marginTop: '8px' }}>
            Your resume is read by AI to auto-fill your
            skills and specializations for matching.
          </p>
        </div>

        <div>
          <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Cover Letter <span className="profile-optional" style={{ fontWeight: 400 }}>Optional · PDF only</span></h4>
          {coverLetter || profile?.cover_letter_url ? (
            <div className="profile-upload block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'default' }}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
              <button
                type="button"
                onClick={() => {
                  if (coverLetter) {
                    window.open(URL.createObjectURL(coverLetter), '_blank')
                  } else {
                    handleViewDocument(profile?.cover_letter_url)
                  }
                }}
                style={{ background: 'none', border: 'none', color: 'var(--brand-orange)', textDecoration: 'underline', padding: 0, cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
              >
                {displayCoverLetterName}
              </button>
              {coverLetter && (
                <span style={{ fontSize: '12px', color: 'var(--brand-orange)', fontWeight: 500 }}>
                  New file selected: {coverLetter.name} — save to apply
                </span>
              )}
              </span>
              <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ cursor: 'pointer', background: 'var(--surface)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-strong)' }}>
                  Change
                  <input
                    accept=".pdf"
                    hidden
                    onChange={(e) => {
                      setCoverLetter(e.target.files?.[0] ?? null)
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
                accept=".pdf"
                hidden
                onChange={(e) => {
                  setCoverLetter(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
                type="file"
              />
              Upload cover letter
            </label>
          )}
        </div>
      </section>

      {/* Portfolio — link OR file */}
      <section className="profile-section">
        <div className="profile-section-head">
          <h2>Portfolio</h2>
          <span className="profile-optional">Link or file (PDF only)</span>
        </div>
        <label className="profile-field-label">
          Portfolio link
          <input
            disabled={hasFile}
            onChange={(e) => {
              setPortfolioLink(e.target.value)
              if (e.target.value.trim()) setError('')
            }}
            placeholder="https://your-portfolio.com"
            type="url"
            value={portfolioLink}
          />
        </label>
        <div className="profile-or">or</div>
        <div>
          {hasFile ? (
            <div
              className={`profile-upload block${hasLink ? ' disabled' : ''}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'default',
                opacity: hasLink ? 0.5 : 1,
                pointerEvents: hasLink ? 'none' : 'auto',
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                <button
                  type="button"
                  disabled={hasLink}
                  onClick={() => {
                    if (portfolioFile) {
                      window.open(URL.createObjectURL(portfolioFile), '_blank')
                    } else if (profile?.portfolio_file_url) {
                      handleViewDocument(profile.portfolio_file_url)
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--brand-orange)',
                    textDecoration: 'underline',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  {portfolioFile ? portfolioFile.name : profile?.portfolio_file_url?.split('/').pop()}
                </button>
                {portfolioFile && (
                  <span style={{ fontSize: '12px', color: 'var(--brand-orange)', fontWeight: 500 }}>
                    New file selected: {portfolioFile.name} — save to apply
                  </span>
                )}
              </span>
              <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label
                  style={{
                    cursor: hasLink ? 'not-allowed' : 'pointer',
                    background: 'var(--surface)',
                    height: '34px',
                    padding: '0 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-strong)',
                    opacity: hasLink ? 0.5 : 1,
                  }}
                >
                  Change
                  <input
                    accept=".pdf,application/pdf"
                    disabled={hasLink}
                    hidden
                    onChange={(e) => handlePickPortfolio(e.target.files?.[0] ?? null)}
                    type="file"
                  />
                </label>
                <button
                  disabled={hasLink}
                  onClick={() => {
                    setPortfolioFile(null)
                    setPortfolioFileRemoved(true)
                  }}
                  style={{
                    cursor: hasLink ? 'not-allowed' : 'pointer',
                    background: '#fdece9',
                    border: '1px solid #f4c7bf',
                    borderRadius: '8px',
                    color: 'var(--brand-crimson)',
                    width: '34px',
                    height: '34px',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: hasLink ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                  title="Remove portfolio file"
                  type="button"
                >
                  <Trash2 size={15} />
                </button>
              </span>
            </div>
          ) : (
            <label
              className={`profile-upload block${hasLink ? ' disabled' : ''}`}
              style={{
                opacity: hasLink ? 0.5 : 1,
                cursor: hasLink ? 'not-allowed' : 'pointer',
                pointerEvents: hasLink ? 'none' : 'auto',
              }}
            >
              <input
                accept=".pdf,application/pdf"
                disabled={hasLink}
                hidden
                onChange={(e) => handlePickPortfolio(e.target.files?.[0] ?? null)}
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

      {/* Edit mode only: on a phone the sign-out moves off the bottom tab bar
          and lands here, under Save changes. Setup mode keeps its own sign-out
          in the page header, so adding it here would double it up. Hidden above
          the mobile breakpoint — the sidebar still owns sign-out on desktop.
          SignOutButton sets type="button", so it never submits the form. */}
      {isEdit && (
        <SignOutButton className="profile-mobile-signout">Sign out</SignOutButton>
      )}
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
