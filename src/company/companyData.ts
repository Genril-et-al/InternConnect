/**
 * Company portal seed data — replaced by Supabase tables (listings,
 * applications, storage files) in a later slice.
 */

export type PreEmploymentRequirement = {
  id: string
  name: string
  type: 'file' | 'text'
  isPrintable: boolean
}

export type CompanyListing = {
  id: number
  title: string
  status: 'Open' | 'Draft' | 'Closed'
  slots: number
  deadline: string
  department: string
  skills: string[]
  description: string
  requirements?: PreEmploymentRequirement[]
}

export type ApplicantStatus = 'Pending' | 'Reviewed' | 'Accepted' | 'Rejected'

/** A file the company sends to an accepted applicant (UC-C05 extension). */
export type RequirementFile = {
  name: string
  size: string
  note?: string
}

export type SubmittedRequirement = {
  id: string
  name: string
  status: 'Pending' | 'Approved' | 'Rejected' | 'Needs Revision'
  fileUrl?: string
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
  submittedRequirements?: SubmittedRequirement[]
}

export const SEED_COMPANY_LISTINGS: CompanyListing[] = [
  { 
    id: 1, 
    title: 'Frontend Developer Intern', 
    status: 'Open', 
    slots: 4, 
    deadline: 'Jul 29',
    department: 'Engineering',
    skills: ['React', 'TypeScript', 'Figma', 'HTML/CSS'],
    description: 'Build beautiful web interfaces using React and Figma.'
  },
  { 
    id: 2, 
    title: 'Technical Writer Intern', 
    status: 'Draft', 
    slots: 1, 
    deadline: 'Aug 5',
    department: 'Documentation',
    skills: ['Markdown', 'Git', 'Technical Writing'],
    description: 'Create and maintain API documentation and user guides for our core products.'
  },
  { 
    id: 3, 
    title: 'QA Automation Intern', 
    status: 'Open', 
    slots: 2, 
    deadline: 'Aug 8',
    department: 'Quality Assurance',
    skills: ['Playwright', 'Testing', 'JavaScript'],
    description: 'Write automated test scripts and ensure the quality of our weekly releases.'
  },
  { 
    id: 4, 
    title: 'Data Analyst Intern', 
    status: 'Open', 
    slots: 2, 
    deadline: 'Aug 5',
    department: 'Analytics',
    skills: ['Python', 'SQL', 'Excel', 'Tableau'],
    description: 'Analyze data and generate business insights.'
  },
  { 
    id: 5, 
    title: 'UI/UX Design Intern', 
    status: 'Open', 
    slots: 1, 
    deadline: 'Aug 15',
    department: 'Design',
    skills: ['Figma', 'Prototyping', 'User Research'],
    description: 'Help design the next generation of our mobile app.',
    requirements: [
      { id: 'req-portfolio', name: 'Final Portfolio PDF', type: 'file', isPrintable: false },
      { id: 'req-contract', name: 'Internship Contract', type: 'file', isPrintable: true }
    ]
  },
]

export const MATCH_FILTERS: Record<string, number> = {
  'Any match %': 0,
  '60% +': 60,
  '70% +': 70,
  '80% +': 80,
  '90% +': 90,
}
