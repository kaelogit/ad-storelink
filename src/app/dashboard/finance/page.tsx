'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { parseApiError } from '../../../utils/http'
import { Card, CardHeader, CardContent, Button, Badge } from '../../../components/ui'
import { DataTable, DataTableHeader, DataTableBody, DataTableRow, DataTableHead, DataTableCell } from '../../../components/ui'
import { TabsRoot, Tab } from '../../../components/ui'
import {
  Gavel,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  Landmark,
  FileText,
} from 'lucide-react'

export default function FinanceCenter() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tribunal' | 'watchtower'>('tribunal')

  const [stats, setStats] = useState<any>({ escrow_balance: 0, pending_payouts: 0, payout_count: 0 })
  const [disputes, setDisputes] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])

  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [caseLoading, setCaseLoading] = useState(false)
  const [decisionLoading, setDecisionLoading] = useState(false)
  const [reasonModal, setReasonModal] = useState<
    | { kind: 'payout'; payoutId: string; action: 'approve' | 'reject' }
    | { kind: 'verdict'; verdict: 'refunded_buyer' | 'released_seller' }
    | null
  >(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)

  useEffect(() => {
    initData()
  }, [])

  const initData = async () => {
    setLoading(true)
    await Promise.all([fetchStats(), fetchDisputes(), fetchPayouts()])
    setLoading(false)
  }

  const fetchStats = async () => {
    const { data } = await supabase.rpc('get_finance_overview')
    if (data) setStats(data)
  }

  const fetchDisputes = async () => {
    const { data } = await supabase
      .from('disputes')
      .select('*, orders(total_amount, currency_code)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
    if (data) setDisputes(data)
  }

  const fetchPayouts = async () => {
    const { data } = await supabase
      .from('payouts')
      .select('*, profiles(display_name, bank_name, account_number)')
      .eq('status', 'pending')
      .order('amount', { ascending: false })
    if (data) setPayouts(data)
  }

  const processPayout = async ({
    payoutId,
    action,
    reason,
    reasonCategory,
  }: {
    payoutId: string
    action: 'approve' | 'reject'
    reason: string
    reasonCategory: string
  }) => {
    setDecisionLoading(true)
    setFeedback({ tone: 'info', message: `Processing payout ${action}...` })
    const response = await fetch('/api/admin/payouts/decision', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': makeIdempotencyKey('payout-decision'),
      },
      body: JSON.stringify({ payoutId, action, reason, reasonCategory }),
    })

    if (!response.ok) {
      const errorMessage = await parseApiError(response, 'Failed to process payout.')
      setFeedback({ tone: 'error', message: errorMessage })
      setDecisionLoading(false)
      return
    }
    fetchPayouts()
    fetchStats()
    setReasonModal(null)
    setFeedback({ tone: 'success', message: `Payout ${action}d successfully.` })
    setDecisionLoading(false)
  }

  const openCourtroom = async (disputeId: string) => {
    setCaseLoading(true)
    setSelectedCase(null)
    const { data } = await supabase.rpc('get_dispute_dossier', { p_dispute_id: disputeId })
    if (data) setSelectedCase(data)
    setCaseLoading(false)
  }

  const deliverVerdict = async ({
    verdict,
    reason,
    reasonCategory,
  }: {
    verdict: 'refunded_buyer' | 'released_seller'
    reason: string
    reasonCategory: string
  }) => {
    if (!selectedCase) return
    setDecisionLoading(true)
    setFeedback({ tone: 'info', message: 'Delivering dispute verdict...' })
    const response = await fetch('/api/admin/disputes/verdict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': makeIdempotencyKey('dispute-verdict'),
      },
      body: JSON.stringify({
        disputeId: selectedCase.dispute_id,
        orderId: selectedCase.order_ref,
        verdict,
        reasonCategory,
        reason,
      }),
    })

    if (!response.ok) {
      const errorMessage = await parseApiError(response, 'Failed to deliver verdict.')
      setFeedback({ tone: 'error', message: errorMessage })
      setDecisionLoading(false)
      return
    }
    setSelectedCase(null)
    setReasonModal(null)
    fetchDisputes()
    fetchStats()
    setFeedback({ tone: 'success', message: 'Verdict delivered successfully.' })
    setDecisionLoading(false)
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Center"
        subtitle="Handle disputes, escrow, payouts and high-risk fund movements."
        actions={
          <Link href="/dashboard/orders">
            <Button variant="ghost" size="sm">
              <FileText className="h-4 w-4" />
              Order interventions
            </Button>
          </Link>
        }
      />
      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Escrow Vault</span>
            <div className="rounded-full p-2 bg-blue-100 text-blue-600">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[var(--foreground)]">₦{Number(stats.escrow_balance ?? 0).toLocaleString()}</p>
          <p className="text-xs text-[var(--muted)] mt-1">Funds currently locked in trust</p>
        </Card>
        <Card className="p-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Pending Outflows</span>
            <div className="rounded-full p-2 bg-amber-100 text-amber-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[var(--foreground)]">₦{Number(stats.pending_payouts ?? 0).toLocaleString()}</p>
          <p className="text-xs text-[var(--muted)] mt-1">{stats.payout_count ?? 0} requests waiting</p>
        </Card>
        <Card className="p-5 bg-[var(--foreground)] text-[var(--background)] border-0">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider opacity-80">System Health</span>
              <p className="text-lg font-bold mt-1">Operational</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
        </Card>
      </div>

      <TabsRoot>
        <Tab active={activeTab === 'tribunal'} onClick={() => setActiveTab('tribunal')}>
          Dispute Tribunal {disputes.length > 0 && <Badge tone="neutral" className="ml-2">{disputes.length}</Badge>}
        </Tab>
        <Tab active={activeTab === 'watchtower'} onClick={() => setActiveTab('watchtower')}>
          Withdrawal Watchtower {payouts.length > 0 && <Badge tone="neutral" className="ml-2">{payouts.length}</Badge>}
        </Tab>
      </TabsRoot>

      {activeTab === 'tribunal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 overflow-hidden">
            <CardHeader className="py-3">
              <span className="text-sm font-semibold text-[var(--foreground)]">Open disputes</span>
            </CardHeader>
            <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
              {disputes.map((dispute) => (
                <button
                  key={dispute.id}
                  type="button"
                  onClick={() => openCourtroom(dispute.id)}
                  className={`w-full text-left p-4 border-b border-[var(--border)] transition-colors ${
                    selectedCase?.dispute_id === dispute.id ? 'bg-[var(--primary)]/10 border-l-4 border-l-[var(--primary)]' : 'hover:bg-[var(--background)]'
                  }`}
                >
                  <p className="font-medium text-sm text-[var(--foreground)] line-clamp-1">{dispute.reason}</p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-[var(--muted)]">₦{dispute.orders?.total_amount ?? 0}</span>
                    <span className="text-[10px] text-[var(--muted)]">{new Date(dispute.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
              {disputes.length === 0 && <div className="p-8 text-center text-sm text-[var(--muted)]">No active disputes.</div>}
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            {selectedCase ? (
              <Card className="flex flex-col h-[70vh] overflow-hidden">
                {caseLoading ? (
                  <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" /></div>
                ) : (
                  <>
                    <CardHeader className="flex flex-row justify-between items-center py-4">
                      <span className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" /> Dispute #{selectedCase.dispute_id?.slice(0, 8)}
                      </span>
                      <Badge tone="neutral">Escrow: ₦{selectedCase.amount_held}</Badge>
                    </CardHeader>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-x divide-[var(--border)] overflow-hidden min-h-0">
                      <div className="p-4 overflow-y-auto">
                        <h4 className="text-xs font-bold uppercase text-[var(--muted)] mb-2">Evidence</h4>
                        <p className="text-sm bg-red-50 dark:bg-red-950/30 p-3 rounded text-red-800 dark:text-red-200 mb-4">&quot;{selectedCase.reason}&quot;</p>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedCase.evidence_images?.map((img: string, i: number) => (
                            <a key={i} href={img} target="_blank" rel="noreferrer" className="rounded border border-[var(--border)] overflow-hidden">
                              <img src={img} alt="" className="h-20 w-full object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col bg-[var(--background)]/50 min-h-0">
                        <div className="p-2 border-b border-[var(--border)] text-xs font-bold uppercase text-[var(--muted)] text-center">Chat log</div>
                        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                          {(selectedCase.chat_logs ?? []).map((msg: any, i: number) => (
                            <div
                              key={i}
                              className={`text-xs p-2 rounded max-w-[85%] ${
                                msg.role === 'buyer' ? 'bg-blue-100 dark:bg-blue-900/30 self-start' : 'bg-[var(--surface)] border border-[var(--border)] self-end ml-auto'
                              }`}
                            >
                              {msg.text || '[Image]'}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 border-t border-[var(--border)] flex gap-2">
                      <Button
                        variant="danger"
                        className="flex-1"
                        disabled={decisionLoading}
                        onClick={() => setReasonModal({ kind: 'verdict', verdict: 'refunded_buyer' })}
                      >
                        Refund Buyer
                      </Button>
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                        disabled={decisionLoading}
                        onClick={() => setReasonModal({ kind: 'verdict', verdict: 'released_seller' })}
                      >
                        Release to Seller
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            ) : (
              <Card className="h-[70vh] flex items-center justify-center border-dashed">
                <div className="text-center text-[var(--muted)]">
                  <Gavel className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Select a dispute to review evidence and deliver a verdict.</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'watchtower' && (
        <Card className="overflow-hidden">
          <CardHeader className="py-3">
            <span className="text-sm font-semibold text-[var(--foreground)]">Pending payouts</span>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Merchant</DataTableHead>
                  <DataTableHead>Bank details</DataTableHead>
                  <DataTableHead>Amount</DataTableHead>
                  <DataTableHead className="text-right">Action</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {payouts.map((payout) => {
                  const isHighValue = payout.amount > 500000
                  return (
                    <DataTableRow key={payout.id} className={isHighValue ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                      <DataTableCell>
                        <p className="font-medium text-[var(--foreground)]">{payout.profiles?.display_name || 'Unknown'}</p>
                        <p className="text-xs text-[var(--muted)]">Req: {new Date(payout.created_at).toLocaleDateString()}</p>
                      </DataTableCell>
                      <DataTableCell className="text-xs">
                        <p className="font-mono text-[var(--foreground)]">{payout.profiles?.account_number ?? '—'}</p>
                        <p className="text-[var(--muted)]">{payout.profiles?.bank_name ?? '—'}</p>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[var(--foreground)]">₦{Number(payout.amount).toLocaleString()}</span>
                          {isHighValue && (
                            <Badge tone="danger" className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> High value
                            </Badge>
                          )}
                        </div>
                      </DataTableCell>
                      <DataTableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={decisionLoading}
                            onClick={() => setReasonModal({ kind: 'payout', payoutId: payout.id, action: 'reject' })}
                            className="text-red-600 hover:bg-red-50"
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            disabled={decisionLoading}
                            onClick={() => setReasonModal({ kind: 'payout', payoutId: payout.id, action: 'approve' })}
                          >
                            Process <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  )
                })}
              </DataTableBody>
            </DataTable>
            {payouts.length === 0 && <div className="p-12 text-center text-[var(--muted)]">All payouts processed.</div>}
          </CardContent>
        </Card>
      )}

      <ActionReasonModal
        open={reasonModal !== null}
        title={
          reasonModal?.kind === 'payout'
            ? `Confirm Payout ${reasonModal.action === 'approve' ? 'Approval' : 'Rejection'}`
            : 'Confirm Dispute Verdict'
        }
        description="Select a reason category and provide an operator note for audit and analytics."
        impactSummary={
          reasonModal?.kind === 'payout'
            ? reasonModal.action === 'approve'
              ? 'Funds will be sent to the merchant’s bank account. This cannot be undone.'
              : 'Payout will be rejected. The merchant can submit a new request later.'
            : reasonModal?.kind === 'verdict'
              ? reasonModal.verdict === 'refunded_buyer'
                ? 'Escrow will be released to the buyer (refund). Seller will not receive funds.'
                : 'Escrow will be released to the seller. Buyer will not receive a refund.'
              : undefined
        }
        categoryOptions={
          reasonModal?.kind === 'payout'
            ? [
                { value: 'kyc_issue', label: 'KYC issue' },
                { value: 'bank_mismatch', label: 'Bank mismatch' },
                { value: 'fraud_risk', label: 'Fraud risk' },
                { value: 'reserve_policy', label: 'Reserve policy' },
                { value: 'manual_approval', label: 'Manual approval/review' },
                { value: 'other', label: 'Other' },
              ]
            : [
                { value: 'item_not_received', label: 'Item not received' },
                { value: 'item_not_as_described', label: 'Item not as described' },
                { value: 'chargeback_risk', label: 'Chargeback risk' },
                { value: 'policy_violation', label: 'Policy violation' },
                { value: 'manual_exception', label: 'Manual exception' },
                { value: 'other', label: 'Other' },
              ]
        }
        submitting={decisionLoading}
        onClose={() => setReasonModal(null)}
        onSubmit={({ category, reason }) => {
          if (!reasonModal) return
          if (reasonModal.kind === 'payout') {
            return processPayout({
              payoutId: reasonModal.payoutId,
              action: reasonModal.action,
              reason,
              reasonCategory: category,
            })
          }
          return deliverVerdict({
            verdict: reasonModal.verdict,
            reason,
            reasonCategory: category,
          })
        }}
      />
    </div>
  )
}

function makeIdempotencyKey(scope: string) {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${scope}-${randomPart}`
}
