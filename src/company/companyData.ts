/**
 * Company portal seed data — replaced by Supabase tables (listings,
 * applications, storage files) in a later slice.
 */

export type CompanyListing = {
  id: number
  title: string
  status: 'Open' | 'Draft' | 'Closed'
  slots: number
  deadline: string
}

export type ApplicantStatus = 'Pending' | 'Reviewed' | 'Accepted' | 'Rejected'

/** A file the company sends to an accepted applicant (UC-C05 extension). */
export type RequirementFile = {
  name: string
  size: string
  note?: string
}

export type CompanyApplicant = {
  id: number
  name: string
  email: string
  listingId: number
  role: string
  match: number
  status: ApplicantStatus
  applied: string
  skills: string[]
  specializations: string[]
  resume: string
  portfolioLink?: string
  portfolioFile?: string
  coverLetter: string
  /** Feedback sent to the applicant when rejected. */
  feedback?: string
  /** Additional requirement files sent when accepted (student can download). */
  requirements?: RequirementFile[]
}

export const SEED_COMPANY_LISTINGS: CompanyListing[] = [
  { id: 1, title: 'Frontend Developer Intern', status: 'Open', slots: 4, deadline: 'Jul 29' },
  { id: 2, title: 'Technical Writer Intern', status: 'Draft', slots: 1, deadline: 'Aug 5' },
  { id: 3, title: 'QA Automation Intern', status: 'Open', slots: 2, deadline: 'Aug 8' },
]

export const SEED_COMPANY_APPLICANTS: CompanyApplicant[] = [
  {
    id: 1,
    name: 'Maria Faith Antigua',
    email: 'maria.antigua@cit.edu',
    listingId: 1,
    role: 'Frontend Developer Intern',
    match: 92,
    status: 'Pending',
    applied: 'Jul 10',
    skills: ['React', 'TypeScript', 'UI Testing', 'CSS'],
    specializations: ['Frontend', 'Web Development'],
    resume: 'Maria_Antigua_Resume.pdf',
    portfolioLink: 'https://mariaantigua.dev',
    portfolioFile: 'Maria_Antigua_Portfolio.pdf',
    coverLetter:
      'I have built three production React apps during my coursework and would love to bring that experience to Arcway Labs.',
  },
  {
    id: 2,
    name: 'Chielsea S. Napoles',
    email: 'chielsea.napoles@cit.edu',
    listingId: 1,
    role: 'Frontend Developer Intern',
    match: 88,
    status: 'Pending',
    applied: 'Jul 11',
    skills: ['React', 'SQL', 'Figma'],
    specializations: ['Frontend', 'UI Design'],
    resume: 'Chielsea_Napoles_Resume.pdf',
    portfolioLink: 'https://behance.net/chielseanapoles',
    coverLetter:
      'My design-to-code workflow in Figma and React fits the role, and I am eager to learn from your product team.',
  },
  {
    id: 3,
    name: 'Carlo Reyes',
    email: 'carlo.reyes@cit.edu',
    listingId: 3,
    role: 'QA Automation Intern',
    match: 84,
    status: 'Reviewed',
    applied: 'Jul 8',
    skills: ['Playwright', 'Testing', 'Documentation'],
    specializations: ['Quality Assurance', 'Automation'],
    resume: 'Carlo_Reyes_Resume.pdf',
    portfolioFile: 'Carlo_Reyes_Test_Portfolio.zip',
    coverLetter:
      'I wrote the regression suite for our capstone project and documented every flow — QA is where I want to grow.',
  },
  {
    id: 4,
    name: 'Anna Dela Cruz',
    email: 'anna.delacruz@cit.edu',
    listingId: 3,
    role: 'QA Automation Intern',
    match: 76,
    status: 'Pending',
    applied: 'Jul 12',
    skills: ['Manual Testing', 'Excel', 'Documentation'],
    specializations: ['Quality Assurance'],
    resume: 'Anna_DelaCruz_Resume.pdf',
    coverLetter:
      'Detail-oriented tester with strong documentation habits from our software engineering track.',
  },
  {
    id: 5,
    name: 'James Tan',
    email: 'james.tan@cit.edu',
    listingId: 1,
    role: 'Frontend Developer Intern',
    match: 65,
    status: 'Pending',
    applied: 'Jul 13',
    skills: ['HTML', 'CSS', 'JavaScript'],
    specializations: ['Web Development'],
    resume: 'James_Tan_Resume.pdf',
    portfolioLink: 'https://jamestan.carrd.co',
    coverLetter:
      'Self-taught front-ender looking for my first product team experience.',
  },
]

export const MATCH_FILTERS: Record<string, number> = {
  'Any match %': 0,
  '60% +': 60,
  '70% +': 70,
  '80% +': 80,
  '90% +': 90,
}
