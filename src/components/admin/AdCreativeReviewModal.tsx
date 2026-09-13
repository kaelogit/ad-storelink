'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'

const POLICY_CHECKS = [
  { id: 'identity', label: 'Seller/store clearly identifiable' },
  { id: 'claims', label: 'No misleading price or availability claims' },
  { id: 'prohibited', label: 'No prohibited / adult / scam content' },
  { id: 'creative', label: 'Creative quality acceptable for feed' },
  { id: 'landing', label: 'Deeplink / product / reel lands correctly' },
] as const

type CreativeRow = {
  id: string
  name: string
  status: string
  creative_type: string
  image_url?: string | null
  headline?: string | null
  deeplink?: string | null
  seller_display_name?: string | null
  seller_slug?: string | null
  placements?: string[] | null
  rejection_reason?: string | null
}

type Props = {
  open: boolean
  row: CreativeRow | null
  canWrite: boolean
  onClose: () => void
  onApprove: () => void
  onReject: () => void
}

export function AdCreativeReviewModal({
  open,
  row,
  canWrite,
  onClose,
  onApprove,
  onReject,
}: Props) {
  const [checks, setChecks] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open) return
    setChecks({})
  }, [open, row?.id])

  const allChecked = useMemo(
    () => POLICY_CHECKS.every((c) => checks[c.id]),
    [checks],
  )

  if (!open || !row) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Creative review</h2>
            <p className="text-xs text-gray-500">
              {row.name} · {row.seller_slug ? `@${row.seller_slug}` : row.seller_display_name || 'Seller'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <div>
            {row.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.image_url} alt="" className="w-full rounded-lg object-cover" />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg bg-zinc-100 text-sm text-zinc-500">
                No image preview ({row.creative_type})
              </div>
            )}
            <div className="mt-3 space-y-1 text-sm">
              <p>
                <span className="font-semibold">Type:</span> {row.creative_type}
              </p>
              {row.headline ? (
                <p>
                  <span className="font-semibold">Headline:</span> {row.headline}
                </p>
              ) : null}
              {row.deeplink ? (
                <p className="truncate font-mono text-xs text-zinc-500">{row.deeplink}</p>
              ) : null}
              <p className="text-xs text-zinc-500">
                Placements: {(row.placements || []).join(', ') || '—'}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              Policy checklist
            </p>
            <ul className="space-y-2">
              {POLICY_CHECKS.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={!!checks[c.id]}
                      onChange={(e) =>
                        setChecks((prev) => ({ ...prev, [c.id]: e.target.checked }))
                      }
                    />
                    <span>{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-gray-500">
              Approve unlocks when all checks are marked. Reject always available with reason.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Close
          </button>
          {canWrite && row.status === 'pending_review' ? (
            <>
              <button
                type="button"
                onClick={onReject}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
              >
                Reject…
              </button>
              <button
                type="button"
                disabled={!allChecked}
                onClick={onApprove}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Approve
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
