'use client'

import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { ActionReasonModal } from './ActionReasonModal'
import { parseApiError } from '../../utils/http'

type GateConfig = {
  ivt_enabled?: boolean
  ivt_auto_credit?: boolean
  ivt_window_minutes?: number
  ivt_min_spike_impressions?: number
  conversion_window_hours?: number
  min_visible_ms?: number
}

type Props = {
  canEdit: boolean
  onUpdated?: () => void
}

export function AdsConfigEditor({ canEdit, onUpdated }: Props) {
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<GateConfig>({})
  const [enabled, setEnabled] = useState(false)
  const [rollout, setRollout] = useState(0)
  const [openConfirm, setOpenConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/feature-flags/list?q=ads_enabled')
    if (!res.ok) {
      setMessage(await parseApiError(res, 'Could not load ads config.'))
      setLoading(false)
      return
    }
    const data = await res.json()
    const row = (Array.isArray(data.flags) ? data.flags : []).find(
      (f: { key?: string }) => f.key === 'ads_enabled',
    )
    const cfg = (row?.config ?? {}) as GateConfig
    setDraft({
      ivt_enabled: cfg.ivt_enabled !== false,
      ivt_auto_credit: Boolean(cfg.ivt_auto_credit),
      ivt_window_minutes: Number(cfg.ivt_window_minutes ?? 15),
      ivt_min_spike_impressions: Number(cfg.ivt_min_spike_impressions ?? 40),
      conversion_window_hours: Number(cfg.conversion_window_hours ?? 24),
      min_visible_ms: Number(cfg.min_visible_ms ?? 1000),
    })
    setEnabled(Boolean(row?.enabled))
    setRollout(Number(row?.rollout_percent ?? 0))
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const submit = async (payload: { category: string; reason: string }) => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/feature-flags/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          key: 'ads_enabled',
          enabled,
          rolloutPercent: rollout,
          reason: `[${payload.category}] ${payload.reason.trim()}`,
          configPatch: draft,
        }),
      })
      if (!res.ok) {
        setMessage(await parseApiError(res, 'Config update failed.'))
        return
      }
      setMessage('Ads delivery config updated and audited.')
      setOpenConfirm(false)
      await load()
      onUpdated?.()
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-xs text-zinc-500">
        Loading ads delivery config…
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-zinc-600" />
        <h3 className="text-sm font-semibold text-zinc-900">Delivery config (`ads_enabled.config`)</h3>
      </div>
      {message ? <p className="mb-2 text-xs text-zinc-600">{message}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={!!draft.ivt_enabled}
            onChange={(e) => setDraft((d) => ({ ...d, ivt_enabled: e.target.checked }))}
          />
          IVT monitor enabled
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={!!draft.ivt_auto_credit}
            onChange={(e) => setDraft((d) => ({ ...d, ivt_auto_credit: e.target.checked }))}
          />
          IVT auto-credit unused
        </label>
        <label className="text-xs text-zinc-600">
          IVT window (min)
          <input
            type="number"
            disabled={!canEdit}
            min={5}
            value={draft.ivt_window_minutes ?? 15}
            onChange={(e) =>
              setDraft((d) => ({ ...d, ivt_window_minutes: Number(e.target.value) }))
            }
            className="mt-1 w-full rounded border border-zinc-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-zinc-600">
          IVT min spike impressions
          <input
            type="number"
            disabled={!canEdit}
            min={10}
            value={draft.ivt_min_spike_impressions ?? 40}
            onChange={(e) =>
              setDraft((d) => ({ ...d, ivt_min_spike_impressions: Number(e.target.value) }))
            }
            className="mt-1 w-full rounded border border-zinc-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-zinc-600">
          Conversion window (hours)
          <input
            type="number"
            disabled={!canEdit}
            min={1}
            value={draft.conversion_window_hours ?? 24}
            onChange={(e) =>
              setDraft((d) => ({ ...d, conversion_window_hours: Number(e.target.value) }))
            }
            className="mt-1 w-full rounded border border-zinc-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-zinc-600">
          Min visible ms
          <input
            type="number"
            disabled={!canEdit}
            min={100}
            value={draft.min_visible_ms ?? 1000}
            onChange={(e) => setDraft((d) => ({ ...d, min_visible_ms: Number(e.target.value) }))}
            className="mt-1 w-full rounded border border-zinc-200 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      {canEdit ? (
        <button
          type="button"
          onClick={() => setOpenConfirm(true)}
          className="mt-3 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
        >
          Save config
        </button>
      ) : (
        <p className="mt-2 text-[11px] text-zinc-500">Super Admin required to edit config.</p>
      )}
      <p className="mt-2 text-[11px] text-zinc-400">
        Current flag: {enabled ? `on @ ${rollout}%` : 'off'} · patch merges into existing JSON.
      </p>

      <ActionReasonModal
        open={openConfirm}
        title="Update ads delivery config"
        description="Writes a configPatch into feature_flags.ads_enabled and audits the change."
        impactSummary={`ivt_enabled=${draft.ivt_enabled}, ivt_auto_credit=${draft.ivt_auto_credit}, window=${draft.ivt_window_minutes}m`}
        categoryOptions={[
          { value: 'tuning', label: 'Delivery tuning' },
          { value: 'incident', label: 'Incident response' },
          { value: 'policy', label: 'Policy' },
        ]}
        submitting={busy}
        onClose={() => setOpenConfirm(false)}
        onSubmit={submit}
      />
    </div>
  )
}
