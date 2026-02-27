'use client'

type ConfirmActionModalProps = {
  open: boolean
  title: string
  description: string
  /** Impact preview (e.g. "This user will lose access immediately.") */
  impactSummary?: string
  /** Red/danger styling for high-risk actions */
  danger?: boolean
  confirmLabel?: string
  submitting?: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  /** Optional custom content (e.g. broadcast preview) */
  children?: React.ReactNode
}

export function ConfirmActionModal({
  open,
  title,
  description,
  impactSummary,
  danger = false,
  confirmLabel = 'Confirm',
  submitting = false,
  onClose,
  onConfirm,
  children,
}: ConfirmActionModalProps) {
  if (!open) return null

  const handleConfirm = () => {
    void Promise.resolve(onConfirm())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
          {impactSummary && (
            <p
              className={`mt-2 rounded-lg border px-3 py-2 text-sm ${
                danger
                  ? 'bg-red-50 border-red-100 text-red-800'
                  : 'bg-amber-50 border-amber-100 text-amber-800'
              }`}
            >
              {impactSummary}
            </p>
          )}
          {children}
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
            disabled={submitting}
            onClick={handleConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-900 hover:bg-black'
            }`}
          >
            {submitting ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
