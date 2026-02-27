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
  const styles =
    tone === 'success'
      ? 'bg-green-50 border-green-100 text-green-700'
      : tone === 'error'
        ? 'bg-red-50 border-red-100 text-red-700'
        : 'bg-blue-50 border-blue-100 text-blue-700'

  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertCircle : Info

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
