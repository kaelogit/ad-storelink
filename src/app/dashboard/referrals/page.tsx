'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Gift, Loader2, RefreshCcw, Search, Users } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { EmptyState } from '../../../components/admin/EmptyState'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { StatusBadge } from '../../../components/admin/StatusBadge'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../../../components/ui/DataTable'
import { parseApiError } from '../../../utils/http'
import { useCountryFilter } from '../../../contexts/CountryFilterContext'
import { ALL_COUNTRIES_CODE } from '../../../constants/SupportedCountries'

type ReferralRow = {
  invitee_id: string
  invitee_name: string | null
  invitee_email: string | null
  invitee_country: string | null
  attributed_at: string
  inviter_id: string
  inviter_name: string | null
  inviter_email: string | null
  inviter_referral_code: string | null
  signup_coins_paid: number
  order_coins_paid: number
  total_coins_paid: number
  first_order_reward_at: string | null
  fraud_flags: string[] | null
  review_status?: string | null
  signup_reward_granted?: boolean | null
}

type ReferralStats = {
  totalAttributed?: number
  attributedLast30d?: number
  coinsPaidSignup?: number
  coinsPaidOrders?: number
  coinsPaidTotal?: number
  conversionRate?: number
  suspiciousCount?: number
  topInviters?: Array<{
    inviter_id: string
    inviter_name: string | null
    inviter_referral_code: string | null
    invitee_count: number
    coins_paid: number
  }>
  rewardConfig?: {
    signup_coins?: number
    first_order_coins?: number
    repeat_order_coins?: number
    repeat_window_months?: number
    source?: string
    notes?: string
  }
}

const FLAG_LABELS: Record<string, { label: string; tone: 'warning' | 'danger' | 'neutral' }> = {
  high_velocity: { label: 'High velocity', tone: 'warning' },
  shared_phone: { label: 'Shared phone', tone: 'danger' },
  circular_referral: { label: 'Circular', tone: 'danger' },
  duplicate_device: { label: 'Duplicate device', tone: 'danger' },
  pending_review: { label: 'Pending review', tone: 'warning' },
  no_order_conversion: { label: 'No conversion', tone: 'neutral' },
}

export default function ReferralsPage() {
  const { countryCode } = useCountryFilter()
  const searchParams = useSearchParams()
  const inviterFromUrl = searchParams.get('inviterId')?.trim() || ''

  const [rows, setRows] = useState<ReferralRow[]>([])
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [suspiciousOnly, setSuspiciousOnly] = useState(false)
  const [inviterFilter, setInviterFilter] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  useEffect(() => {
    if (inviterFromUrl) setInviterFilter(inviterFromUrl)
  }, [inviterFromUrl])

  const loadReferrals = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      q: query.trim(),
      country: countryCode === ALL_COUNTRIES_CODE ? 'ALL' : countryCode,
      limit: '150',
      offset: '0',
    })
    if (suspiciousOnly) params.set('suspicious', '1')
    if (inviterFilter.trim()) params.set('inviterId', inviterFilter.trim())

    const response = await fetch(`/api/admin/referrals/list?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load referrals.')
      setFeedback({ tone: 'error', message: msg })
      setRows([])
      setStats(null)
      setLoading(false)
      return
    }
    const payload = (await response.json().catch(() => ({}))) as { rows?: ReferralRow[]; stats?: ReferralStats }
    setRows(Array.isArray(payload.rows) ? payload.rows : [])
    setStats(payload.stats ?? null)
    setLoading(false)
  }, [countryCode, inviterFilter, query, suspiciousOnly])

  useEffect(() => {
    loadReferrals()
  }, [loadReferrals])

  const reviewReferral = useCallback(async (inviteeId: string, decision: 'approved' | 'rejected') => {
    setReviewingId(inviteeId)
    try {
      const response = await fetch('/api/admin/referrals/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteeId, decision }),
      })
      if (!response.ok) {
        const msg = await parseApiError(response, 'Review failed.')
        setFeedback({ tone: 'error', message: msg })
        return
      }
      const payload = await response.json().catch(() => ({}))
      const granted = payload?.result?.signup_coins_granted ?? 0
      setFeedback({
        tone: 'success',
        message:
          decision === 'approved'
            ? `Referral approved${granted ? ` · ${granted} signup coins released` : ''}.`
            : 'Referral rejected — signup reward will not pay.',
      })
      await loadReferrals()
    } finally {
      setReviewingId(null)
    }
  }, [loadReferrals])

  const flaggedCount = useMemo(
    () => rows.filter((r) => (r.fraud_flags?.length ?? 0) > 0).length,
    [rows]
  )

  const filterTabClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
      active ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  const config = stats?.rewardConfig

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referral Desk"
        subtitle="Invite attributions, reward payouts, fraud heuristics, and review queue. Rules: store-link-mobile/docs/REFERRAL_FRAUD_RULES.md"
      />

      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total attributed</p>
          <p className="mt-1 text-2xl font-black text-gray-900">{stats?.totalAttributed?.toLocaleString() ?? '—'}</p>
          <p className="text-[10px] text-gray-400 mt-1">{stats?.attributedLast30d ?? 0} in last 30d</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Coins paid (signup)</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">{Number(stats?.coinsPaidSignup ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Coins paid (orders)</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">{Number(stats?.coinsPaidOrders ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Order conversion</p>
          <p className="mt-1 text-2xl font-black text-blue-600">{stats?.conversionRate ?? 0}%</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Suspicious rows</p>
          <p className="mt-1 text-2xl font-black text-amber-800">{stats?.suspiciousCount?.toLocaleString() ?? '—'}</p>
          <p className="text-[10px] text-amber-600 mt-1">{flaggedCount} flagged in current view</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={filterTabClass(!suspiciousOnly)} onClick={() => setSuspiciousOnly(false)}>
              All referrals
            </button>
            <button type="button" className={filterTabClass(suspiciousOnly)} onClick={() => setSuspiciousOnly(true)}>
              Suspicious only
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[280px] flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search invitee, inviter, email, code, UUID..."
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <input
              value={inviterFilter}
              onChange={(e) => setInviterFilter(e.target.value)}
              placeholder="Filter by inviter UUID"
              className="w-56 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={loadReferrals}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gift size={16} className="text-emerald-600" />
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Reward constants</p>
          </div>
          {config ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Signup</span><span className="font-bold">{config.signup_coins?.toLocaleString()} coins</span></div>
              <div className="flex justify-between"><span className="text-gray-600">First order</span><span className="font-bold">{config.first_order_coins?.toLocaleString()} coins</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Repeat order</span><span className="font-bold">{config.repeat_order_coins?.toLocaleString()} coins</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Repeat window</span><span className="font-bold">{config.repeat_window_months} months</span></div>
              <p className="text-[10px] text-gray-500 pt-2 border-t border-emerald-100 leading-relaxed">
                Source: <span className="font-mono">{config.source}</span>. {config.notes}
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Loading config…</p>
          )}
        </div>
      </div>

      {(stats?.topInviters?.length ?? 0) > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
            <Users size={12} /> Top inviters
          </p>
          <div className="flex flex-wrap gap-2">
            {stats?.topInviters?.map((inv) => (
              <button
                key={inv.inviter_id}
                type="button"
                onClick={() => setInviterFilter(inv.inviter_id)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left hover:border-emerald-300 hover:bg-emerald-50/50 transition"
              >
                <p className="text-xs font-bold text-gray-900">{inv.inviter_name || inv.inviter_id.slice(0, 8)}</p>
                <p className="text-[10px] text-gray-500">{inv.invitee_count} invitees · {Number(inv.coins_paid).toLocaleString()} coins</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-10">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No referrals found" message="Try a different filter, country, or search term." />
      ) : (
        <DataTable>
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead>Invitee</DataTableHead>
              <DataTableHead>Inviter</DataTableHead>
              <DataTableHead>Attributed</DataTableHead>
              <DataTableHead>Rewards paid</DataTableHead>
              <DataTableHead>Flags</DataTableHead>
              <DataTableHead>Review</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {rows.map((row) => {
              const hasFlags = (row.fraud_flags?.length ?? 0) > 0
              return (
                <DataTableRow key={`${row.invitee_id}-${row.inviter_id}`}>
                  <DataTableCell className="align-top">
                    <Link href={`/dashboard/users?q=${row.invitee_id}`} className="text-sm font-semibold text-blue-600 hover:underline">
                      {row.invitee_name || row.invitee_email || row.invitee_id.slice(0, 8)}
                    </Link>
                    <p className="text-[11px] text-gray-500">{row.invitee_email}</p>
                    <p className="text-[10px] text-gray-400">{row.invitee_country}</p>
                  </DataTableCell>
                  <DataTableCell className="align-top">
                    <Link href={`/dashboard/users?q=${row.inviter_id}`} className="text-sm font-semibold text-blue-600 hover:underline">
                      {row.inviter_name || row.inviter_email || row.inviter_id.slice(0, 8)}
                    </Link>
                    <p className="text-[11px] text-gray-500 font-mono">{row.inviter_referral_code}</p>
                    <button
                      type="button"
                      onClick={() => setInviterFilter(row.inviter_id)}
                      className="mt-1 text-[10px] font-bold text-emerald-700 hover:underline"
                    >
                      Filter inviter
                    </button>
                  </DataTableCell>
                  <DataTableCell className="align-top">
                    <p className="text-sm text-gray-900">{new Date(row.attributed_at).toLocaleString()}</p>
                    {row.first_order_reward_at ? (
                      <p className="text-[10px] text-gray-500 mt-1">First order: {new Date(row.first_order_reward_at).toLocaleDateString()}</p>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-1">No order reward yet</p>
                    )}
                  </DataTableCell>
                  <DataTableCell className="align-top">
                    <p className="text-sm font-bold text-gray-900">{row.total_coins_paid.toLocaleString()} total</p>
                    <p className="text-[10px] text-gray-500">Signup {row.signup_coins_paid} · Orders {row.order_coins_paid}</p>
                  </DataTableCell>
                  <DataTableCell className="align-top">
                    {hasFlags ? (
                      <div className="flex flex-wrap gap-1">
                        {(row.fraud_flags ?? []).map((flag) => {
                          const meta = FLAG_LABELS[flag] ?? { label: flag, tone: 'neutral' as const }
                          return (
                            <span key={flag} className="inline-flex items-center gap-1">
                              <StatusBadge label={meta.label} tone={meta.tone} />
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400">—</span>
                    )}
                    {hasFlags ? <AlertTriangle className="h-4 w-4 text-amber-500 mt-1" /> : null}
                  </DataTableCell>
                  <DataTableCell className="align-top">
                    <StatusBadge
                      label={row.review_status === 'pending_review' ? 'Pending' : row.review_status === 'rejected' ? 'Rejected' : 'Approved'}
                      tone={row.review_status === 'pending_review' ? 'warning' : row.review_status === 'rejected' ? 'danger' : 'success'}
                    />
                    {row.review_status === 'pending_review' ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={reviewingId === row.invitee_id}
                          onClick={() => reviewReferral(row.invitee_id, 'approved')}
                          className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={reviewingId === row.invitee_id}
                          onClick={() => reviewReferral(row.invitee_id, 'rejected')}
                          className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    ) : row.signup_reward_granted ? (
                      <p className="text-[10px] text-gray-500 mt-1">Signup reward paid</p>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-1">No signup payout</p>
                    )}
                  </DataTableCell>
                </DataTableRow>
              )
            })}
          </DataTableBody>
        </DataTable>
      )}
    </div>
  )
}
