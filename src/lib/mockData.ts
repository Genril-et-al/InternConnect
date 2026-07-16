/**
 * Shared prototype seed data. Replaced by Supabase tables (listings,
 * applications) in a later slice — keep UI components reading from here so the
 * swap is one file.
 */

export type ApplicationStatus =
  | 'Pending'
  | 'Under review'
  | 'Shortlisted'
  | 'Interview scheduled'
  | 'Accepted'
  | 'Rejected'

export type Internship = {
  id: number
  title: string
  company: string
  industry: string
  location: string
  setup: 'Onsite' | 'Remote' | 'Hybrid'
  deadline: string
  duration: string
  slots: number
  match: number
  status: 'Open' | 'Closing soon' | 'Closed'
  skills: string[]
  summary: string
}

export type PreEmploymentRequirement = {
  id: string
  name: string
  type: 'file' | 'text'
  isPrintable: boolean
}

export type Application = {
  id: number
  company: string
  role: string
  dateApplied: string
  status: ApplicationStatus
  nextStep: string
  requirements?: PreEmploymentRequirement[]
}

export const internships: Internship[] = [
  {
    id: 1,
    title: 'Frontend Developer Intern',
    company: 'Arcway Labs',
    industry: 'Software',
    location: 'Cebu City',
    setup: 'Hybrid',
    deadline: 'Jul 29, 2026',
    duration: '480 hours',
    slots: 4,
    match: 94,
    status: 'Open',
    skills: ['React', 'TypeScript', 'UI QA'],
    summary: 'Build internal dashboards with a product team and ship small features weekly.',
  },
  {
    id: 2,
    title: 'Data Operations Intern',
    company: 'Harbor Analytics',
    industry: 'Business Intelligence',
    location: 'Mandaue',
    setup: 'Onsite',
    deadline: 'Jul 22, 2026',
    duration: '360 hours',
    slots: 3,
    match: 87,
    status: 'Closing soon',
    skills: ['SQL', 'Excel', 'Reporting'],
    summary: 'Clean operational datasets and prepare weekly placement reports.',
  },
  {
    id: 3,
    title: 'QA Automation Intern',
    company: 'Northstar Systems',
    industry: 'Software',
    location: 'Remote',
    setup: 'Remote',
    deadline: 'Aug 8, 2026',
    duration: '480 hours',
    slots: 2,
    match: 81,
    status: 'Open',
    skills: ['Testing', 'Playwright', 'Documentation'],
    summary: 'Write browser checks and document regression coverage for releases.',
  },
  {
    id: 4,
    title: 'UI/UX Design Intern',
    company: 'Cebu Design Studio',
    industry: 'Creative Services',
    location: 'Cebu City',
    setup: 'Onsite',
    deadline: 'Aug 1, 2026',
    duration: '480 hours',
    slots: 2,
    match: 72,
    status: 'Open',
    skills: ['Figma', 'Prototyping', 'User Research'],
    summary: 'Create wireframes and high-fidelity mockups for client web and mobile projects.',
  },
  {
    id: 5,
    title: 'Backend Engineer Intern',
    company: 'Cebu Fintech Group',
    industry: 'Financial Technology',
    location: 'Cebu City',
    setup: 'Hybrid',
    deadline: 'Jul 31, 2026',
    duration: '480 hours',
    slots: 3,
    match: 65,
    status: 'Open',
    skills: ['Node.js', 'PostgreSQL', 'REST APIs'],
    summary: 'Develop API endpoints and integrate third-party payment services.',
  },
  {
    id: 6,
    title: 'Digital Marketing Intern',
    company: 'Harbor Analytics',
    industry: 'Business Intelligence',
    location: 'Mandaue',
    setup: 'Remote',
    deadline: 'Aug 15, 2026',
    duration: '240 hours',
    slots: 5,
    match: 58,
    status: 'Open',
    skills: ['SEO', 'Google Analytics', 'Content Writing'],
    summary: 'Run campaign analytics, draft blog content, and optimize landing pages.',
  },
]

export const applications: Application[] = [
  {
    id: 1,
    company: 'Arcway Labs',
    role: 'Frontend Developer Intern',
    dateApplied: 'Jul 10',
    status: 'Accepted',
    nextStep: 'Please submit your pre-employment requirements.',
    requirements: [
      { id: '1', name: 'Medical Certificate', type: 'text', isPrintable: true },
      { id: '2', name: 'Company Non-Disclosure Agreement', type: 'file', isPrintable: false }
    ]
  },
  {
    id: 2,
    company: 'Cebu Fintech Group',
    role: 'Product Support Intern',
    dateApplied: 'Jul 7',
    status: 'Interview scheduled',
    nextStep: 'Interview on Jul 18, 10:00 AM.',
  },
  {
    id: 3,
    company: 'Harbor Analytics',
    role: 'Data Operations Intern',
    dateApplied: 'Jul 2',
    status: 'Pending',
    nextStep: 'Waiting for first company action.',
  },
]
