'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Phone, RefreshCcw, ShieldCheck } from 'lucide-react'
import { ActionReasonModal } from './ActionReasonModal'
import { StatusBadge } from './StatusBadge'
import { parseApiError } from '../../utils/http'

type OtpEvent = {
  id: string
  event_type: string
  phone_e164?: string | null
  message?: string | null
  termii_status?: number | null
  created_at?: string
}

export type PhoneVerificationStatus = {
  user_id: string
  phone_number?: string | null
  phone_verified?: boolean
  phone_verified_at?: string | null
  active_otp?: {
    phone_e164?: string
    last_sent_at?: string
    expires_at?: string
    is_expired?: boolean
  } | null
  last_otp_attempt_at?: string | null
  failure_count_7d?: number
  recent_events?: OtpEvent[]
}

type UserPhoneVerificationPanelProps = {
  userId: string
  status: PhoneVerificationStatus | null
  canManage: boolean
  onUpdated: () => Promise<void> | void
  onFeedback: (payload: { tone: 'success' | 'error' | 'info'; message: string }) => void
}

const REASON_CATEGORIES = [
  { value: 'customer_request', label: 'Customer request' },
  { value: 'number_change', label: 'Number change / wrong phone' },
  { value: 'termii_failure', label: 'Termii / SMS failure' },
  { value: 'account_recovery', label: 'Account recovery' },
  { value: 'fraud_investigation', label: 'Fraud investigation' },
  { value: 'support_resolution', label: 'Support resolution' },
  { value: 'other', label: 'Other' },
]

function formatEventType(type: string) {
  const t = (type || '').toLowerCase()
  if (t === 'send_success') return 'SMS sent'
  if (t === 'send_fail') return 'SMS failed'
  if (t === 'verify_success') return 'Code verified'
  if (t === 'verify_fail') return 'Code failed'
  if (t === 'admin_reset') return 'Admin reset'
  return t.replace(/_/g, ' ')
}

function eventTone(type: string): 'success' | 'danger' | 'warning' | 'neutral' | 'info' {
  const t = (type || '').toLowerCase()
  if (t.endsWith('_success')) return 'success'
  if (t.endsWith('_fail')) return 'danger'
  if (t === 'admin_reset') return 'warning'
  return 'neutral'
}

export function UserPhoneVerificationPanel({
  userId,
  status,
  canManage,
  onUpdated,
  onFeedback,
}: UserPhoneVerificationPanelProps) {
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetIdempotencyKey, setResetIdempotencyKey] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const failures = useMemo(
    () => (status?.recent_events ?? []).filter((e) => ['send_fail', 'verify_fail'].includes(e.event_type)),
    [status?.recent_events],
  )

  if (!status) return null

  const verified = Boolean(status.phone_verified)
  const canReset = verified || Boolean(status.active_otp)

  const submitReset = async ({ category, reason }: { category: string; reason: string }) => {
    setSubmitting(true)
    onFeedback({ tone: 'info', message: 'Resetting phone verification...' })
    const response = await fetch('/api/admin/users/phone-verification/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': resetIdempotencyKey,
      },
      body: JSON.stringify({
        userId,
        reasonCategory: category,
        reason,
      }),
    })
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to reset phone verification.')
      onFeedback({ tone: 'error', message: msg })
      setSubmitting(false)
      return
    }
    setShowResetModal(false)
    setSubmitting(false)
    onFeedback({
      tone: 'success',
      message: 'Phone verification reset. User must verify again before sensitive actions.',
    })
    await onUpdated()
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-blue-50 overflow-hidden">
      <div className="border-b border-sky-100 bg-sky-50/80 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-sky-700" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-sky-900">Phone verification (Termii)</h4>
        </div>
        {verified ? (
          <StatusBadge tone="success" label="Verified" />
        ) : (
          <StatusBadge tone="warning" label="Not verified" />
        )}
      </div>

      <div className="p-4 space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-gray-400">Phone on profile</p>
            <p className="font-mono font-bold text-gray-900">{status.phone_number || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-gray-400">Verified at</p>
            <p className="font-semibold text-gray-900">
              {status.phone_verified_at ? new Date(status.phone_verified_at).toLocaleString() : '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-gray-400">Last OTP attempt</p>
            <p className="font-semibold text-gray-900">
              {status.last_otp_attempt_at
                ? new Date(status.last_otp_attempt_at).toLocaleString()
                : status.active_otp?.last_sent_at
                  ? new Date(status.active_otp.last_sent_at).toLocaleString()
                  : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-gray-400">Termii failures (7d)</p>
            <p className={`font-black ${(status.failure_count_7d ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {status.failure_count_7d ?? 0}
            </p>
          </div>
        </div>

        {status.active_otp ? (
          <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-900">
            <p className="font-bold flex items-center gap-1">
              <RefreshCcw className="h-3.5 w-3.5" />
              Pending OTP for {status.active_otp.phone_e164}
            </p>
            <p className="mt-1 text-amber-800/90">
              Sent {status.active_otp.last_sent_at ? new Date(status.active_otp.last_sent_at).toLocaleString() : '—'}
              {status.active_otp.is_expired ? ' · expired' : status.active_otp.expires_at ? ` · expires ${new Date(status.active_otp.expires_at).toLocaleString()}` : ''}
            </p>
          </div>
        ) : null}

        {(status.recent_events?.length ?? 0) > 0 ? (
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-400 mb-2">Recent OTP events</p>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-100 bg-white divide-y divide-gray-50">
              {(status.recent_events ?? []).slice(0, 8).map((event) => (
                <div key={event.id} className="px-3 py-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">{formatEventType(event.event_type)}</p>
                    {event.message ? <p className="text-[10px] text-gray-500 line-clamp-2">{event.message}</p> : null}
                    {event.phone_e164 ? (
                      <p className="text-[10px] font-mono text-gray-400">{event.phone_e164}</p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge tone={eventTone(event.event_type)} label={event.event_type.split('_')[1] || 'evt'} />
                    <p className="text-[9px] text-gray-400 mt-1">
                      {event.created_at ? new Date(event.created_at).toLocaleString() : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-gray-500 italic">No OTP attempt events logged yet.</p>
        )}

        {failures.length > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Latest failure: {failures[0].message || formatEventType(failures[0].event_type)}
              {failures[0].termii_status ? ` (HTTP ${failures[0].termii_status})` : ''}
            </p>
          </div>
        ) : null}

        {canManage && canReset ? (
          <button
            type="button"
            onClick={() => {
              setResetIdempotencyKey(`phone-verify-reset-${userId}-${Date.now()}`)
              setShowResetModal(true)
            }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
          >
            <ShieldCheck className="h-4 w-4" />
            Reset verification
          </button>
        ) : null}

        {!verified ? (
          <p className="text-[10px] text-gray-500 leading-relaxed">
            User must complete SMS verification again before onboarding checkout flows and phone-sensitive settings.
          </p>
        ) : null}
      </div>

      <ActionReasonModal
        open={showResetModal}
        title="Reset phone verification?"
        description="Clears verified status and any pending OTP. The user keeps their phone number but must verify again."
        impactSummary="Forces re-verification on next sensitive action (onboarding, phone change). Action is audit-logged."
        categoryOptions={REASON_CATEGORIES}
        submitting={submitting}
        onClose={() => setShowResetModal(false)}
        onSubmit={submitReset}
      />
    </div>
  )
}
