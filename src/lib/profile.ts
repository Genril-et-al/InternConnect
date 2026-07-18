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
  portfolioLink?: string | null
  portfolioFilePath?: string | null
  // Personal details — collected on the profile, not during sign-up.
  age?: number | null
  gender?: string | null
  address?: string | null
  personalEmail?: string | null
  contactNumber?: string | null
}

/** Upload a profile photo to the public `avatars` bucket; returns a public URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = fileExt(file)
  const path = `${userId}/photo.${ext}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Upload a resume/portfolio file to the private `documents` bucket.
 * Returns the storage path (use signedDocumentUrl to view it later).
 */
export async function uploadDocument(
  userId: string,
  kind: 'resume' | 'portfolio',
  file: File,
): Promise<string> {
  const ext = fileExt(file)
  const path = `${userId}/${kind}.${ext}`
  const { error } = await supabase.storage
    .from('documents')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return path
}

/** Create a temporary signed URL to view a private document. */
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
      photo_url: input.photoUrl ?? null,
      resume_url: input.resumePath ?? null,
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
