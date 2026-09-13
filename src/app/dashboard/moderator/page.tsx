'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ConfirmActionModal } from '../../../components/admin/ConfirmActionModal'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { useTableStateFromUrl } from '../../../hooks/useTableStateFromUrl'
import { parseApiError } from '../../../utils/http'
import { TabsRoot, Tab } from '../../../components/ui'
import { 
  ShieldCheck, XCircle, CheckCircle, Eye, Loader2, ExternalLink, Clock, UserCheck, AlertTriangle, FileWarning, Scale, Inbox, Building2
} from 'lucide-react'
import { AdminAvatar } from '../../../components/admin/AdminAvatar'
import { useAdminRole } from '../../../hooks/useAdminRole'
import { AssigneeChip, useQueueAssignments } from '../../../hooks/useQueueAssignments'

type ModTab = 'kyc' | 'business' | 'abuse' | 'cases' | 'appeals'

export default function ModeratorPage() {
  const supabase = createClient()
  const { canWrite } = useAdminRole()
  const tableState = useTableStateFromUrl({ status: '' })
  const { status: statusFilter, sort, order, setStatus, setSort, setOrder } = tableState
  const [activeTab, setActiveTab] = useState<ModTab>('kyc')
  const [requests, setRequests] = useState<any[]>([])
  const [businessRequests, setBusinessRequests] = useState<any[]>([])
  const [businessLoading, setBusinessLoading] = useState(false)
  const [selectedBusinessRequest, setSelectedBusinessRequest] = useState<any>(null)
  const [selectedBusinessProfile, setSelectedBusinessProfile] = useState<any>(null)
  const [certImageError, setCertImageError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [selectedProfile, setSelectedProfile] = useState<any>(null)
  const [profilesById, setProfilesById] = useState<Record<string, any>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [idImageError, setIdImageError] = useState(false)
  const [faceImageError, setFaceImageError] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [pendingVerification, setPendingVerification] = useState<{
    requestId: string
    profileId: string
    status: 'verified' | 'rejected'
    displayName?: string
    kind?: 'identity' | 'business'
  } | null>(null)

  const [abuseReports, setAbuseReports] = useState<any[]>([])
  const [abuseLoading, setAbuseLoading] = useState(false)
  const [modCases, setModCases] = useState<any[]>([])
  const [casesLoading, setCasesLoading] = useState(false)
  const [appeals, setAppeals] = useState<any[]>([])
  const [appealsLoading, setAppealsLoading] = useState(false)
  const [selectedAppeal, setSelectedAppeal] = useState<any>(null)
  const [pendingAppealDecision, setPendingAppealDecision] = useState<'approve' | 'reject' | null>(null)
  const [appealNotes, setAppealNotes] = useState('')
  const [selectedKycIds, setSelectedKycIds] = useState<Set<string>>(new Set())
  const [selectedBizIds, setSelectedBizIds] = useState<Set<string>>(new Set())
  const [bulkKycBusy, setBulkKycBusy] = useState(false)
  const [bulkKycRejectOpen, setBulkKycRejectOpen] = useState(false)
  const [bulkBizRejectOpen, setBulkBizRejectOpen] = useState(false)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    // Profiles hydrated separately into profilesById (embed joins can blank the list under RLS).
    const { data, error } = await supabase
      .from('merchant_verifications')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('fetchRequests: merchant_verifications failed', error)
    setRequests(data ?? [])
    setLoading(false)
  }, [supabase])

  const fetchBusinessRequests = useCallback(async () => {
    setBusinessLoading(true)
    const { data, error } = await supabase
      .from('business_verifications')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('fetchBusinessRequests failed', error)
    setBusinessRequests(data ?? [])
    setBusinessLoading(false)
  }, [supabase])

  const filteredRequests = useMemo(() => {
    let list = requests
    if (statusFilter === 'pending') list = list.filter((r) => r.status === 'pending')
    else if (statusFilter === 'approved') list = list.filter((r) => r.status === 'approved')
    else if (statusFilter === 'rejected') list = list.filter((r) => r.status === 'rejected')
    list = [...list].sort((a, b) => {
      const aName = profilesById?.[a.user_id]?.display_name ?? a.user_id ?? ''
      const bName = profilesById?.[b.user_id]?.display_name ?? b.user_id ?? ''
      const aVal = sort === 'created_at' ? new Date(a.created_at).getTime() : String(aName).toLowerCase()
      const bVal = sort === 'created_at' ? new Date(b.created_at).getTime() : String(bName).toLowerCase()
      if (typeof aVal === 'number' && typeof bVal === 'number') return order === 'asc' ? aVal - bVal : bVal - aVal
      return order === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal))
    })
    return list
  }, [requests, statusFilter, sort, order, profilesById])

  const pendingKycIds = useMemo(
    () => filteredRequests.filter((r) => r.status === 'pending').map((r) => r.id as string),
    [filteredRequests],
  )
  const kycAssignments = useQueueAssignments('kyc_identity', pendingKycIds)

  const filteredBusinessRequests = useMemo(() => {
    let list = businessRequests
    if (statusFilter === 'pending') list = list.filter((r) => r.status === 'pending')
    else if (statusFilter === 'approved') list = list.filter((r) => r.status === 'approved')
    else if (statusFilter === 'rejected') list = list.filter((r) => r.status === 'rejected')
    list = [...list].sort((a, b) => {
      const aVal = new Date(a.created_at).getTime()
      const bVal = new Date(b.created_at).getTime()
      return order === 'asc' ? aVal - bVal : bVal - aVal
    })
    return list
  }, [businessRequests, statusFilter, order])

  const pendingBizIds = useMemo(
    () => filteredBusinessRequests.filter((r) => r.status === 'pending').map((r) => r.id as string),
    [filteredBusinessRequests],
  )
  const bizAssignments = useQueueAssignments('kyc_business', pendingBizIds)

  // When we select a request, pull the profile separately (so the list doesn't go blank if embeds are blocked).
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setSelectedProfile(null)
      if (!selectedRequest?.user_id) return

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, email, logo_url, slug')
        .eq('id', selectedRequest.user_id)
        .maybeSingle()

      if (!cancelled) {
        if (error) console.error('fetch profile failed', error)
        setSelectedProfile(data ?? null)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [selectedRequest?.user_id])

  // Reset image error flags when switching rows
  useEffect(() => {
    setIdImageError(false)
    setFaceImageError(false)
  }, [selectedRequest?.id])

  useEffect(() => {
    setCertImageError(false)
  }, [selectedBusinessRequest?.id])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setSelectedBusinessProfile(null)
      if (!selectedBusinessRequest?.user_id) return
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, email, logo_url, slug')
        .eq('id', selectedBusinessRequest.user_id)
        .maybeSingle()
      if (!cancelled) {
        if (error) console.error('fetch business profile failed', error)
        setSelectedBusinessProfile(data ?? null)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [selectedBusinessRequest?.user_id])

  // Cache profiles for the visible list (so slug/name render for each row).
  useEffect(() => {
    const loadProfiles = async () => {
      const userIds = Array.from(
        new Set(
          [...requests, ...businessRequests].map((r) => r?.user_id).filter(Boolean)
        )
      ) as string[]

      if (userIds.length === 0) return

      // Only fetch profiles we don't already have.
      const missing = userIds.filter((id) => !profilesById[id])
      if (missing.length === 0) return

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email, logo_url, slug')
        .in('id', missing)

      if (error) {
        console.error('loadProfiles failed', error)
        return
      }

      const next = { ...profilesById }
      ;(data ?? []).forEach((p) => {
        if (!p?.id) return
        next[p.id] = p
      })
      setProfilesById(next)
    }

    loadProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, businessRequests])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  useEffect(() => {
    if (activeTab === 'business') fetchBusinessRequests()
  }, [activeTab, fetchBusinessRequests])

  const fetchAbuseReports = useCallback(async () => {
    setAbuseLoading(true)
    const { data } = await supabase
      .from('abuse_reports')
      .select(`
        *,
        reporter:reporter_id (id, display_name, email, slug),
        subject:subject_user_id (id, display_name, email, slug)
      `)
      .order('created_at', { ascending: false })
      .limit(100)
    setAbuseReports(data ?? [])
    setAbuseLoading(false)
  }, [])

  const fetchModCases = useCallback(async () => {
    setCasesLoading(true)
    const { data } = await supabase
      .from('moderation_cases')
      .select(`
        *,
        subject:subject_user_id (id, display_name, email, slug)
      `)
      .order('created_at', { ascending: false })
      .limit(100)
    setModCases(data ?? [])
    setCasesLoading(false)
  }, [])

  const fetchAppeals = useCallback(async () => {
    setAppealsLoading(true)
    const { data } = await supabase
      .from('suspension_appeals')
      .select(`
        *,
        profile:user_id (id, display_name, email, slug, account_status)
      `)
      .order('created_at', { ascending: false })
      .limit(100)
    setAppeals(data ?? [])
    setAppealsLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'abuse') fetchAbuseReports()
  }, [activeTab, fetchAbuseReports])
  useEffect(() => {
    if (activeTab === 'cases') fetchModCases()
  }, [activeTab, fetchModCases])
  useEffect(() => {
    if (activeTab === 'appeals') fetchAppeals()
  }, [activeTab, fetchAppeals])

  const handleAppealDecision = (appeal: any, decision: 'approve' | 'reject') => {
    setSelectedAppeal(appeal)
    setPendingAppealDecision(decision)
    setAppealNotes('')
  }

  const submitAppealDecision = async (payload: { category: string; reason: string }) => {
    if (!selectedAppeal || !pendingAppealDecision) return
    setIsProcessing(true)
    setFeedback({ tone: 'info', message: 'Processing appeal...' })
    const res = await fetch('/api/admin/appeals/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appealId: selectedAppeal.id,
        userId: selectedAppeal.user_id,
        decision: pendingAppealDecision,
        adminNotes: pendingAppealDecision === 'reject' ? payload.reason : undefined,
      }),
    })
    if (!res.ok) {
      const err = await parseApiError(res, 'Failed to process appeal.')
      setFeedback({ tone: 'error', message: err })
      setIsProcessing(false)
      setPendingAppealDecision(null)
      setSelectedAppeal(null)
      return
    }
    setFeedback({ tone: 'success', message: `Appeal ${pendingAppealDecision === 'approve' ? 'approved' : 'rejected'}.` })
    setPendingAppealDecision(null)
    setSelectedAppeal(null)
    setIsProcessing(false)
    fetchAppeals()
  }

  const runBulkKyc = async (
    decision: 'verified' | 'rejected',
    reject?: { category: string; reason: string },
    kind: 'identity' | 'business' = 'identity',
  ) => {
    const source = kind === 'business' ? filteredBusinessRequests : filteredRequests
    const selected = kind === 'business' ? selectedBizIds : selectedKycIds
    const targets = source.filter((r) => selected.has(r.id) && r.status === 'pending')
    if (targets.length === 0) return
    setBulkKycBusy(true)
    const endpoint =
      kind === 'business'
        ? '/api/admin/moderation/business-verification'
        : '/api/admin/moderation/verification'
    const results = await Promise.allSettled(
      targets.map((req) =>
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: req.id,
            profileId: req.user_id,
            decision,
            ...(decision === 'rejected'
              ? { reasonCategory: reject?.category, reason: reject?.reason }
              : {}),
          }),
        }).then(async (res) => {
          if (!res.ok) throw new Error(await parseApiError(res, 'Failed'))
          return req.id
        }),
      ),
    )
    const ok = results.filter((r) => r.status === 'fulfilled').length
    setFeedback({
      tone: ok === results.length ? 'success' : 'error',
      message: `Bulk ${kind === 'business' ? 'business ' : ''}KYC ${decision}: ${ok}/${results.length} ok.`,
    })
    if (kind === 'business') setSelectedBizIds(new Set())
    else setSelectedKycIds(new Set())
    setBulkKycRejectOpen(false)
    setBulkBizRejectOpen(false)
    setBulkKycBusy(false)
    if (kind === 'business') fetchBusinessRequests()
    else fetchRequests()
  }

  const handleVerification = async (requestId: string, profileId: string, status: 'verified' | 'rejected') => {
    setPendingVerification({ requestId, profileId, status, displayName: selectedProfile?.display_name, kind: 'identity' })
  }

  const handleBusinessVerification = async (
    requestId: string,
    profileId: string,
    status: 'verified' | 'rejected'
  ) => {
    setPendingVerification({
      requestId,
      profileId,
      status,
      displayName: selectedBusinessProfile?.display_name,
      kind: 'business',
    })
  }

  const executeVerification = async () => {
    if (!pendingVerification) return
    const { requestId, profileId, status, kind } = pendingVerification
    if (status !== 'verified') return
    setIsProcessing(true)
    setFeedback({ tone: 'info', message: 'Processing moderation decision...' })

    const endpoint =
      kind === 'business'
        ? '/api/admin/moderation/business-verification'
        : '/api/admin/moderation/verification'

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        profileId,
        decision: status,
      }),
    })

    if (!response.ok) {
      const errorMessage = await parseApiError(response, 'Failed to process verification decision.')
      setFeedback({ tone: 'error', message: errorMessage })
      setIsProcessing(false)
      return
    }

    setSelectedRequest(null)
    setSelectedBusinessRequest(null)
    setPendingVerification(null)
    setFeedback({
      tone: 'success',
      message: kind === 'business' ? 'Business marked as verified.' : `Merchant marked as ${status}.`,
    })
    setIsProcessing(false)
    if (kind === 'business') fetchBusinessRequests()
    else fetchRequests()
  }

  const executeVerificationReject = async (payload: { category: string; reason: string }) => {
    if (!pendingVerification) return
    const { requestId, profileId, status, kind } = pendingVerification
    if (status !== 'rejected') return

    setIsProcessing(true)
    setFeedback({ tone: 'info', message: 'Processing moderation decision...' })

    const endpoint =
      kind === 'business'
        ? '/api/admin/moderation/business-verification'
        : '/api/admin/moderation/verification'

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        profileId,
        decision: status,
        reasonCategory: payload.category,
        reason: payload.reason,
      }),
    })

    if (!response.ok) {
      const errorMessage = await parseApiError(response, 'Failed to process verification decision.')
      setFeedback({ tone: 'error', message: errorMessage })
      setIsProcessing(false)
      return
    }

    setSelectedRequest(null)
    setSelectedBusinessRequest(null)
    setPendingVerification(null)
    setFeedback({
      tone: 'success',
      message: kind === 'business' ? 'Business verification rejected.' : 'Merchant marked as rejected.',
    })
    setIsProcessing(false)
    if (kind === 'business') fetchBusinessRequests()
    else fetchRequests()
  }

  // KYC list loading is scoped to that tab (do not block Business / Abuse / etc).

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <PageHeader
        title="Moderation Hub"
        subtitle="Review merchant verification requests and maintain platform safety."
        actions={
          <Link
            href="/dashboard/content-reports"
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100"
          >
            <Inbox className="h-4 w-4" />
            Unified report inbox
          </Link>
        }
      />
      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <TabsRoot>
        <Tab active={activeTab === 'kyc'} onClick={() => setActiveTab('kyc')}>KYC / Identity</Tab>
        <Tab active={activeTab === 'business'} onClick={() => setActiveTab('business')}>Business / CAC</Tab>
        <Tab active={activeTab === 'abuse'} onClick={() => setActiveTab('abuse')}>Abuse Reports</Tab>
        <Tab active={activeTab === 'cases'} onClick={() => setActiveTab('cases')}>Moderation Cases</Tab>
        <Tab active={activeTab === 'appeals'} onClick={() => setActiveTab('appeals')}>Suspension Appeals</Tab>
      </TabsRoot>

      <ConfirmActionModal
        open={pendingVerification?.status === 'verified'}
        title={pendingVerification?.kind === 'business' ? 'Verify this business?' : 'Verify this merchant?'}
        description={
          pendingVerification?.kind === 'business'
            ? `Approve CAC business verification for ${pendingVerification?.displayName ?? 'this seller'}. Their Verified badge will upgrade to a double check.`
            : `Approve verification for ${pendingVerification?.displayName ?? 'this merchant'}. They will gain verified status.`
        }
        impactSummary={
          pendingVerification?.kind === 'business'
            ? 'Seller keeps identity verified and gains the double-check Verified badge. Identity KYC is unchanged.'
            : 'Merchant will be marked verified and can use verified-only features.'
        }
        confirmLabel="Verify"
        submitting={isProcessing}
        onClose={() => setPendingVerification(null)}
        onConfirm={executeVerification}
      />
      <ActionReasonModal
        open={pendingVerification?.status === 'rejected'}
        title={pendingVerification?.kind === 'business' ? 'Reject this business?' : 'Reject this merchant?'}
        description={
          pendingVerification?.kind === 'business'
            ? `Reject business verification for ${pendingVerification?.displayName ?? 'this seller'}. A reason is required and will be shown in-app.`
            : `Reject verification for ${pendingVerification?.displayName ?? 'this merchant'}. A reason is required and will be shown in-app.`
        }
        impactSummary={
          pendingVerification?.kind === 'business'
            ? 'Application will be marked rejected. Seller can resubmit CAC documents later.'
            : 'Application will be marked rejected. Merchant can submit a new request later.'
        }
        categoryOptions={
          pendingVerification?.kind === 'business'
            ? [
                { value: 'certificate_quality', label: 'Certificate quality issue' },
                { value: 'rc_mismatch', label: 'RC / company name mismatch' },
                { value: 'fraud_risk', label: 'Fraud risk' },
                { value: 'other', label: 'Other' },
              ]
            : [
                { value: 'document_quality', label: 'Document quality issue' },
                { value: 'identity_mismatch', label: 'Identity mismatch' },
                { value: 'fraud_risk', label: 'Fraud risk' },
                { value: 'other', label: 'Other' },
              ]
        }
        submitting={isProcessing}
        onClose={() => setPendingVerification(null)}
        onSubmit={executeVerificationReject}
      />

      <ActionReasonModal
        open={bulkKycRejectOpen}
        title="Bulk reject KYC"
        description={`Reject ${selectedKycIds.size} selected pending identity verification(s).`}
        impactSummary="Each rejection is audited. Merchants can resubmit later."
        categoryOptions={[
          { value: 'document_quality', label: 'Document quality issue' },
          { value: 'identity_mismatch', label: 'Identity mismatch' },
          { value: 'fraud_risk', label: 'Fraud risk' },
          { value: 'other', label: 'Other' },
        ]}
        submitting={bulkKycBusy}
        onClose={() => setBulkKycRejectOpen(false)}
        onSubmit={async ({ category, reason }) => {
          await runBulkKyc('rejected', { category, reason })
        }}
      />

      <ActionReasonModal
        open={bulkBizRejectOpen}
        title="Bulk reject business KYC"
        description={`Reject ${selectedBizIds.size} selected pending business verification(s).`}
        impactSummary="Each rejection is audited. Sellers can resubmit CAC later."
        categoryOptions={[
          { value: 'certificate_quality', label: 'Certificate quality issue' },
          { value: 'rc_mismatch', label: 'RC / company name mismatch' },
          { value: 'fraud_risk', label: 'Fraud risk' },
          { value: 'other', label: 'Other' },
        ]}
        submitting={bulkKycBusy}
        onClose={() => setBulkBizRejectOpen(false)}
        onSubmit={async ({ category, reason }) => {
          await runBulkKyc('rejected', { category, reason }, 'business')
        }}
      />

      {activeTab === 'kyc' && (
      <>
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
      <>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-gray-600">
          Status
          <select value={statusFilter} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-800 outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-gray-600">
          Sort
          <select value={`${sort}:${order}`} onChange={(e) => { const [s, o] = e.target.value.split(':'); setSort(s); setOrder(o as 'asc' | 'desc'); }} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-800 outline-none focus:ring-2 focus:ring-blue-500">
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="display_name:asc">Name A–Z</option>
            <option value="display_name:desc">Name Z–A</option>
          </select>
        </label>
        {canWrite && selectedKycIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5">
            <span className="text-xs font-semibold text-blue-900">{selectedKycIds.size} selected</span>
            <button
              type="button"
              disabled={bulkKycBusy}
              onClick={() => void runBulkKyc('verified')}
              className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-[11px] text-emerald-800"
            >
              Bulk approve
            </button>
            <button
              type="button"
              disabled={bulkKycBusy}
              onClick={() => setBulkKycRejectOpen(true)}
              className="rounded border border-red-200 bg-white px-2 py-0.5 text-[11px] text-red-700"
            >
              Bulk reject…
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LIST SIDE (Left) */}
        <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <Clock size={16} className="text-orange-500" /> Verification requests
                    </h3>
                    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {requests.filter(r => r.status === 'pending').length} Action required
                    </span>
                </div>
                <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-gray-100">
                        {filteredRequests.map((req) => (
                            <tr 
                                key={req.id} 
                                onClick={() => setSelectedRequest(req)}
                                className={`cursor-pointer transition-colors ${selectedRequest?.id === req.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                            >
                                <td className="w-10 px-3 py-4" onClick={(e) => e.stopPropagation()}>
                                  {canWrite && req.status === 'pending' ? (
                                    <input
                                      type="checkbox"
                                      checked={selectedKycIds.has(req.id)}
                                      onChange={() => {
                                        setSelectedKycIds((prev) => {
                                          const next = new Set(prev)
                                          if (next.has(req.id)) next.delete(req.id)
                                          else next.add(req.id)
                                          return next
                                        })
                                      }}
                                      aria-label="Select KYC"
                                    />
                                  ) : null}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <AdminAvatar
                                          src={profilesById?.[req.user_id]?.logo_url}
                                          name={profilesById?.[req.user_id]?.display_name ?? req.user_id}
                                        />
                                        <div>
                                            <p className="font-semibold text-gray-900">
                                              {profilesById?.[req.user_id]?.display_name ?? req.user_id?.slice(0, 8) ?? 'Merchant'}
                                            </p>
                                            <p className="text-[10px] text-gray-500">
                                              @{profilesById?.[req.user_id]?.slug ?? 'merchant'}
                                            </p>
                                            {req.status === 'pending' && req.created_at ? (
                                              <p
                                                className={`text-[10px] font-medium ${
                                                  Date.now() - new Date(req.created_at).getTime() > 24 * 3_600_000
                                                    ? 'text-red-600'
                                                    : 'text-amber-600'
                                                }`}
                                              >
                                                {(() => {
                                                  const h = Math.floor(
                                                    (Date.now() - new Date(req.created_at).getTime()) / 3_600_000,
                                                  )
                                                  if (h < 1) return 'Waiting <1h'
                                                  if (h < 48) return `Waiting ${h}h${h >= 24 ? ' · SLA' : ''}`
                                                  return `Waiting ${Math.floor(h / 24)}d · SLA`
                                                })()}
                                              </p>
                                            ) : null}
                                            {canWrite && req.status === 'pending' ? (
                                              <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                                <AssigneeChip
                                                  assignment={kycAssignments.map[req.id]}
                                                  me={kycAssignments.me}
                                                  busy={kycAssignments.busyId === req.id}
                                                  onClaim={() => void kycAssignments.claim(req.id)}
                                                  onRelease={() => void kycAssignments.release(req.id)}
                                                />
                                              </div>
                                            ) : req.status === 'pending' && kycAssignments.map[req.id] ? (
                                              <p className="mt-1 text-[10px] text-gray-500">
                                                {kycAssignments.map[req.id].assignee_label || 'Assigned'}
                                              </p>
                                            ) : null}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                        req.status === 'approved' ? 'bg-green-100 text-green-700' : 
                                        req.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                        {req.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-400 text-[11px]">
                                    {new Date(req.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Eye size={16} className="text-gray-400 ml-auto" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredRequests.length === 0 && <div className="p-12 text-center text-gray-400">{requests.length === 0 ? 'No verification requests found.' : 'No requests match the current filter.'}</div>}
            </div>
        </div>

        {/* DETAILS SIDE (Right) */}
        <div className="lg:col-span-1">
            {selectedRequest ? (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm sticky top-6 overflow-hidden animate-in slide-in-from-right-4">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="font-bold text-gray-900">Review Application</h3>
                        <p className="text-xs text-gray-500 mt-1">Submitted on {new Date(selectedRequest.created_at).toLocaleString()}</p>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Document previews */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Identity document */}
                          <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center text-white relative group overflow-hidden">
                            {!idImageError && selectedRequest.id_url ? (
                              <img
                                src={selectedRequest.id_url}
                                crossOrigin="anonymous"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain"
                                alt="Identity Document"
                                onError={() => setIdImageError(true)}
                              />
                            ) : (
                              <div className="text-center px-4">
                                <ShieldCheck size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="text-[10px] opacity-50 uppercase tracking-widest font-bold">
                                  Identity Document
                                </p>
                              </div>
                            )}

                            {selectedRequest.id_url && (
                              <a
                                href={selectedRequest.id_url}
                                target="_blank"
                                rel="noreferrer"
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 font-bold text-xs"
                              >
                                <ExternalLink size={14} /> Full Preview
                              </a>
                            )}

                            {selectedRequest.id_url && (
                              <div className="absolute bottom-2 left-2 right-2">
                                <a
                                  href={selectedRequest.id_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block text-[10px] text-blue-200 bg-black/40 rounded px-2 py-1 overflow-hidden whitespace-nowrap text-ellipsis"
                                >
                                  Open ID URL
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Selfie / face match */}
                          <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center text-white relative group overflow-hidden">
                            {!faceImageError && selectedRequest.face_url ? (
                              <img
                                src={selectedRequest.face_url}
                                crossOrigin="anonymous"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain"
                                alt="Selfie / Face"
                                onError={() => setFaceImageError(true)}
                              />
                            ) : (
                              <div className="text-center px-4">
                                <ShieldCheck size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="text-[10px] opacity-50 uppercase tracking-widest font-bold">
                                  Selfie / Face
                                </p>
                              </div>
                            )}

                            {selectedRequest.face_url && (
                              <a
                                href={selectedRequest.face_url}
                                target="_blank"
                                rel="noreferrer"
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 font-bold text-xs"
                              >
                                <ExternalLink size={14} /> Full Preview
                              </a>
                            )}

                            {selectedRequest.face_url && (
                              <div className="absolute bottom-2 left-2 right-2">
                                <a
                                  href={selectedRequest.face_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block text-[10px] text-blue-200 bg-black/40 rounded px-2 py-1 overflow-hidden whitespace-nowrap text-ellipsis"
                                >
                                  Open Selfie URL
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <AdminAvatar
                                size="md"
                                src={selectedProfile?.logo_url}
                                name={selectedProfile?.display_name ?? selectedRequest?.user_id}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-900">
                                  {selectedProfile?.display_name ?? selectedRequest?.user_id?.slice(0, 8) ?? '—'}
                                </p>
                                <p className="truncate text-xs text-gray-500">
                                  @{selectedProfile?.slug ?? 'merchant'}
                                </p>
                              </div>
                            </div>
                            <InfoRow
                              label="Business Name"
                              value={selectedProfile?.display_name ?? selectedRequest?.user_id?.slice(0, 8) ?? '—'}
                            />
                            <InfoRow
                              label="Email Address"
                              value={selectedProfile?.email ?? '—'}
                            />
                            <InfoRow
                              label="Slug"
                              value={selectedProfile?.slug ?? '—'}
                            />
                            <InfoRow label="Document Type" value={selectedRequest.id_type || 'National ID'} />
                            <InfoRow label="Document Number" value={selectedRequest.id_number || '—'} />
                            {selectedRequest.rejection_reason && (
                              <InfoRow label="Last Rejection Reason" value={selectedRequest.rejection_reason} />
                            )}
                        </div>

                        {canWrite && selectedRequest.status === 'pending' && (
                            <div className="flex gap-3 pt-4">
                                <button 
                                    disabled={isProcessing}
                                    onClick={() => handleVerification(selectedRequest.id, selectedRequest.user_id, 'rejected')}
                                    type="button"
                                    className="flex-1 flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 py-2.5 rounded-lg text-xs font-bold hover:bg-red-50 transition"
                                >
                                    <XCircle size={14} /> Reject
                                </button>
                                <button 
                                    disabled={isProcessing}
                                    onClick={() => handleVerification(selectedRequest.id, selectedRequest.user_id, 'verified')}
                                    type="button"
                                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-xs font-bold hover:bg-green-700 transition"
                                >
                                    {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={14} /> Verify</>}
                                </button>
                            </div>
                        )}
                        {!canWrite && selectedRequest.status === 'pending' ? (
                          <p className="pt-4 text-center text-xs text-gray-500">Analyst view — verification actions hidden</p>
                        ) : null}

                        {selectedRequest.status === 'approved' && (
                            <div className="bg-green-50 border border-green-100 p-4 rounded-lg flex items-center gap-3">
                                <UserCheck className="text-green-600" size={20} />
                                <p className="text-green-700 text-xs font-medium">This merchant is verified.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl h-64 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                    <Eye size={32} className="mb-2 opacity-20" />
                    <p className="text-sm">Select a request from the list to view merchant documents.</p>
                </div>
            )}
        </div>

      </div>
      </>
      )}
      </>
      )}

      {activeTab === 'business' && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2 text-gray-600">
              Status
              <select
                value={statusFilter}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            {canWrite && selectedBizIds.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5">
                <span className="text-xs font-semibold text-teal-900">{selectedBizIds.size} selected</span>
                <button
                  type="button"
                  disabled={bulkKycBusy}
                  onClick={() => void runBulkKyc('verified', undefined, 'business')}
                  className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-[11px] text-emerald-800"
                >
                  Bulk approve
                </button>
                <button
                  type="button"
                  disabled={bulkKycBusy}
                  onClick={() => setBulkBizRejectOpen(true)}
                  className="rounded border border-red-200 bg-white px-2 py-0.5 text-[11px] text-red-700"
                >
                  Bulk reject…
                </button>
              </div>
            ) : null}
          </div>

          {businessLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                      <Building2 size={16} className="text-teal-600" /> Business / CAC requests
                    </h3>
                    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {businessRequests.filter((r) => r.status === 'pending').length} Action required
                    </span>
                  </div>
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {filteredBusinessRequests.map((req) => (
                        <tr
                          key={req.id}
                          onClick={() => setSelectedBusinessRequest(req)}
                          className={`cursor-pointer transition-colors ${
                            selectedBusinessRequest?.id === req.id ? 'bg-teal-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="w-10 px-3 py-4" onClick={(e) => e.stopPropagation()}>
                            {canWrite && req.status === 'pending' ? (
                              <input
                                type="checkbox"
                                checked={selectedBizIds.has(req.id)}
                                onChange={() => {
                                  setSelectedBizIds((prev) => {
                                    const next = new Set(prev)
                                    if (next.has(req.id)) next.delete(req.id)
                                    else next.add(req.id)
                                    return next
                                  })
                                }}
                                aria-label="Select business KYC"
                              />
                            ) : null}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <AdminAvatar
                                src={profilesById?.[req.user_id]?.logo_url}
                                name={
                                  profilesById?.[req.user_id]?.display_name ??
                                  req.company_name ??
                                  req.user_id
                                }
                              />
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {profilesById?.[req.user_id]?.display_name ??
                                    req.user_id?.slice(0, 8) ??
                                    'Seller'}
                                </p>
                                <p className="text-[10px] text-gray-500">{req.company_name}</p>
                                {req.status === 'pending' && req.created_at ? (
                                  <p
                                    className={`text-[10px] font-medium ${
                                      Date.now() - new Date(req.created_at).getTime() > 24 * 3_600_000
                                        ? 'text-red-600'
                                        : 'text-amber-600'
                                    }`}
                                  >
                                    {(() => {
                                      const h = Math.floor(
                                        (Date.now() - new Date(req.created_at).getTime()) / 3_600_000,
                                      )
                                      if (h < 1) return 'Waiting <1h'
                                      if (h < 48) return `Waiting ${h}h${h >= 24 ? ' · SLA' : ''}`
                                      return `Waiting ${Math.floor(h / 24)}d · SLA`
                                    })()}
                                  </p>
                                ) : null}
                                {canWrite && req.status === 'pending' ? (
                                  <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                    <AssigneeChip
                                      assignment={bizAssignments.map[req.id]}
                                      me={bizAssignments.me}
                                      busy={bizAssignments.busyId === req.id}
                                      onClaim={() => void bizAssignments.claim(req.id)}
                                      onRelease={() => void bizAssignments.release(req.id)}
                                    />
                                  </div>
                                ) : req.status === 'pending' && bizAssignments.map[req.id] ? (
                                  <p className="mt-1 text-[10px] text-gray-500">
                                    {bizAssignments.map[req.id].assignee_label || 'Assigned'}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                req.status === 'approved'
                                  ? 'bg-green-100 text-green-700'
                                  : req.status === 'pending'
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-400 text-[11px]">
                            {new Date(req.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Eye size={16} className="text-gray-400 ml-auto" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredBusinessRequests.length === 0 && (
                    <div className="p-12 text-center text-gray-400">
                      {businessRequests.length === 0
                        ? 'No business verification requests found.'
                        : 'No requests match the current filter.'}
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-1">
                {selectedBusinessRequest ? (
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm sticky top-6 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900">Review CAC application</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Submitted on {new Date(selectedBusinessRequest.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-6 space-y-6">
                      <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center text-white relative group overflow-hidden">
                        {!certImageError && selectedBusinessRequest.certificate_url ? (
                          <img
                            src={selectedBusinessRequest.certificate_url}
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                            alt="CAC Certificate"
                            onError={() => setCertImageError(true)}
                          />
                        ) : (
                          <div className="text-center px-4">
                            <FileWarning size={32} className="mx-auto mb-2 opacity-20" />
                            <p className="text-[10px] opacity-50 uppercase tracking-widest font-bold">
                              CAC Certificate
                            </p>
                          </div>
                        )}
                        {selectedBusinessRequest.certificate_url && (
                          <a
                            href={selectedBusinessRequest.certificate_url}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 font-bold text-xs"
                          >
                            <ExternalLink size={14} /> Full Preview
                          </a>
                        )}
                      </div>

                      <div className="space-y-4">
                        <InfoRow
                          label="Store"
                          value={
                            selectedBusinessProfile?.display_name ??
                            selectedBusinessRequest?.user_id?.slice(0, 8) ??
                            '—'
                          }
                        />
                        <InfoRow label="Email" value={selectedBusinessProfile?.email ?? '—'} />
                        <InfoRow label="RC / CAC number" value={selectedBusinessRequest.rc_number || '—'} />
                        <InfoRow label="Company name" value={selectedBusinessRequest.company_name || '—'} />
                        {selectedBusinessRequest.rejection_reason && (
                          <InfoRow label="Last rejection reason" value={selectedBusinessRequest.rejection_reason} />
                        )}
                      </div>

                      {canWrite && selectedBusinessRequest.status === 'pending' && (
                        <div className="flex gap-3 pt-4">
                          <button
                            disabled={isProcessing}
                            onClick={() =>
                              handleBusinessVerification(
                                selectedBusinessRequest.id,
                                selectedBusinessRequest.user_id,
                                'rejected'
                              )
                            }
                            type="button"
                            className="flex-1 flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 py-2.5 rounded-lg text-xs font-bold hover:bg-red-50 transition"
                          >
                            <XCircle size={14} /> Reject
                          </button>
                          <button
                            disabled={isProcessing}
                            onClick={() =>
                              handleBusinessVerification(
                                selectedBusinessRequest.id,
                                selectedBusinessRequest.user_id,
                                'verified'
                              )
                            }
                            type="button"
                            className="flex-1 flex items-center justify-center gap-2 bg-teal-600 text-white py-2.5 rounded-lg text-xs font-bold hover:bg-teal-700 transition"
                          >
                            {isProcessing ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <>
                                <CheckCircle size={14} /> Verify
                              </>
                            )}
                          </button>
                        </div>
                      )}
                      {!canWrite && selectedBusinessRequest.status === 'pending' ? (
                        <p className="pt-4 text-center text-xs text-gray-500">Analyst view — verification actions hidden</p>
                      ) : null}

                      {selectedBusinessRequest.status === 'approved' && (
                        <div className="bg-green-50 border border-green-100 p-4 rounded-lg flex items-center gap-3">
                          <UserCheck className="text-green-600" size={20} />
                          <p className="text-green-700 text-xs font-medium">This business is verified.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl h-64 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                    <Eye size={32} className="mb-2 opacity-20" />
                    <p className="text-sm">Select a request to review CAC certificate and RC details.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'abuse' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" /> Abuse reports</h3>
          </div>
          {abuseLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-6 py-3">Reporter</th>
                    <th className="px-6 py-3">Subject</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {abuseReports.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3">{r.reporter?.display_name ?? r.reporter_id?.slice(0, 8)}</td>
                      <td className="px-6 py-3">
                        <Link href={`/dashboard/users?q=${r.subject_user_id}`} className="text-blue-600 hover:underline">{r.subject?.display_name ?? r.subject_user_id?.slice(0, 8)}</Link>
                      </td>
                      <td className="px-6 py-3">{r.category}</td>
                      <td className="px-6 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100">{r.status}</span></td>
                      <td className="px-6 py-3 text-gray-500 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-3"><Link href={`/dashboard/users?q=${r.subject_user_id}`} className="text-xs text-blue-600 font-medium">View user</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {abuseReports.length === 0 && <div className="p-12 text-center text-gray-400">No abuse reports.</div>}
            </div>
          )}
        </div>
      )}

      {activeTab === 'cases' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2"><FileWarning size={16} className="text-purple-500" /> Moderation cases</h3>
          </div>
          {casesLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-6 py-3">Subject</th>
                    <th className="px-6 py-3">Reason</th>
                    <th className="px-6 py-3">Severity</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {modCases.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3">
                        <Link href={`/dashboard/users?q=${c.subject_user_id}`} className="text-blue-600 hover:underline">{c.subject?.display_name ?? c.subject_user_id?.slice(0, 8)}</Link>
                      </td>
                      <td className="px-6 py-3 max-w-xs truncate">{c.reason}</td>
                      <td className="px-6 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">{c.severity}</span></td>
                      <td className="px-6 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100">{c.status}</span></td>
                      <td className="px-6 py-3 text-gray-500 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-3"><Link href={`/dashboard/users?q=${c.subject_user_id}`} className="text-xs text-blue-600 font-medium">View user</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {modCases.length === 0 && <div className="p-12 text-center text-gray-400">No moderation cases.</div>}
            </div>
          )}
        </div>
      )}

      {activeTab === 'appeals' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2"><Scale size={16} className="text-emerald-500" /> Suspension appeals</h3>
            </div>
            {appealsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
            ) : (
              <div className="divide-y divide-gray-100">
                {appeals.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAppeal(a)}
                    className={`p-4 cursor-pointer transition-colors ${selectedAppeal?.id === a.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{a.profile?.display_name ?? a.user_id?.slice(0, 8)}</p>
                        <p className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString()} · {a.status ?? 'pending'}</p>
                      </div>
                      {(a.status === 'pending' || !a.status) && canWrite && (
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => handleAppealDecision(a, 'reject')} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Reject</button>
                          <button type="button" onClick={() => handleAppealDecision(a, 'approve')} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-green-600 text-white hover:bg-green-700">Approve</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {appeals.length === 0 && <div className="p-12 text-center text-gray-400">No suspension appeals.</div>}
              </div>
            )}
          </div>
          <div className="lg:col-span-1">
            {selectedAppeal ? (
              <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-6">
                <h3 className="font-bold text-gray-900 mb-2">Appeal details</h3>
                <p className="text-xs text-gray-500 mb-4">{new Date(selectedAppeal.created_at).toLocaleString()}</p>
                <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-800 whitespace-pre-wrap mb-4">{selectedAppeal.appeal_text}</div>
                {selectedAppeal.evidence_url && <p className="text-xs text-blue-600 mb-2"><a href={selectedAppeal.evidence_url} target="_blank" rel="noreferrer">Evidence link</a></p>}
                {selectedAppeal.admin_notes && <p className="text-xs text-gray-500 mt-2">Admin notes: {selectedAppeal.admin_notes}</p>}
                <Link href={`/dashboard/users?q=${selectedAppeal.user_id}`} className="text-sm text-blue-600 font-medium mt-4 inline-block">View user dossier</Link>
              </div>
            ) : (
              <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl h-64 flex items-center justify-center text-gray-400 text-sm text-center p-4">Select an appeal to view details.</div>
            )}
          </div>
        </div>
      )}

      <ConfirmActionModal
        open={pendingAppealDecision === 'approve'}
        title="Approve this appeal?"
        description="The user will be reactivated and can sign in again."
        impactSummary="User account will be set to active."
        confirmLabel="Approve"
        submitting={isProcessing}
        onClose={() => { setPendingAppealDecision(null); setSelectedAppeal(null); }}
        onConfirm={() => submitAppealDecision({ category: 'other', reason: 'Appeal approved' })}
      />
      <ActionReasonModal
        open={pendingAppealDecision === 'reject'}
        title="Reject this appeal?"
        description="The appeal will be marked rejected. Provide a reason (stored in audit)."
        impactSummary="User remains suspended. Admin notes will be stored."
        categoryOptions={[{ value: 'policy', label: 'Policy violation' }, { value: 'other', label: 'Other' }]}
        onClose={() => { setPendingAppealDecision(null); setSelectedAppeal(null); }}
        onSubmit={submitAppealDecision}
      />
    </div>
  )
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
            <p className="text-sm font-medium text-gray-800">{value}</p>
        </div>
    )
}