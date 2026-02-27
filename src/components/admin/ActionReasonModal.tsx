'use client'

import { useEffect, useMemo, useState } from 'react'

type ActionReasonModalProps = {
  open: boolean
  title: string
  description: string
  /** Short impact preview shown below description (e.g. "Funds will be released to seller.") */
  impactSummary?: string
  categoryOptions: { value: string; label: string }[]
  submitting?: boolean
  onClose: () => void
  onSubmit: (payload: { category: string; reason: string }) => Promise<void> | void
}

export function ActionReasonModal({
  open,
  title,
  description,
  impactSummary,
  categoryOptions,
  submitting = false,
  onClose,
  onSubmit,
}: ActionReasonModalProps) {
  const defaultCategory = useMemo(() => categoryOptions[0]?.value ?? '', [categoryOptions])
  const [category, setCategory] = useState(defaultCategory)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    setCategory(defaultCategory)
    setReason('')
  }, [open, defaultCategory])

  if (!open) return null

  const canSubmit = category.length > 0 && reason.trim().length >= 10 && !submitting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
          {impactSummary && (
            <p className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-800">
              {impactSummary}
            </p>
          )}
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
              Reason category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
              Operator note
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Explain why this action is needed..."
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-right text-[10px] text-gray-400">{reason.trim().length}/500</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit({ category, reason: reason.trim() })}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Confirm Action'}
          </button>
        </div>
      </div>
    </div>
  )
}
