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
  ShieldCheck, XCircle, CheckCircle, Eye, Loader2, ExternalLink, Clock, UserCheck, AlertTriangle, FileWarning, Scale
} from 'lucide-react'

type ModTab = 'kyc' | 'abuse' | 'cases' | 'appeals'

export default function ModeratorPage() {
  const supabase = createClient()
  const tableState = useTableStateFromUrl({ status: '' })
  const { status: statusFilter, sort, order, setStatus, setSort, setOrder } = tableState
  const [activeTab, setActiveTab] = useState<ModTab>('kyc')
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [pendingVerification, setPendingVerification] = useState<{
    requestId: string
    profileId: string
    status: 'verified' | 'rejected'
    displayName?: string
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

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('merchant_verifications')
      .select(`
        *,
        profile:profile_id (display_name, email, logo_url, slug)
      `)
      .order('created_at', { ascending: false })
    if (data) setRequests(data)
    setLoading(false)
  }, [])

  const filteredRequests = useMemo(() => {
    let list = requests
    if (statusFilter === 'pending') list = list.filter((r) => r.status === 'pending')
    else if (statusFilter === 'approved') list = list.filter((r) => r.status === 'approved')
    else if (statusFilter === 'rejected') list = list.filter((r) => r.status === 'rejected')
    list = [...list].sort((a, b) => {
      const aVal = sort === 'created_at' ? new Date(a.created_at).getTime() : (a.profile?.display_name ?? '').toLowerCase()
      const bVal = sort === 'created_at' ? new Date(b.created_at).getTime() : (b.profile?.display_name ?? '').toLowerCase()
      if (typeof aVal === 'number' && typeof bVal === 'number') return order === 'asc' ? aVal - bVal : bVal - aVal
      return order === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal))
    })
    return list
  }, [requests, statusFilter, sort, order])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

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

  const handleVerification = async (requestId: string, profileId: string, status: 'verified' | 'rejected') => {
    setPendingVerification({ requestId, profileId, status, displayName: selectedRequest?.profile?.display_name })
  }

  const executeVerification = async () => {
    if (!pendingVerification) return
    const { requestId, profileId, status } = pendingVerification
    setIsProcessing(true)
    setFeedback({ tone: 'info', message: 'Processing moderation decision...' })

    const response = await fetch('/api/admin/moderation/verification', {
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
    setPendingVerification(null)
    setFeedback({ tone: 'success', message: `Merchant marked as ${status}.` })
    setIsProcessing(false)
    fetchRequests()
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <PageHeader
        title="Moderation Hub"
        subtitle="Review merchant verification requests and maintain platform safety."
      />
      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <TabsRoot>
        <Tab active={activeTab === 'kyc'} onClick={() => setActiveTab('kyc')}>KYC / Verification</Tab>
        <Tab active={activeTab === 'abuse'} onClick={() => setActiveTab('abuse')}>Abuse Reports</Tab>
        <Tab active={activeTab === 'cases'} onClick={() => setActiveTab('cases')}>Moderation Cases</Tab>
        <Tab active={activeTab === 'appeals'} onClick={() => setActiveTab('appeals')}>Suspension Appeals</Tab>
      </TabsRoot>

      {activeTab === 'kyc' && (
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
      </div>

      <ConfirmActionModal
        open={pendingVerification !== null}
        title={pendingVerification?.status === 'verified' ? 'Verify this merchant?' : 'Reject this merchant?'}
        description={
          pendingVerification?.status === 'verified'
            ? `Approve verification for ${pendingVerification.displayName ?? 'this merchant'}. They will gain verified status.`
            : `Reject verification for ${pendingVerification?.displayName ?? 'this merchant'}. They will need to reapply.`
        }
        impactSummary={
          pendingVerification?.status === 'verified'
            ? 'Merchant will be marked verified and can use verified-only features.'
            : 'Application will be marked rejected. Merchant can submit a new request later.'
        }
        confirmLabel={pendingVerification?.status === 'verified' ? 'Verify' : 'Reject'}
        submitting={isProcessing}
        onClose={() => setPendingVerification(null)}
        onConfirm={executeVerification}
      />

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
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center font-bold text-blue-600">
                                            {req.profile?.display_name?.[0]}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{req.profile?.display_name}</p>
                                            <p className="text-[10px] text-gray-500">@{req.profile?.slug}</p>
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
                        {/* ID Preview (Simulation) */}
                        <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center text-white relative group">
                           {selectedRequest.id_url ? (
                               <img src={selectedRequest.id_url} className="w-full h-full object-contain rounded-lg" alt="Identity Document" />
                           ) : (
                               <div className="text-center">
                                   <ShieldCheck size={32} className="mx-auto mb-2 opacity-20" />
                                   <p className="text-[10px] opacity-50 uppercase tracking-widest font-bold">Document Image</p>
                               </div>
                           )}
                           <button className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 font-bold text-xs">
                               <ExternalLink size={14} /> Full Preview
                           </button>
                        </div>

                        <div className="space-y-4">
                            <InfoRow label="Business Name" value={selectedRequest.profile?.display_name} />
                            <InfoRow label="Email Address" value={selectedRequest.profile?.email} />
                            <InfoRow label="Document Type" value={selectedRequest.id_type || 'National ID'} />
                            <InfoRow label="Document Number" value={selectedRequest.id_number || 'TRX-9982-11'} />
                        </div>

                        {selectedRequest.status === 'pending' && (
                            <div className="flex gap-3 pt-4">
                                <button 
                                    disabled={isProcessing}
                                    onClick={() => handleVerification(selectedRequest.id, selectedRequest.profile_id, 'rejected')}
                                    type="button"
                                    className="flex-1 flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 py-2.5 rounded-lg text-xs font-bold hover:bg-red-50 transition"
                                >
                                    <XCircle size={14} /> Reject
                                </button>
                                <button 
                                    disabled={isProcessing}
                                    onClick={() => handleVerification(selectedRequest.id, selectedRequest.profile_id, 'verified')}
                                    type="button"
                                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-xs font-bold hover:bg-green-700 transition"
                                >
                                    {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={14} /> Verify</>}
                                </button>
                            </div>
                        )}

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
                      {(a.status === 'pending' || !a.status) && (
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