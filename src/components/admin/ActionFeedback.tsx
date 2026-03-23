'use client'

import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

type FeedbackTone = 'success' | 'error' | 'info'

export function ActionFeedback({
  tone,
  message,
}: {
  tone: FeedbackTone
  message: string
}) {
  const palette =
    tone === 'success'
      ? { backgroundColor: 'var(--success-bg)', borderColor: 'var(--success)', color: 'var(--success)' }
      : tone === 'error'
        ? { backgroundColor: 'var(--danger-bg)', borderColor: 'var(--danger)', color: 'var(--danger)' }
        : { backgroundColor: '#dbeafe', borderColor: 'var(--primary)', color: 'var(--primary)' }

  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertCircle : Info

  return (
    <div className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm" style={palette}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
