import { supabase } from './supabase'

/**
 * Profile data layer (UC-S02 — student profile setup).
 * Handles file uploads to Supabase Storage and saving the profile record.
 */

export type ProfileSetupInput = {
  skills: string[]
  specializations: string[]
  photoUrl?: string | null
  resumePath?: string | null
  coverLetterPath?: string | null
  portfolioLink?: string | null
  portfolioFilePath?: string | null
  // Personal details — collected on the profile, not during sign-up.
  age?: number | null
  gender?: string | null
  address?: string | null
  personalEmail?: string | null
  contactNumber?: string | null
  aiSkills?: string[]
  aiSpecializations?: string[]
}

/**
 * Upload a profile photo to the public `avatars` bucket; returns a public URL.
 *
 * Same reasoning as uploadDocument: a fixed path produced an identical public
 * URL on every upload, so a replaced photo kept rendering from cache. Pass
 * `previousUrl` (the stored photo_url) so the old image is cleaned up.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = fileExt(file)
  const path = `${userId}/photo-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type, cacheControl: '0' })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Recover the storage key from a stored public avatar URL. Returns null for
 * anything outside the caller's own folder (or a non-Storage URL, e.g. a demo
 * data: preview), so cleanup can never delete another user's photo.
 */
function avatarPathFromPublicUrl(url: string, userId: string): string | null {
  const marker = '/avatars/'
  const index = url.indexOf(marker)
  if (index === -1) return null
  const path = decodeURIComponent(url.slice(index + marker.length).split('?')[0])
  return path.startsWith(`${userId}/`) ? path : null
}

/**
 * Upload a resume/portfolio file to the private `documents` bucket.
 * Returns the storage path (use signedDocumentUrl to view it later).
 *
 * The path is unique per upload. A fixed path (`{uid}/resume.pdf`) meant that
 * replacing a file wrote to the same key, so `resume_url` never changed and
 * Storage kept serving the previous version from cache — the student saw their
 * old resume after uploading a new one. Pass `previousPath` so the file being
 * replaced is cleaned up instead of being orphaned.
 */
export async function uploadDocument(
  userId: string,
  kind: 'resume' | 'portfolio' | 'cover_letter',
  file: File,
): Promise<string> {
  const ext = fileExt(file)
  const path = `${userId}/${kind}-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('documents')
    .upload(path, file, { contentType: file.type, cacheControl: '0' })
  if (error) throw error
  return path
}

/**
 * Delete a document the profile no longer references. Call this only AFTER the
 * profile row points at the replacement — the save path can bail out between
 * upload and commit (a rejected resume, for example), and deleting earlier
 * would strand resume_url on a file that no longer exists.
 */
export async function removeDocument(userId: string, path?: string | null): Promise<void> {
  if (!path || !path.startsWith(`${userId}/`)) return
  await supabase.storage.from('documents').remove([path])
}

/** Same ordering rule as removeDocument, for the public avatars bucket. */
export async function removeAvatar(userId: string, publicUrl?: string | null): Promise<void> {
  const path = publicUrl ? avatarPathFromPublicUrl(publicUrl, userId) : null
  if (!path) return
  await supabase.storage.from('avatars').remove([path])
}

/**
 * Clear the previous AI verdict when a new resume replaces the old one, so a
 * stale "no skills found" rejection doesn't stick to the new file. The
 * analyze-resume function overwrites these with the real result.
 */
export async function markResumeReplaced(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      resume_status: 'pending_analysis',
      resume_analyzed_at: null,
      resume_ai_suggestion: null,
    })
    .eq('id', userId)
  if (error) throw error
}

/**
 * Create a temporary signed URL for a private document.
 *
 * Passing `downloadName` sets Content-Disposition: attachment, so the browser
 * saves the file instead of rendering it. Omit it to preview inline -- callers
 * that want both (see CompanyApplicants) mint one URL each way.
 */
export async function signedDocumentUrl(path: string, downloadName?: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, expiresInSec, downloadName ? { download: downloadName } : undefined)
  if (error) throw error
  return data.signedUrl
}

/** Save the profile fields and mark setup complete. */
export async function completeProfile(userId: string, input: ProfileSetupInput) {
  const { error } = await supabase
    .from('profiles')
    .update({
      skills: input.skills,
      specializations: input.specializations,
      ai_skills: input.aiSkills ?? [],
      ai_specializations: input.aiSpecializations ?? [],
      photo_url: input.photoUrl ?? null,
      resume_url: input.resumePath ?? null,
      cover_letter_url: input.coverLetterPath ?? null,
      portfolio_link: input.portfolioLink ?? null,
      portfolio_file_url: input.portfolioFilePath ?? null,
      age: input.age ?? null,
      gender: input.gender ?? null,
      address: input.address ?? null,
      personal_email: input.personalEmail ?? null,
      contact_number: input.contactNumber ?? null,
      profile_completed: true,
    })
    .eq('id', userId)
  if (error) throw error
}

function fileExt(file: File): string {
  const parts = file.name.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : 'bin'
}
