'use client'

import Link from 'next/link'
import { Copy, Gift, Link2, Users } from 'lucide-react'
import { StatusBadge } from './StatusBadge'

type ReferralSummary = {
  referral_code?: string | null
  referred_by?: {
    id: string
    display_name?: string | null
    email?: string | null
    referral_code?: string | null
  } | null
  invitee_count?: number
  coins_earned?: number
  invitees?: Array<{
    invitee_id: string
    invitee_name?: string | null
    attributed_at?: string
    total_coins_paid?: number
    fraud_flags?: string[] | null
  }>
  reward_config?: {
    signup_coins?: number
    first_order_coins?: number
    repeat_order_coins?: number
    repeat_window_months?: number
    notes?: string
  } | null
}

type UserReferralPanelProps = {
  userId: string
  summary: ReferralSummary | null
}

const INVITE_BASE = 'https://storelink.ng'

const FLAG_LABELS: Record<string, string> = {
  high_velocity: 'High velocity',
  shared_phone: 'Shared phone',
  circular_referral: 'Circular',
  no_order_conversion: 'No conversion',
}

export function UserReferralPanel({ userId, summary }: UserReferralPanelProps) {
  if (!summary) return null

  const code = summary.referral_code?.trim() || ''
  const inviteUrl = code ? `${INVITE_BASE}?ref=${encodeURIComponent(code)}` : ''
  const config = summary.reward_config

  const copyLink = () => {
    if (!inviteUrl) return
    void navigator.clipboard.writeText(inviteUrl)
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-emerald-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
            <Gift size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Referrals</p>
            <p className="text-sm font-black text-gray-900">
              {(summary.invitee_count ?? 0).toLocaleString()} invitee(s)
            </p>
          </div>
        </div>
        <StatusBadge
          label={`${Number(summary.coins_earned ?? 0).toLocaleString()} coins earned`}
          tone="success"
        />
      </div>

      <div className="p-4 space-y-4">
        {code ? (
          <div className="rounded-lg border border-emerald-100 bg-white/80 p-3">
            <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">Invite link</p>
            <p className="text-xs font-mono text-gray-800 break-all">{inviteUrl}</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-700 hover:bg-gray-50"
              >
                <Copy size={10} /> Copy
              </button>
              <Link
                href={`/dashboard/referrals?inviterId=${userId}`}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100"
              >
                <Users size={10} /> Desk
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">No referral code on profile.</p>
        )}

        {summary.referred_by ? (
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-[9px] font-bold uppercase text-gray-400 mb-1 flex items-center gap-1">
              <Link2 size={10} /> Referred by
            </p>
            <Link
              href={`/dashboard/users?q=${summary.referred_by.id}`}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              {summary.referred_by.display_name || summary.referred_by.email || summary.referred_by.id.slice(0, 8)}
            </Link>
            {summary.referred_by.referral_code ? (
              <p className="text-[10px] text-gray-400 mt-1">Code: {summary.referred_by.referral_code}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            Organic signup — no inviter attributed.
          </p>
        )}

        {(summary.invitees?.length ?? 0) > 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2 max-h-36 overflow-y-auto">
            <p className="text-[9px] font-bold uppercase text-gray-400">Recent invitees</p>
            {summary.invitees?.map((row) => (
              <div key={row.invitee_id} className="flex items-start justify-between gap-2 text-[10px] border-b border-gray-50 pb-1.5 last:border-0">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/users?q=${row.invitee_id}`}
                    className="font-bold text-blue-600 hover:underline truncate block"
                  >
                    {row.invitee_name || row.invitee_id.slice(0, 8)}
                  </Link>
                  <p className="text-gray-400">
                    {row.attributed_at ? new Date(row.attributed_at).toLocaleDateString() : '—'}
                  </p>
                  {(row.fraud_flags?.length ?? 0) > 0 ? (
                    <p className="text-amber-700 font-semibold">
                      {(row.fraud_flags ?? []).map((f) => FLAG_LABELS[f] || f).join(' · ')}
                    </p>
                  ) : null}
                </div>
                <p className="font-black text-emerald-600 shrink-0">
                  +{Number(row.total_coins_paid ?? 0).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {config ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-3">
            <p className="text-[9px] font-bold uppercase text-gray-400 mb-2">Reward constants (documented)</p>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div><span className="text-gray-500">Signup</span><p className="font-bold">{config.signup_coins?.toLocaleString()} coins</p></div>
              <div><span className="text-gray-500">First order</span><p className="font-bold">{config.first_order_coins?.toLocaleString()} coins</p></div>
              <div><span className="text-gray-500">Repeat order</span><p className="font-bold">{config.repeat_order_coins?.toLocaleString()} coins</p></div>
              <div><span className="text-gray-500">Repeat window</span><p className="font-bold">{config.repeat_window_months} mo</p></div>
            </div>
            {config.notes ? (
              <p className="text-[9px] text-gray-400 mt-2 leading-relaxed">{config.notes}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
