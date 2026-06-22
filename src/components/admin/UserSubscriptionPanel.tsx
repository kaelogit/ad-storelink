'use client'

import { useMemo, useState } from 'react'
import {
  CalendarClock,
  CreditCard,
  Gem,
  RefreshCw,
  Shield,
  Sparkles,
  Undo2,
} from 'lucide-react'
import { ActionReasonModal } from './ActionReasonModal'
import { StatusBadge } from './StatusBadge'
import { parseApiError } from '../../utils/http'

type SubscriptionPayment = {
  id: string
  amount: number
  description: string | null
  created_at: string
}

type SubscriptionProfile = {
  subscription_plan?: string | null
  subscription_expiry?: string | null
  subscription_status?: string | null
  prestige_weight?: number | null
  is_seller?: boolean | null
  currency_code?: string | null
}

type SubscriptionAction =
  | 'grant_diamond'
  | 'extend_diamond'
  | 'downgrade_standard'
  | 'cancel_diamond'
  | 'refund_and_revoke'

type UserSubscriptionPanelProps = {
  userId: string
  dossierPlanName?: string
  dossierDaysLeft?: number
  profile: SubscriptionProfile | null
  payments: SubscriptionPayment[]
  canManage: boolean
  onUpdated: () => Promise<void> | void
  onFeedback: (payload: { tone: 'success' | 'error' | 'info'; message: string }) => void
}

const CATEGORY_OPTIONS = [
  { value: 'goodwill', label: 'Goodwill / compensation' },
  { value: 'billing_error', label: 'Billing error' },
  { value: 'chargeback', label: 'Chargeback' },
  { value: 'customer_request', label: 'Customer request' },
  { value: 'fraud_reversal', label: 'Fraud reversal' },
  { value: 'promotion', label: 'Promotion / partnership' },
  { value: 'support_resolution', label: 'Support resolution' },
  { value: 'other', label: 'Other' },
]

function formatPlanLabel(plan: string | null | undefined, isSeller?: boolean | null) {
  const p = (plan || '').toLowerCase()
  if (p === 'diamond') return 'Diamond'
  if (p === 'standard') return 'Standard'
  if (isSeller) return 'Standard (seller)'
  return 'None'
}

function daysUntil(expiry: string | null | undefined): number | null {
  if (!expiry) return null
  const end = new Date(expiry)
  if (Number.isNaN(end.getTime())) return null
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

export function UserSubscriptionPanel({
  userId,
  dossierPlanName,
  dossierDaysLeft,
  profile,
  payments,
  canManage,
  onUpdated,
  onFeedback,
}: UserSubscriptionPanelProps) {
  const [pendingAction, setPendingAction] = useState<SubscriptionAction | null>(null)
  const [months, setMonths] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [paystackOverride, setPaystackOverride] = useState('')

  const plan = profile?.subscription_plan ?? dossierPlanName?.toLowerCase()
  const status = (profile?.subscription_status || 'active').toLowerCase()
  const expiry = profile?.subscription_expiry ?? null
  const daysLeft = daysUntil(expiry) ?? dossierDaysLeft ?? null
  const isDiamond = (plan || '').toLowerCase() === 'diamond' && status === 'active' && (daysLeft === null || daysLeft > 0)
  const latestPayment = payments[0] ?? null

  const actionCopy = useMemo(() => {
    switch (pendingAction) {
      case 'grant_diamond':
        return {
          title: 'Grant Diamond membership',
          description: 'Complimentary or manual Diamond access without a new Paystack charge.',
          impact: `Diamond will be active for ${months} month(s) from now (or extended from current expiry if already active).`,
          needsMonths: true,
        }
      case 'extend_diamond':
        return {
          title: 'Extend Diamond membership',
          description: 'Add paid or goodwill time to an existing or expired Diamond plan.',
          impact: `Adds ${months} month(s) from the current active expiry, or from today if expired.`,
          needsMonths: true,
        }
      case 'downgrade_standard':
        return {
          title: 'Downgrade membership',
          description: 'Sellers move to free Standard. Buyers lose Diamond perks.',
          impact: 'Diamond badge and expiry-based perks stop immediately.',
          needsMonths: false,
        }
      case 'cancel_diamond':
        return {
          title: 'Cancel Diamond (expire now)',
          description: 'Expire Diamond immediately without processing a Paystack refund.',
          impact: 'User keeps account access; Diamond perks end now. Use Refund & revoke when money must be returned.',
          needsMonths: false,
        }
      case 'refund_and_revoke':
        return {
          title: 'Refund & revoke Diamond',
          description: 'Submit Paystack refund for the latest subscription payment, then expire Diamond.',
          impact: 'Attempts automatic refund using the latest subscription Paystack reference, then cancels membership.',
          needsMonths: false,
        }
      default:
        return null
    }
  }, [pendingAction, months])

  const submitAction = async (payload: { category: string; reason: string }) => {
    if (!pendingAction) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/users/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          userId,
          action: pendingAction,
          months: actionCopy?.needsMonths ? months : undefined,
          reasonCategory: payload.category,
          reason: payload.reason.trim(),
          paystackReference: pendingAction === 'refund_and_revoke' ? paystackOverride.trim() || undefined : undefined,
        }),
      })

      if (!response.ok) {
        const message = await parseApiError(response, 'Subscription update failed.')
        onFeedback({ tone: 'error', message })
        return
      }

      const json = (await response.json()) as { refund?: { executed?: boolean } }
      const refundNote = json.refund?.executed ? ' Paystack refund submitted.' : ''
      onFeedback({
        tone: 'success',
        message: `Membership updated (${pendingAction.replace(/_/g, ' ')}).${refundNote}`,
      })
      setPendingAction(null)
      setPaystackOverride('')
      await onUpdated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-violet-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-violet-600 text-white flex items-center justify-center">
            {isDiamond ? <Gem size={16} /> : <Sparkles size={16} />}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">Membership</p>
            <p className="text-sm font-black text-gray-900">{formatPlanLabel(plan, profile?.is_seller)}</p>
          </div>
        </div>
        <StatusBadge
          label={isDiamond ? 'Diamond active' : status === 'expired' ? 'Expired' : 'Standard / none'}
          tone={isDiamond ? 'success' : status === 'expired' ? 'warning' : 'neutral'}
        />
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-white/80 border border-violet-100 p-3">
            <p className="text-[9px] font-bold uppercase text-gray-400">Expiry</p>
            <p className="text-xs font-bold text-gray-900 mt-1 flex items-center gap-1">
              <CalendarClock size={12} className="text-violet-500" />
              {expiry ? new Date(expiry).toLocaleString() : 'No expiry (Standard)'}
            </p>
          </div>
          <div className="rounded-lg bg-white/80 border border-violet-100 p-3">
            <p className="text-[9px] font-bold uppercase text-gray-400">Time left</p>
            <p className="text-xs font-bold text-gray-900 mt-1">
              {daysLeft != null ? `${daysLeft} day(s)` : '—'}
            </p>
          </div>
        </div>

        {latestPayment ? (
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-[9px] font-bold uppercase text-gray-400 mb-2 flex items-center gap-1">
              <CreditCard size={11} /> Latest subscription payment
            </p>
            <p className="text-xs font-bold text-gray-900">
              {profile?.currency_code || 'NGN'} {Number(latestPayment.amount).toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">
              {new Date(latestPayment.created_at).toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-400 mt-1 break-all">{latestPayment.description}</p>
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">No subscription payments logged yet.</p>
        )}

        {canManage ? (
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Operator actions</p>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                icon={Gem}
                label="Grant Diamond"
                hint="1–36 months"
                onClick={() => { setMonths(1); setPendingAction('grant_diamond') }}
              />
              <ActionButton
                icon={RefreshCw}
                label="Extend"
                hint="Add months"
                onClick={() => { setMonths(1); setPendingAction('extend_diamond') }}
              />
              <ActionButton
                icon={Shield}
                label="Downgrade"
                hint="Standard / none"
                onClick={() => setPendingAction('downgrade_standard')}
              />
              <ActionButton
                icon={Undo2}
                label="Expire now"
                hint="No refund"
                onClick={() => setPendingAction('cancel_diamond')}
              />
            </div>
            <button
              type="button"
              onClick={() => setPendingAction('refund_and_revoke')}
              className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left hover:bg-amber-100 transition"
            >
              <p className="text-xs font-bold text-amber-900">Refund & revoke Diamond</p>
              <p className="text-[10px] text-amber-700 mt-0.5">Paystack refund + immediate expiry</p>
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            Finance or Super Admin role required to change membership.
          </p>
        )}
      </div>

      <ActionReasonModal
        open={pendingAction !== null}
        title={actionCopy?.title ?? 'Update membership'}
        description={actionCopy?.description ?? ''}
        impactSummary={actionCopy?.impact}
        extraFields={
          actionCopy ? (
            <div className="space-y-3">
              {actionCopy.needsMonths && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                    Months
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={36}
                    value={months}
                    onChange={(e) => setMonths(Math.max(1, Math.min(36, Number(e.target.value) || 1)))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              )}
              {pendingAction === 'refund_and_revoke' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                    Paystack reference override (optional)
                  </label>
                  <input
                    type="text"
                    value={paystackOverride}
                    onChange={(e) => setPaystackOverride(e.target.value)}
                    placeholder="Uses latest SUBSCRIPTION_UPGRADE if empty"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              )}
            </div>
          ) : undefined
        }
        categoryOptions={CATEGORY_OPTIONS}
        submitting={submitting}
        onClose={() => {
          if (submitting) return
          setPendingAction(null)
          setPaystackOverride('')
        }}
        onSubmit={submitAction}
      />
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof Gem
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-violet-100 bg-white px-3 py-2.5 text-left hover:border-violet-300 hover:bg-violet-50/50 transition"
    >
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-violet-600" />
        <p className="text-xs font-bold text-gray-900">{label}</p>
      </div>
      <p className="text-[10px] text-gray-500 mt-1">{hint}</p>
    </button>
  )
}
