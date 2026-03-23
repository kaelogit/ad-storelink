'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, RefreshCcw, Search } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { EmptyState } from '../../../components/admin/EmptyState'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../../../components/ui/DataTable'
import { parseApiError } from '../../../utils/http'
import { useCountryFilter } from '../../../contexts/CountryFilterContext'
import { ALL_COUNTRIES_CODE } from '../../../constants/SupportedCountries'

type DebtRow = {
  id: string
  status: 'open' | 'paid' | 'waived'
  currency_code: string
  amount_minor: number
  reason: string | null
  paid_reference: string | null
  created_at: string
  paid_at: string | null
  updated_at: string
  admin_note: string | null
  admin_note_category: string | null
  service_order_id: string
  order_id: string
  seller_id: string
  seller_name: string | null
  seller_slug: string | null
  seller_country: string | null
  buyer_id: string
  buyer_name: string | null
  buyer_slug: string | null
  age_days: number
}

type DebtStats = {
  openCount: number
  paidCount: number
  waivedCount: number
  overdueOpenCount: number
  aging: { bucket0_7: number; bucket8_30: number; bucket31Plus: number }
}

const WAIVE_CATEGORIES = [
  { value: 'manual_settlement', label: 'Manual settlement reached' },
  { value: 'goodwill', label: 'Goodwill decision' },
  { value: 'fraud_reversal', label: 'Fraud reversal' },
  { value: 'appeal_resolution', label: 'Appeal resolution' },
  { value: 'operations_error', label: 'Operations error' },
  { value: 'other', label: 'Other' },
]

const NOTE_CATEGORIES = [
  { value: 'seller_contact', label: 'Seller contact update' },
  { value: 'evidence_review', label: 'Evidence review' },
  { value: 'payment_arrangement', label: 'Payment arrangement' },
  { value: 'legal', label: 'Legal/compliance note' },
  { value: 'other', label: 'Other' },
]

const MANUAL_PAID_CATEGORIES = [
  { value: 'bank_transfer', label: 'Bank transfer confirmed' },
  { value: 'cash_settlement', label: 'Cash settlement confirmed' },
  { value: 'wallet_offset', label: 'Wallet offset' },
  { value: 'manual_reconciliation', label: 'Manual reconciliation' },
  { value: 'other', label: 'Other' },
]

function fromSmallestUnit(amountMinor: number, currencyCode: string): number {
  const code = (currencyCode || 'NGN').toUpperCase()
  const decimals = ['XOF', 'RWF'].includes(code) ? 0 : 2
  return Number(amountMinor || 0) / Math.pow(10, decimals)
}

export default function ClawbackDebtsPage() {
  const { countryCode } = useCountryFilter()
  const [rows, setRows] = useState<DebtRow[]>([])
  const [stats, setStats] = useState<DebtStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusTab, setStatusTab] = useState<'open' | 'paid' | 'waived' | 'all'>('open')
  const [aging, setAging] = useState<'all' | '0_7' | '8_30' | '31_plus' | 'overdue'>('all')
  const [query, setQuery] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [waiveDebt, setWaiveDebt] = useState<DebtRow | null>(null)
  const [noteDebt, setNoteDebt] = useState<DebtRow | null>(null)
  const [manualPaidDebt, setManualPaidDebt] = useState<DebtRow | null>(null)

  const loadDebts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      status: statusTab,
      aging,
      q: query.trim(),
      limit: '150',
      offset: '0',
      country: countryCode === ALL_COUNTRIES_CODE ? 'ALL' : countryCode,
    })
    const response = await fetch(`/api/admin/clawback-debts/list?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load clawback debts.')
      setFeedback({ tone: 'error', message: msg })
      setRows([])
      setStats(null)
      setLoading(false)
      return
    }
    const payload = (await response.json().catch(() => ({}))) as { rows?: DebtRow[]; stats?: DebtStats }
    setRows(Array.isArray(payload.rows) ? payload.rows : [])
    setStats(payload.stats ?? null)
    setLoading(false)
  }, [aging, countryCode, query, statusTab])

  useEffect(() => {
    loadDebts()
  }, [loadDebts])

  const loadedOpenRows = useMemo(() => rows.filter((row) => row.status === 'open').length, [rows])

  const waive = async ({ category, reason }: { category: string; reason: string }) => {
    if (!waiveDebt?.id) return
    setActionLoading(true)
    setFeedback({ tone: 'info', message: 'Waiving debt...' })
    const response = await fetch('/api/admin/clawback-debts/waive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `clawback-waive-${waiveDebt.id}`,
      },
      body: JSON.stringify({
        debtId: waiveDebt.id,
        reasonCategory: category,
        reason,
      }),
    })
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to waive debt.')
      setFeedback({ tone: 'error', message: msg })
      setActionLoading(false)
      return
    }
    setFeedback({ tone: 'success', message: `Debt ${waiveDebt.id.slice(0, 8)} waived successfully.` })
    setWaiveDebt(null)
    setActionLoading(false)
    await loadDebts()
  }

  const addNote = async ({ category, reason }: { category: string; reason: string }) => {
    if (!noteDebt?.id) return
    setActionLoading(true)
    setFeedback({ tone: 'info', message: 'Saving note...' })
    const response = await fetch('/api/admin/clawback-debts/note', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `clawback-note-${noteDebt.id}-${Date.now()}`,
      },
      body: JSON.stringify({
        debtId: noteDebt.id,
        noteCategory: category,
        note: reason,
      }),
    })
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to save note.')
      setFeedback({ tone: 'error', message: msg })
      setActionLoading(false)
      return
    }
    setFeedback({ tone: 'success', message: `Debt ${noteDebt.id.slice(0, 8)} note updated.` })
    setNoteDebt(null)
    setActionLoading(false)
    await loadDebts()
  }

  const markPaidManually = async ({ category, reason }: { category: string; reason: string }) => {
    if (!manualPaidDebt?.id) return
    setActionLoading(true)
    setFeedback({ tone: 'info', message: 'Marking debt as paid...' })
    const response = await fetch('/api/admin/clawback-debts/mark-paid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `clawback-mark-paid-${manualPaidDebt.id}`,
      },
      body: JSON.stringify({
        debtId: manualPaidDebt.id,
        reasonCategory: category,
        reason,
      }),
    })
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to mark debt as paid.')
      setFeedback({ tone: 'error', message: msg })
      setActionLoading(false)
      return
    }
    setFeedback({ tone: 'success', message: `Debt ${manualPaidDebt.id.slice(0, 8)} marked as paid.` })
    setManualPaidDebt(null)
    setActionLoading(false)
    await loadDebts()
  }

  const tabClass = (tab: typeof statusTab) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
      tab === statusTab ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clawback Debts"
        subtitle="Track seller repayment debts created after company-funded booking refunds."
      />

      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Open debts</p>
          <p className="mt-1 text-2xl font-black text-red-600">{stats?.openCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Overdue open (31+ days)</p>
          <p className="mt-1 text-2xl font-black text-amber-600">{stats?.overdueOpenCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Paid debts</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">{stats?.paidCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Open rows loaded</p>
          <p className="mt-1 text-xl font-black text-gray-900">{loadedOpenRows}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={tabClass('open')} onClick={() => setStatusTab('open')}>Open</button>
          <button type="button" className={tabClass('paid')} onClick={() => setStatusTab('paid')}>Paid</button>
          <button type="button" className={tabClass('waived')} onClick={() => setStatusTab('waived')}>Waived</button>
          <button type="button" className={tabClass('all')} onClick={() => setStatusTab('all')}>All</button>

          <select
            value={aging}
            onChange={(e) => setAging(e.target.value as typeof aging)}
            className="ml-auto rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
          >
            <option value="all">All age buckets</option>
            <option value="0_7">0-7 days</option>
            <option value="8_30">8-30 days</option>
            <option value="31_plus">31+ days</option>
            <option value="overdue">Overdue open only</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[320px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search debt, booking, order, seller, buyer..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={loadDebts}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-10">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No clawback debts found" message="Try a different status, age bucket, or search term." />
      ) : (
        <DataTable>
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead>Debt</DataTableHead>
              <DataTableHead>Parties</DataTableHead>
              <DataTableHead>Amount</DataTableHead>
              <DataTableHead>Age</DataTableHead>
              <DataTableHead>Status</DataTableHead>
              <DataTableHead>References</DataTableHead>
              <DataTableHead className="text-right">Actions</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {rows.map((row) => {
              const overdue = row.status === 'open' && row.age_days >= 31
              return (
                <DataTableRow key={row.id}>
                  <DataTableCell className="align-top">
                    <p className="font-mono text-xs text-gray-800">{row.id.slice(0, 8)}</p>
                    <p className="mt-1 text-[11px] text-gray-500">Created: {new Date(row.created_at).toLocaleString()}</p>
                    {row.admin_note_category && (
                      <p className="mt-1 text-[11px] text-gray-500">Note category: {row.admin_note_category}</p>
                    )}
                  </DataTableCell>
                  <DataTableCell className="align-top">
                    <p className="text-sm font-semibold text-gray-900">{row.seller_name || row.seller_slug || row.seller_id.slice(0, 8)}</p>
                    <p className="text-[11px] text-gray-500">Seller country: {row.seller_country || 'N/A'}</p>
                    <p className="mt-1 text-[11px] text-gray-600">Buyer: {row.buyer_name || row.buyer_slug || row.buyer_id.slice(0, 8)}</p>
                  </DataTableCell>
                  <DataTableCell className="align-top">
                    <p className="font-semibold text-gray-900">
                      {row.currency_code} {fromSmallestUnit(Number(row.amount_minor || 0), row.currency_code).toLocaleString()}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{row.reason || 'No reason provided'}</p>
                  </DataTableCell>
                  <DataTableCell className="align-top">
                    <div className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                      <span>{row.age_days}d</span>
                      {overdue && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="align-top">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${
                        row.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-700'
                          : row.status === 'waived'
                            ? 'bg-gray-200 text-gray-700'
                            : overdue
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {row.status}
                    </span>
                  </DataTableCell>
                  <DataTableCell className="align-top">
                    <p className="font-mono text-[11px] text-gray-700">SO: {row.service_order_id.slice(0, 8)}</p>
                    <p className="font-mono text-[11px] text-gray-700">OR: {row.order_id.slice(0, 8)}</p>
                    {row.paid_reference && (
                      <p className="mt-1 font-mono text-[11px] text-emerald-700">REF: {row.paid_reference}</p>
                    )}
                    <Link
                      href={`/dashboard/audit?q=${encodeURIComponent(row.id)}`}
                      className="mt-1 inline-block text-[11px] font-semibold text-blue-600 underline"
                    >
                      View audit trail
                    </Link>
                  </DataTableCell>
                  <DataTableCell className="align-top text-right">
                    <div className="inline-flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setNoteDebt(row)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Add note
                      </button>
                      {row.status === 'open' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setManualPaidDebt(row)}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            Mark paid
                          </button>
                          <button
                            type="button"
                            onClick={() => setWaiveDebt(row)}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            Waive debt
                          </button>
                        </>
                      )}
                    </div>
                  </DataTableCell>
                </DataTableRow>
              )
            })}
          </DataTableBody>
        </DataTable>
      )}

      <ActionReasonModal
        open={Boolean(manualPaidDebt)}
        title="Mark debt as paid (manual)"
        description="Use this when repayment was completed outside Paystack."
        impactSummary={manualPaidDebt ? `Debt ${manualPaidDebt.id.slice(0, 8)} will be set to paid and seller lock will be removed.` : undefined}
        categoryOptions={MANUAL_PAID_CATEGORIES}
        submitting={actionLoading}
        onClose={() => setManualPaidDebt(null)}
        onSubmit={markPaidManually}
      />

      <ActionReasonModal
        open={Boolean(waiveDebt)}
        title="Waive clawback debt"
        description="This clears seller repayment obligation for this debt."
        impactSummary={waiveDebt ? `Debt ${waiveDebt.id.slice(0, 8)} will be marked as waived and seller lock will be removed.` : undefined}
        categoryOptions={WAIVE_CATEGORIES}
        submitting={actionLoading}
        onClose={() => setWaiveDebt(null)}
        onSubmit={waive}
      />

      <ActionReasonModal
        open={Boolean(noteDebt)}
        title="Add operator note"
        description="Attach investigation details or follow-up context for this debt."
        categoryOptions={NOTE_CATEGORIES}
        submitting={actionLoading}
        onClose={() => setNoteDebt(null)}
        onSubmit={addNote}
      />
    </div>
  )
}
