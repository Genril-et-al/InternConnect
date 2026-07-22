import { useCallback, useEffect, useState } from 'react'
import { CompanyDashboard } from './CompanyDashboard'
import { CompanyListings } from './CompanyListings'
import { CompanyApplicants } from './CompanyApplicants'
import { CompanyProfileView } from './CompanyProfileView'
import type { CompanyApplicant, CompanyListing } from './companyData'
import {
  createListing,
  deleteListing,
  fetchApplicants,
  fetchCompanyListings,
  fetchMyCompany,
  reviewSubmission,
  setListingStatus,
  updateApplicationStatus,
  scheduleInterview,
} from './companyQueries'
import type { InterviewDetails, NewListingInput } from './companyQueries'
import type { ApplicantStatus } from './companyData'
import './company.css'

/**
 * Company portal views, rendered inside the shared workspace shell.
 * Listings + applicants load live from Supabase; actions write through
 * companyQueries and refresh so dashboard counts stay in sync.
 */
export function CompanyPortal({
  activeView,
  onNavigate,
}: {
  activeView: string
  onNavigate: (view: string) => void
}) {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [verification, setVerification] = useState<'pending' | 'verified' | 'rejected'>('pending')
  const [listings, setListings] = useState<CompanyListing[]>([])
  const [applicants, setApplicants] = useState<CompanyApplicant[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  
  const [highlightedListingId, setHighlightedListingId] = useState<string | null>(null)
  const [highlightedApplicantId, setHighlightedApplicantId] = useState<string | null>(null)

  const refresh = useCallback(async (id: string) => {
    const [l, a] = await Promise.all([fetchCompanyListings(id), fetchApplicants(id)])
    setListings(l)
    setApplicants(a)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const company = await fetchMyCompany()
        if (!company) throw new Error('No company account found for this user.')
        if (cancelled) return
        setCompanyId(company.id)
        setVerification(company.verification)
        await refresh(company.id)
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load company data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const withRefresh = useCallback(
    async (action: () => Promise<void>) => {
      await action()
      if (companyId) await refresh(companyId)
    },
    [companyId, refresh],
  )

  const handleCreate = useCallback(
    (input: NewListingInput) => {
      if (!companyId) return Promise.reject(new Error('Company not loaded yet.'))
      return withRefresh(() => createListing(companyId, input))
    },
    [companyId, withRefresh],
  )
  const handleSetStatus = useCallback(
    (id: string, status: CompanyListing['status']) => withRefresh(() => setListingStatus(id, status)),
    [withRefresh],
  )
  const handleDelete = useCallback(
    (id: string) => withRefresh(() => deleteListing(id)),
    [withRefresh],
  )
  const handleApplicantStatus = useCallback(
    (id: string, status: ApplicantStatus, feedback?: string) =>
      withRefresh(() => updateApplicationStatus(id, status, feedback)),
    [withRefresh],
  )
  const handleScheduleInterview = useCallback(
    (id: string, details: InterviewDetails) =>
      withRefresh(() => scheduleInterview(id, details)),
    [withRefresh],
  )
  const handleReviewSubmission = useCallback(
    (submissionId: string, applicationId: string, approve: boolean, feedback?: string) =>
      withRefresh(() => reviewSubmission(submissionId, applicationId, approve, feedback)),
    [withRefresh],
  )

  if (loading) {
    return <div className="cp-root"><div className="cp-card cp-empty">Loading company workspace…</div></div>
  }
  if (loadError) {
    return <div className="cp-root"><div className="cp-card cp-empty">{loadError}</div></div>
  }

  // Picked into a variable rather than returned directly so every view shares
  // the one keyed .page-enter wrapper below. Keying the wrapper instead of
  // this component matters: CompanyPortal owns the fetched listings and
  // applicants, and remounting it on each nav would refetch them.
  function body() {
    if (activeView === 'Listings') {
      return (
        <CompanyListings
          applicants={applicants}
          listings={listings}
          verification={verification}
          onCreate={handleCreate}
          onSetStatus={handleSetStatus}
          onDelete={handleDelete}
          highlightedListingId={highlightedListingId}
        />
      )
    }
    if (activeView === 'Applicants') {
      return (
        <CompanyApplicants
          applicants={applicants}
          listings={listings}
          onSetStatus={handleApplicantStatus}
          onScheduleInterview={handleScheduleInterview}
          onReviewSubmission={handleReviewSubmission}
          highlightedApplicantId={highlightedApplicantId}
        />
      )
    }
    if (activeView === 'Profile') {
      return <CompanyProfileView />
    }

    return (
      <CompanyDashboard
        applicants={applicants}
        listings={listings}
        onNavigate={onNavigate}
        onHighlightListing={(id) => { setHighlightedListingId(id); if (id) setTimeout(() => setHighlightedListingId(null), 3000); }}
        onHighlightApplicant={(id) => { setHighlightedApplicantId(id); if (id) setTimeout(() => setHighlightedApplicantId(null), 3000); }}
      />
    )
  }

  return (
    <div className="page-enter" key={activeView}>
      {body()}
    </div>
  )
}
