import { useState } from 'react'
import { CompanyDashboard } from './CompanyDashboard'
import { CompanyListings } from './CompanyListings'
import { CompanyApplicants } from './CompanyApplicants'
import { CompanyProfileView } from './CompanyProfileView'
import { SEED_COMPANY_LISTINGS } from './companyData'
import type { CompanyApplicant, CompanyListing } from './companyData'
import './company.css'

/**
 * Company portal views, rendered inside the shared workspace shell.
 * Applicant/listing state lives here so dashboard counts stay in sync with
 * actions taken on the Applications view.
 */
export function CompanyPortal({
  activeView,
  onNavigate,
}: {
  activeView: string
  onNavigate: (view: string) => void
}) {
  const [listings, setListings] = useState<CompanyListing[]>(SEED_COMPANY_LISTINGS)
  const [applicants, setApplicants] = useState<CompanyApplicant[]>([])

  if (activeView === 'Listings') {
    return <CompanyListings applicants={applicants} listings={listings} setListings={setListings} />
  }
  if (activeView === 'Applicants') {
    return (
      <CompanyApplicants
        applicants={applicants}
        listings={listings}
        setApplicants={setApplicants}
      />
    )
  }
  if (activeView === 'Profile') {
    return <CompanyProfileView />
  }

  return (
    <CompanyDashboard applicants={applicants} listings={listings} onNavigate={onNavigate} />
  )
}
