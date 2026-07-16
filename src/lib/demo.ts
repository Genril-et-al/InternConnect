import type { Profile } from './supabase'

/**
 * Demo student used when Supabase is not connected, so the student profile can
 * be accessed offline. This never runs when real Supabase keys are present.
 */
export const DEMO_STUDENT: Profile = {
  id: 'demo-student-chielsea',
  role: 'student',
  email: 'chielsea.napoles@cit.edu',
  full_name: 'Chielsea S. Napoles',
  first_name: 'Chielsea',
  middle_initial: 'S',
  last_name: 'Napoles',
  suffix: null,
  age: null,
  gender: null,
  address: null,
  personal_email: null,
  contact_number: null,
  photo_url: null,
  skills: [],
  specializations: [],
  resume_url: null,
  portfolio_link: null,
  portfolio_file_url: null,
  profile_completed: false,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

/**
 * Demo NLO admin for temporary offline access to the admin portal.
 * In the real backend, admins are seeded manually (never self-registered).
 */
export const DEMO_ADMIN: Profile = {
  id: 'demo-admin-genril',
  role: 'admin',
  email: 'genriltheo@gmail.com',
  full_name: 'Genril Theo Sorono',
  first_name: 'Genril Theo',
  middle_initial: null,
  last_name: 'Sorono',
  suffix: null,
  age: null,
  gender: null,
  address: null,
  personal_email: null,
  contact_number: null,
  photo_url: null,
  skills: [],
  specializations: [],
  resume_url: null,
  portfolio_link: null,
  portfolio_file_url: null,
  profile_completed: true,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}
