'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, ExternalLink, Loader2 } from 'lucide-react'
import { parseApiError } from '../../utils/http'

type MarkOrderPaidInlineProps = {
  orderId: string
  suggestedReference?: string | null
  compact?: boolean
  onSuccess?: () => void
}

export function MarkOrderPaidInline({
  orderId,
  suggestedReference,
  compact = false,
  onSuccess,
}: MarkOrderPaidInlineProps) {
  const [reference, setReference] = useState(suggestedReference?.trim() ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const submit = async () => {
    const ref = reference.trim()
    if (!ref) return
    setLoading(true)
    setError(null)
    setSuccess(false)

    const response = await fetch('/api/admin/orders/mark-paid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `mark-paid-${orderId}-${ref}`,
      },
      body: JSON.stringify({ orderId, paymentReference: ref }),
    })

    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to mark order as paid.')
      setError(msg)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    onSuccess?.()
  }

  if (success) {
    return (
      <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700">
        <CheckCircle className="h-3.5 w-3.5" />
        Marked PAID
      </p>
    )
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'mt-2'}`}>
      <input
        type="text"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="Paystack reference"
        className={`rounded-lg border border-gray-200 bg-white font-mono text-gray-900 ${compact ? 'px-2 py-1 text-[10px] w-36' : 'px-2.5 py-1.5 text-xs w-44'}`}
      />
      <button
        type="button"
        disabled={!reference.trim() || loading}
        onClick={() => void submit()}
        className={`inline-flex items-center gap-1 rounded-lg bg-amber-900 font-bold text-white hover:bg-amber-950 disabled:opacity-50 ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'}`}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Mark paid
      </button>
      <Link
        href={`/dashboard/orders?q=${encodeURIComponent(orderId)}`}
        className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        Transaction Ops
      </Link>
      {error ? <p className="w-full text-[10px] font-semibold text-red-700">{error}</p> : null}
    </div>
  )
}
