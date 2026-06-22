'use client'

import { useMemo, useState } from 'react'
import { Coins, Minus, Plus, TrendingDown, TrendingUp } from 'lucide-react'
import { ActionReasonModal } from './ActionReasonModal'
import { StatusBadge } from './StatusBadge'
import { parseApiError } from '../../utils/http'

type CoinLedgerRow = {
  id: string
  amount: number
  type: string
  description: string | null
  created_at: string
}

type CoinDirection = 'credit' | 'debit'

type UserCoinsPanelProps = {
  userId: string
  coinBalance: number
  ledger: CoinLedgerRow[]
  canManage: boolean
  onUpdated: () => Promise<void> | void
  onFeedback: (payload: { tone: 'success' | 'error' | 'info'; message: string }) => void
}

const CREDIT_CATEGORIES = [
  { value: 'refund_goodwill', label: 'Refund / goodwill' },
  { value: 'fraud_reversal', label: 'Fraud reversal' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'billing_error', label: 'Billing error' },
  { value: 'support_resolution', label: 'Support resolution' },
  { value: 'compensation', label: 'Compensation' },
  { value: 'other', label: 'Other' },
]

const DEBIT_CATEGORIES = [
  { value: 'fraud_clawback', label: 'Fraud clawback' },
  { value: 'billing_error', label: 'Billing error' },
  { value: 'policy_violation', label: 'Policy violation' },
  { value: 'duplicate_credit', label: 'Duplicate credit reversal' },
  { value: 'customer_request', label: 'Customer request' },
  { value: 'operations_error', label: 'Operations error' },
  { value: 'other', label: 'Other' },
]

function formatLedgerType(type: string) {
  const t = (type || '').toUpperCase()
  if (t === 'ADMIN_ADJUSTMENT') return 'Admin credit'
  if (t === 'ADMIN_DEBIT') return 'Admin debit'
  if (t === 'SPEND' || t === 'REDEMPTION') return 'Spent'
  if (t === 'REFUND') return 'Refunded'
  if (t === 'FOUNDER_SIGNUP_GIFT') return 'Founder gift'
  if (t.startsWith('REFERRAL')) return 'Referral'
  if (t === 'EARNED' || t === 'EARN') return 'Earned'
  return t.replace(/_/g, ' ').toLowerCase()
}

function ledgerSign(type: string) {
  const t = (type || '').toUpperCase()
  if (['SPEND', 'REDEMPTION', 'ADMIN_DEBIT'].includes(t)) return '-'
  return '+'
}

export function UserCoinsPanel({
  userId,
  coinBalance,
  ledger,
  canManage,
  onUpdated,
  onFeedback,
}: UserCoinsPanelProps) {
  const [pendingDirection, setPendingDirection] = useState<CoinDirection | null>(null)
  const [amount, setAmount] = useState(100)
  const [submitting, setSubmitting] = useState(false)

  const actionCopy = useMemo(() => {
    if (pendingDirection === 'credit') {
      return {
        title: 'Credit Store Coins',
        description: 'Add coins to this user’s wallet. A ledger row is created and balance updates immediately.',
        impact: `Balance will increase by ${amount.toLocaleString()} coin(s). New balance: ${(coinBalance + amount).toLocaleString()}.`,
        categories: CREDIT_CATEGORIES,
      }
    }
    if (pendingDirection === 'debit') {
      return {
        title: 'Debit Store Coins',
        description: 'Remove coins from this user’s wallet. Fails if balance is insufficient.',
        impact: `Balance will decrease by ${amount.toLocaleString()} coin(s). New balance: ${Math.max(0, coinBalance - amount).toLocaleString()}.`,
        categories: DEBIT_CATEGORIES,
      }
    }
    return null
  }, [pendingDirection, amount, coinBalance])

  const submitAction = async (payload: { category: string; reason: string }) => {
    if (!pendingDirection) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/users/coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          userId,
          direction: pendingDirection,
          amount,
          reasonCategory: payload.category,
          reason: payload.reason.trim(),
        }),
      })

      if (!response.ok) {
        const message = await parseApiError(response, 'Coin adjustment failed.')
        onFeedback({ tone: 'error', message })
        return
      }

      onFeedback({
        tone: 'success',
        message: `${pendingDirection === 'credit' ? 'Credited' : 'Debited'} ${amount.toLocaleString()} coin(s).`,
      })
      setPendingDirection(null)
      await onUpdated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
            <Coins size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Store Coins</p>
            <p className="text-sm font-black text-gray-900">{coinBalance.toLocaleString()} coins</p>
          </div>
        </div>
        <StatusBadge label="Loyalty wallet" tone="warning" />
      </div>

      <div className="p-4 space-y-4">
        {ledger.length > 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2 max-h-40 overflow-y-auto">
            <p className="text-[9px] font-bold uppercase text-gray-400">Recent ledger</p>
            {ledger.map((row) => (
              <div key={row.id} className="flex items-start justify-between gap-2 text-[10px] border-b border-gray-50 pb-1.5 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-bold text-gray-800">{formatLedgerType(row.type)}</p>
                  <p className="text-gray-400 truncate">{row.description || '—'}</p>
                  <p className="text-gray-300">{new Date(row.created_at).toLocaleString()}</p>
                </div>
                <p className={`font-black shrink-0 ${ledgerSign(row.type) === '-' ? 'text-red-600' : 'text-emerald-600'}`}>
                  {ledgerSign(row.type)}{Number(row.amount).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">No coin ledger activity yet.</p>
        )}

        {canManage ? (
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Operator actions</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setAmount(100); setPendingDirection('credit') }}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-left hover:bg-emerald-100 transition"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-emerald-600" />
                  <p className="text-xs font-bold text-gray-900">Credit coins</p>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">Goodwill, promo, reversal</p>
              </button>
              <button
                type="button"
                onClick={() => { setAmount(100); setPendingDirection('debit') }}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-left hover:bg-red-100 transition"
              >
                <div className="flex items-center gap-2">
                  <TrendingDown size={14} className="text-red-600" />
                  <p className="text-xs font-bold text-gray-900">Debit coins</p>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">Clawback, correction</p>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            Finance, Support, or Super Admin role required to adjust coins.
          </p>
        )}
      </div>

      <ActionReasonModal
        open={pendingDirection !== null}
        title={actionCopy?.title ?? 'Adjust coins'}
        description={actionCopy?.description ?? ''}
        impactSummary={actionCopy?.impact}
        extraFields={
          actionCopy ? (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                Amount (coins)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAmount((v) => Math.max(1, v - 50))}
                  className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50"
                  aria-label="Decrease amount"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min={1}
                  max={1_000_000}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(1, Math.min(1_000_000, Math.floor(Number(e.target.value) || 1))))}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setAmount((v) => Math.min(1_000_000, v + 50))}
                  className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50"
                  aria-label="Increase amount"
                >
                  <Plus size={14} />
                </button>
              </div>
              <p className="mt-1 text-[10px] text-gray-400">1 – 1,000,000 per action</p>
            </div>
          ) : undefined
        }
        categoryOptions={actionCopy?.categories ?? CREDIT_CATEGORIES}
        submitting={submitting}
        onClose={() => {
          if (submitting) return
          setPendingDirection(null)
        }}
        onSubmit={submitAction}
      />
    </div>
  )
}
