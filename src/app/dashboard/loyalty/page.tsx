'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Coins, Loader2, RefreshCcw, Search } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { EmptyState } from '../../../components/admin/EmptyState'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { StatusBadge } from '../../../components/admin/StatusBadge'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '../../../components/ui/DataTable'
import { parseApiError } from '../../../utils/http'
import { createClient } from '../../../utils/supabase/client'
import type { AdminRole } from '../../../types/admin'
import type { LoyaltySellerRow } from '../../api/admin/loyalty/list/route'

type LoyaltyConfig = {
  platform_max_percentage?: number
  allowed_percentages?: number[]
  notes?: string
  updated_at?: string
}

type PendingPlatformUpdate = {
  platformMaxPercentage: number
  notes: string
}

type PendingSellerUpdate = {
  row: LoyaltySellerRow
  loyaltyMaxPercentage: string
  loyaltyEnabled: boolean
  loyaltyPercentage: number
  clearSellerCap: boolean
}

const PLATFORM_REASON_CATEGORIES = [
  { value: 'policy_change', label: 'Policy change' },
  { value: 'risk_control', label: 'Risk control' },
  { value: 'promotion', label: 'Promotion window' },
  { value: 'other', label: 'Other' },
]

const SELLER_REASON_CATEGORIES = [
  { value: 'policy_cap', label: 'Policy cap' },
  { value: 'fraud_risk', label: 'Fraud risk' },
  { value: 'support_request', label: 'Support request' },
  { value: 'seller_onboarding', label: 'Seller onboarding' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'other', label: 'Other' },
]

export default function LoyaltyProgramPage() {
  const supabase = createClient()
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null)
  const [rows, setRows] = useState<LoyaltySellerRow[]>([])
  const [config, setConfig] = useState<LoyaltyConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [query, setQuery] = useState('')
  const [enabledOnly, setEnabledOnly] = useState(false)
  const [platformMaxDraft, setPlatformMaxDraft] = useState('5')
  const [notesDraft, setNotesDraft] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [pendingPlatform, setPendingPlatform] = useState<PendingPlatformUpdate | null>(null)
  const [pendingSeller, setPendingSeller] = useState<PendingSellerUpdate | null>(null)

  const canEditPlatform = adminRole === 'super_admin' || adminRole === 'finance'
  const canEditSeller = adminRole === 'super_admin' || adminRole === 'finance' || adminRole === 'support'

  const allowedPercentages = useMemo(() => {
    const raw = config?.allowed_percentages
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
    }
    return [1, 2, 5]
  }, [config?.allowed_percentages])

  useEffect(() => {
    let mounted = true
    const loadRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return
      const { data } = await supabase.from('admin_users').select('role').eq('id', user.id).maybeSingle()
      if (mounted && data?.role) setAdminRole(data.role as AdminRole)
    }
    void loadRole()
    return () => { mounted = false }
  }, [supabase])

  const loadDesk = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '150', offset: '0', q: query.trim() })
    if (enabledOnly) params.set('enabled', '1')

    const response = await fetch(`/api/admin/loyalty/list?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load loyalty desk.')
      setFeedback({ tone: 'error', message: msg })
      setRows([])
      setConfig(null)
      setLoading(false)
      return
    }

    const payload = (await response.json()) as {
      rows?: LoyaltySellerRow[]
      config?: LoyaltyConfig
    }
    setRows(Array.isArray(payload.rows) ? payload.rows : [])
    const nextConfig = payload.config ?? null
    setConfig(nextConfig)
    if (nextConfig?.platform_max_percentage != null) {
      setPlatformMaxDraft(String(nextConfig.platform_max_percentage))
    }
    if (typeof nextConfig?.notes === 'string') {
      setNotesDraft(nextConfig.notes)
    }
    setLoading(false)
  }, [enabledOnly, query])

  useEffect(() => {
    void loadDesk()
  }, [loadDesk])

  const enabledCount = useMemo(() => rows.filter((r) => r.loyalty_enabled).length, [rows])

  const submitPlatformUpdate = async ({ category, reason }: { category: string; reason: string }) => {
    if (!pendingPlatform) return
    setSubmitting(true)
    const response = await fetch('/api/admin/loyalty/platform-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `loyalty-platform-${Date.now()}`,
      },
      body: JSON.stringify({
        platformMaxPercentage: pendingPlatform.platformMaxPercentage,
        notes: pendingPlatform.notes,
        reason: `[${category}] ${reason}`,
      }),
    })
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to update platform loyalty config.')
      setFeedback({ tone: 'error', message: msg })
      setSubmitting(false)
      return
    }
    setPendingPlatform(null)
    setSubmitting(false)
    setFeedback({ tone: 'success', message: 'Platform loyalty max updated.' })
    await loadDesk()
  }

  const submitSellerUpdate = async ({ category, reason }: { category: string; reason: string }) => {
    if (!pendingSeller) return
    setSubmitting(true)
    const capRaw = pendingSeller.loyaltyMaxPercentage.trim()
    const capValue = capRaw === '' ? null : Number(capRaw)

    const response = await fetch('/api/admin/loyalty/seller', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `loyalty-seller-${pendingSeller.row.seller_id}-${Date.now()}`,
      },
      body: JSON.stringify({
        sellerId: pendingSeller.row.seller_id,
        loyaltyMaxPercentage: pendingSeller.clearSellerCap ? null : capValue,
        clearSellerCap: pendingSeller.clearSellerCap,
        loyaltyEnabled: pendingSeller.loyaltyEnabled,
        loyaltyPercentage: pendingSeller.loyaltyEnabled ? pendingSeller.loyaltyPercentage : 0,
        reasonCategory: category,
        reason,
      }),
    })
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to update seller loyalty settings.')
      setFeedback({ tone: 'error', message: msg })
      setSubmitting(false)
      return
    }
    setPendingSeller(null)
    setSubmitting(false)
    setFeedback({ tone: 'success', message: 'Seller loyalty settings updated.' })
    await loadDesk()
  }

  const tabClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
      active ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loyalty Program"
        subtitle="Platform reward caps and seller loyalty settings — mirrors mobile seller Store Rewards (1%, 2%, 5%)."
      />
      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Platform defaults</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400">Max reward %</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={platformMaxDraft}
                disabled={!canEditPlatform}
                onChange={(e) => setPlatformMaxDraft(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400">Seller presets (mobile)</label>
              <p className="mt-2 text-sm font-mono text-gray-800">{allowedPercentages.join('%, ')}%</p>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400">Notes</label>
            <textarea
              value={notesDraft}
              disabled={!canEditPlatform}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50"
            />
          </div>
          {canEditPlatform ? (
            <button
              type="button"
              onClick={() =>
                setPendingPlatform({
                  platformMaxPercentage: Number(platformMaxDraft),
                  notes: notesDraft.trim(),
                })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white hover:bg-amber-800"
            >
              Save platform max
            </button>
          ) : (
            <p className="text-[11px] text-gray-500">Read-only for your role. Finance/super_admin can edit platform max.</p>
          )}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-700" />
            <p className="text-xs font-bold uppercase tracking-widest text-amber-900">Desk snapshot</p>
          </div>
          <p className="text-2xl font-black text-amber-950">{enabledCount}</p>
          <p className="text-xs text-amber-800">loyalty-enabled sellers in current view</p>
          <p className="text-[11px] text-amber-700/90 leading-relaxed">
            Effective buyer reward % = min(seller setting, seller admin cap, platform max).
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={tabClass(!enabledOnly)} onClick={() => setEnabledOnly(false)}>
            All sellers
          </button>
          <button type="button" className={tabClass(enabledOnly)} onClick={() => setEnabledOnly(true)}>
            Loyalty enabled only
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[280px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search seller name, slug, email, UUID..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadDesk()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading loyalty sellers...
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Coins} message="No sellers match your filters." />
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Seller</DataTableHead>
                <DataTableHead>Loyalty</DataTableHead>
                <DataTableHead>Caps</DataTableHead>
                <DataTableHead>Issued coins</DataTableHead>
                <DataTableHead>Actions</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {rows.map((row) => (
                <DataTableRow key={row.seller_id}>
                  <DataTableCell>
                    <Link href={`/dashboard/users?userId=${row.seller_id}`} className="text-sm font-bold text-blue-600 hover:underline">
                      @{row.slug || 'seller'}
                    </Link>
                    <p className="text-[10px] text-gray-500">{row.email || row.seller_id.slice(0, 8)}</p>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.loyalty_enabled ? (
                        <StatusBadge tone="success" label={`${row.loyalty_percentage}% active`} />
                      ) : (
                        <StatusBadge tone="neutral" label="Off" />
                      )}
                      {row.effective_percentage > 0 ? (
                        <StatusBadge tone="info" label={`${row.effective_percentage}% effective`} />
                      ) : null}
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <p className="text-xs text-gray-700">
                      Platform max: <span className="font-mono font-bold">{row.platform_max_percentage}%</span>
                    </p>
                    <p className="text-[10px] text-gray-500">
                      Seller cap: {row.loyalty_max_percentage != null ? `${row.loyalty_max_percentage}%` : '—'}
                    </p>
                  </DataTableCell>
                  <DataTableCell>
                    <p className="text-sm font-bold text-gray-900">{Number(row.loyalty_coins_issued || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-gray-500">{row.completed_orders_count} completed orders</p>
                  </DataTableCell>
                  <DataTableCell>
                    {canEditSeller ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPendingSeller({
                            row,
                            loyaltyMaxPercentage:
                              row.loyalty_max_percentage != null ? String(row.loyalty_max_percentage) : '',
                            loyaltyEnabled: row.loyalty_enabled,
                            loyaltyPercentage: Number(row.loyalty_percentage || allowedPercentages[0] || 1),
                            clearSellerCap: false,
                          })
                        }
                        className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400">Read-only</span>
                    )}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </div>

      <ActionReasonModal
        open={pendingPlatform !== null}
        title="Update platform loyalty max?"
        description="Sellers above the new cap will be clamped automatically."
        impactSummary={`Sets platform_max_percentage to ${pendingPlatform?.platformMaxPercentage ?? '—'}%. Matches mobile seller reward ceiling.`}
        categoryOptions={PLATFORM_REASON_CATEGORIES}
        submitting={submitting}
        onClose={() => setPendingPlatform(null)}
        onSubmit={submitPlatformUpdate}
      />

      <ActionReasonModal
        open={pendingSeller !== null}
        title="Update seller loyalty settings"
        description={`Adjust loyalty for @${pendingSeller?.row.slug || 'seller'}. Changes match the mobile Store Rewards screen.`}
        impactSummary={
          pendingSeller
            ? `Enabled: ${pendingSeller.loyaltyEnabled ? 'yes' : 'no'} · Reward: ${pendingSeller.loyaltyEnabled ? `${pendingSeller.loyaltyPercentage}%` : '0%'}`
            : undefined
        }
        extraFields={
          pendingSeller ? (
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 text-xs font-semibold text-gray-700">
                Loyalty enabled
                <input
                  type="checkbox"
                  checked={pendingSeller.loyaltyEnabled}
                  onChange={(e) =>
                    setPendingSeller((prev) => (prev ? { ...prev, loyaltyEnabled: e.target.checked } : prev))
                  }
                />
              </label>
              {pendingSeller.loyaltyEnabled ? (
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-400 mb-2">Reward %</p>
                  <div className="flex gap-2">
                    {allowedPercentages.map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setPendingSeller((prev) => (prev ? { ...prev, loyaltyPercentage: pct } : prev))}
                        className={`flex-1 rounded-lg border px-2 py-2 text-xs font-bold ${
                          pendingSeller.loyaltyPercentage === pct
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">Per-seller cap (%)</p>
                <input
                  type="number"
                  min={0}
                  max={pendingSeller.row.platform_max_percentage}
                  step={0.5}
                  value={pendingSeller.clearSellerCap ? '' : pendingSeller.loyaltyMaxPercentage}
                  disabled={pendingSeller.clearSellerCap}
                  onChange={(e) =>
                    setPendingSeller((prev) =>
                      prev ? { ...prev, loyaltyMaxPercentage: e.target.value, clearSellerCap: false } : prev,
                    )
                  }
                  placeholder={`Optional (≤ ${pendingSeller.row.platform_max_percentage}%)`}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50"
                />
                <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-600">
                  <input
                    type="checkbox"
                    checked={pendingSeller.clearSellerCap}
                    onChange={(e) =>
                      setPendingSeller((prev) =>
                        prev ? { ...prev, clearSellerCap: e.target.checked, loyaltyMaxPercentage: '' } : prev,
                      )
                    }
                  />
                  Clear admin cap (use platform max only)
                </label>
              </div>
            </div>
          ) : null
        }
        categoryOptions={SELLER_REASON_CATEGORIES}
        submitting={submitting}
        onClose={() => setPendingSeller(null)}
        onSubmit={submitSellerUpdate}
      />
    </div>
  )
}
