'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CreditCard,
  ExternalLink,
  Info,
  Loader2,
  RefreshCcw,
  Settings2,
} from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { MarkOrderPaidInline } from '../../../components/admin/MarkOrderPaidInline'
import { EmptyState } from '../../../components/admin/EmptyState'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../../../components/ui/DataTable'
import { parseApiError } from '../../../utils/http'
import { createClient } from '../../../utils/supabase/client'
import type { AdminRole } from '../../../types/admin'

type IncidentConfig = {
  alertWindowHours?: number
  alertErrorThreshold?: number
  stuckOrderMinAgeMinutes?: number
  deskLookbackHours?: number
  notes?: string | null
  updatedAt?: string | null
}

type IncidentSummary = {
  webhookErrorsLookback?: number
  webhookErrorsInAlertWindow?: number
  alertTriggered?: boolean
  stuckOrdersCount?: number
  lastWebhookErrorAt?: string | null
}

type WebhookFailure = {
  id: string
  created_at: string
  message?: string | null
  reference?: string | null
  order_id?: string | null
  currency?: string | null
  hint?: string | null
  purpose?: string | null
}

type StuckOrder = {
  id: string
  status?: string | null
  total_amount?: number | null
  currency_code?: string | null
  buyer_id?: string | null
  seller_id?: string | null
  created_at?: string | null
  age_minutes?: number | null
  origin_channel?: string | null
  checkout_mode?: string | null
}

type DeskPayload = {
  config?: IncidentConfig
  summary?: IncidentSummary
  webhookFailures?: WebhookFailure[]
  stuckOrders?: StuckOrder[]
  methodology?: Record<string, unknown>
}

const REASON_CATEGORIES = [
  { value: 'threshold_tuning', label: 'Threshold tuning' },
  { value: 'incident_response', label: 'Incident response' },
  { value: 'support_escalation', label: 'Support escalation' },
  { value: 'other', label: 'Other' },
]

export default function PaymentIncidentsPage() {
  const supabase = createClient()
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null)
  const [desk, setDesk] = useState<DeskPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pendingSave, setPendingSave] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [tab, setTab] = useState<'failures' | 'stuck'>('failures')

  const [windowDraft, setWindowDraft] = useState(1)
  const [thresholdDraft, setThresholdDraft] = useState(3)
  const [stuckAgeDraft, setStuckAgeDraft] = useState(30)
  const [lookbackDraft, setLookbackDraft] = useState(168)
  const [notesDraft, setNotesDraft] = useState('')

  const canEdit = adminRole === 'super_admin'
  const canReconcile = ['super_admin', 'finance', 'support'].includes(adminRole ?? '')

  useEffect(() => {
    let mounted = true
    const loadRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return
      const { data } = await supabase.from('admin_users').select('role').eq('id', user.id).maybeSingle()
      if (mounted) setAdminRole((data?.role as AdminRole) ?? null)
    }
    void loadRole()
    return () => {
      mounted = false
    }
  }, [supabase])

  const syncDraftFromDesk = useCallback((payload: DeskPayload | null) => {
    const cfg = payload?.config
    if (!cfg) return
    setWindowDraft(cfg.alertWindowHours ?? 1)
    setThresholdDraft(cfg.alertErrorThreshold ?? 3)
    setStuckAgeDraft(cfg.stuckOrderMinAgeMinutes ?? 30)
    setLookbackDraft(cfg.deskLookbackHours ?? 168)
    setNotesDraft(cfg.notes ?? '')
  }, [])

  const loadDesk = useCallback(async () => {
    setLoading(true)
    const response = await fetch('/api/admin/payment-incidents/desk')
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load payment incident desk.')
      setFeedback({ tone: 'error', message: msg })
      setDesk(null)
      setLoading(false)
      return
    }
    const payload = (await response.json()) as DeskPayload
    setDesk(payload)
    syncDraftFromDesk(payload)
    setLoading(false)
  }, [syncDraftFromDesk])

  useEffect(() => {
    void loadDesk()
  }, [loadDesk])

  const summary = desk?.summary
  const failures = desk?.webhookFailures ?? []
  const stuckOrders = desk?.stuckOrders ?? []

  const failureByOrderId = useMemo(() => {
    const map = new Map<string, WebhookFailure>()
    for (const row of failures) {
      if (row.order_id && !map.has(row.order_id)) map.set(row.order_id, row)
    }
    return map
  }, [failures])

  const saveConfig = async ({ reason }: { reason: string }) => {
    setSubmitting(true)
    const response = await fetch('/api/admin/payment-incidents/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `payment-incident-config-${Date.now()}`,
      },
      body: JSON.stringify({
        alertWindowHours: windowDraft,
        alertErrorThreshold: thresholdDraft,
        stuckOrderMinAgeMinutes: stuckAgeDraft,
        deskLookbackHours: lookbackDraft,
        notes: notesDraft.trim() || null,
        reason,
      }),
    })
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to update alert thresholds.')
      setFeedback({ tone: 'error', message: msg })
      setSubmitting(false)
      return
    }
    setFeedback({ tone: 'success', message: 'Alert thresholds updated.' })
    setSubmitting(false)
    await loadDesk()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment incidents (Paystack)"
        subtitle="Webhook failures from observability and orders stuck in AWAITING_PAYMENT — reconcile without manual DB lookup."
        actions={
          <div className="flex flex-col items-end gap-2">
            <DeskLinkPills
              links={[
                { href: '/dashboard/orders', label: 'Transaction Ops' },
                { href: '/dashboard/finance', label: 'Finance' },
                { href: '/dashboard/safety-tests', label: 'QA Hub' },
              ]}
            />
            <button
              type="button"
              onClick={() => void loadDesk()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        }
      />

      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}

      {summary?.alertTriggered ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-900">Alert threshold exceeded</p>
            <p className="text-xs text-red-800 mt-1">
              {summary.webhookErrorsInAlertWindow ?? 0} paystack-webhook error(s) in the last{' '}
              {desk?.config?.alertWindowHours ?? 1}h (threshold: {desk?.config?.alertErrorThreshold ?? 3}).
              Investigate failures below and reconcile stuck orders.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Webhook errors (window)"
          value={summary?.webhookErrorsInAlertWindow ?? 0}
          hint={`Rolling ${desk?.config?.alertWindowHours ?? 1}h window`}
          alert={Boolean(summary?.alertTriggered)}
        />
        <SummaryCard
          label="Webhook errors (lookback)"
          value={summary?.webhookErrorsLookback ?? 0}
          hint={`Last ${desk?.config?.deskLookbackHours ?? 168}h`}
        />
        <SummaryCard
          label="Stuck awaiting payment"
          value={summary?.stuckOrdersCount ?? 0}
          hint={`Older than ${desk?.config?.stuckOrderMinAgeMinutes ?? 30} min, no ref`}
        />
        <SummaryCard
          label="Last webhook error"
          value={
            summary?.lastWebhookErrorAt
              ? new Date(summary.lastWebhookErrorAt).toLocaleString()
              : '—'
          }
          hint="From observability_events"
          isText
        />
      </div>

      {canEdit ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-bold text-gray-900">Alert thresholds</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-gray-400">Alert window (hours)</span>
              <input
                type="number"
                min={1}
                max={168}
                value={windowDraft}
                onChange={(e) => setWindowDraft(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-gray-400">Error threshold</span>
              <input
                type="number"
                min={1}
                max={100}
                value={thresholdDraft}
                onChange={(e) => setThresholdDraft(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-gray-400">Stuck order min age (min)</span>
              <input
                type="number"
                min={5}
                max={1440}
                value={stuckAgeDraft}
                onChange={(e) => setStuckAgeDraft(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-gray-400">Desk lookback (hours)</span>
              <input
                type="number"
                min={1}
                max={720}
                value={lookbackDraft}
                onChange={(e) => setLookbackDraft(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase text-gray-400">Operator notes</span>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={submitting}
            onClick={() => setPendingSave(true)}
            className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
          >
            Save thresholds
          </button>
        </div>
      ) : null}

      <div className="flex gap-2 border-b border-gray-200">
        <TabButton active={tab === 'failures'} onClick={() => setTab('failures')} count={failures.length}>
          Webhook failures
        </TabButton>
        <TabButton active={tab === 'stuck'} onClick={() => setTab('stuck')} count={stuckOrders.length}>
          Stuck orders
        </TabButton>
      </div>

      {loading && !desk ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : tab === 'failures' ? (
        failures.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No webhook failures in lookback window"
            message="paystack-webhook errors appear here when the RPC returns 500 or the edge function crashes."
          />
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>When</DataTableHead>
                <DataTableHead>Error</DataTableHead>
                <DataTableHead>Paystack ref</DataTableHead>
                <DataTableHead>Order</DataTableHead>
                <DataTableHead>Actions</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {failures.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell className="text-xs whitespace-nowrap">
                    {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                  </DataTableCell>
                  <DataTableCell>
                    <p className="text-xs font-medium text-gray-900">{row.message || '—'}</p>
                    {row.hint ? <p className="text-[10px] text-gray-500 mt-0.5">{row.hint}</p> : null}
                  </DataTableCell>
                  <DataTableCell className="font-mono text-[10px] break-all">{row.reference || '—'}</DataTableCell>
                  <DataTableCell className="font-mono text-[10px] break-all">{row.order_id || '—'}</DataTableCell>
                  <DataTableCell>
                    {row.order_id && canReconcile ? (
                      <MarkOrderPaidInline
                        orderId={row.order_id}
                        suggestedReference={row.reference}
                        compact
                        onSuccess={() => void loadDesk()}
                      />
                    ) : row.order_id ? (
                      <Link
                        href={`/dashboard/orders?q=${encodeURIComponent(row.order_id)}`}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open order
                      </Link>
                    ) : (
                      <span className="text-[10px] text-gray-400">No order in metadata</span>
                    )}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )
      ) : stuckOrders.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No stuck orders"
          message={`Orders in AWAITING_PAYMENT/PENDING without a payment reference, older than ${desk?.config?.stuckOrderMinAgeMinutes ?? 30} minutes.`}
        />
      ) : (
        <DataTable>
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead>Order</DataTableHead>
              <DataTableHead>Amount</DataTableHead>
              <DataTableHead>Age</DataTableHead>
              <DataTableHead>Channel</DataTableHead>
              <DataTableHead>Reconcile</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {stuckOrders.map((order) => {
              const linkedFailure = failureByOrderId.get(order.id)
              return (
                <DataTableRow key={order.id}>
                  <DataTableCell>
                    <p className="font-mono text-[10px] break-all text-gray-900">{order.id}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 uppercase">{order.status}</p>
                  </DataTableCell>
                  <DataTableCell className="text-xs font-mono">
                    {order.currency_code} {Number(order.total_amount ?? 0).toLocaleString()}
                  </DataTableCell>
                  <DataTableCell className="text-xs">{order.age_minutes ?? 0} min</DataTableCell>
                  <DataTableCell className="text-[10px] text-gray-600">
                    {order.origin_channel || '—'}
                    {order.checkout_mode ? ` · ${order.checkout_mode}` : ''}
                  </DataTableCell>
                  <DataTableCell>
                    {canReconcile ? (
                      <MarkOrderPaidInline
                        orderId={order.id}
                        suggestedReference={linkedFailure?.reference}
                        compact
                        onSuccess={() => void loadDesk()}
                      />
                    ) : (
                      <Link
                        href={`/dashboard/orders?q=${encodeURIComponent(order.id)}`}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </Link>
                    )}
                  </DataTableCell>
                </DataTableRow>
              )
            })}
          </DataTableBody>
        </DataTable>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 flex items-start gap-2">
        <Info className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-900 leading-relaxed">
          Webhook errors are logged by the <code className="font-mono">paystack-webhook</code> edge function on 500 responses.
          Use <strong>Mark paid</strong> only after confirming payment in Paystack Dashboard. See{' '}
          <code className="font-mono">store-link-mobile/docs/PAYSTACK_CALLBACK_FAILURE.md</code>.
        </p>
      </div>

      <ActionReasonModal
        open={pendingSave}
        title="Update payment incident thresholds"
        description="Explain why alert thresholds are changing. Saved to audit log."
        categoryOptions={REASON_CATEGORIES}
        submitting={submitting}
        onClose={() => setPendingSave(false)}
        onSubmit={async ({ reason }) => {
          setPendingSave(false)
          await saveConfig({ reason })
        }}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  hint,
  alert,
  isText,
}: {
  label: string
  value: number | string
  hint: string
  alert?: boolean
  isText?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`mt-1 font-black text-gray-900 ${isText ? 'text-sm' : 'text-2xl'}`}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-1">{hint}</p>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-bold border-b-2 -mb-px transition ${
        active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
      }`}
    >
      {children}
      <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px]">{count}</span>
    </button>
  )
}
