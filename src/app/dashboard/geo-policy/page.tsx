'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Globe, Info, Loader2, Plus, RefreshCcw, Trash2 } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { parseApiError } from '../../../utils/http'
import { createClient } from '../../../utils/supabase/client'
import { SUPPORTED_COUNTRIES } from '../../../constants/SupportedCountries'
import type { AdminRole } from '../../../types/admin'

type GeoConfig = {
  mode?: 'strict_same_country' | 'allow_pairs' | 'open'
  allowed_pairs?: Array<{ viewer: string; seller: string }>
  block_surfaces?: Record<string, boolean>
  message_title?: string | null
  message_body?: string | null
  notes?: string | null
  updated_at?: string
}

type EffectivePolicy = {
  description?: string
  surfaces?: Array<{ key: string; label: string; mobile?: string }>
  deployNote?: string
}

const MARKET_COUNTRIES = SUPPORTED_COUNTRIES.filter((c) => c.code !== 'ALL')

const MODE_OPTIONS = [
  { value: 'strict_same_country', label: 'Strict same country', description: 'Block when viewer ISO ≠ seller ISO (current default).' },
  { value: 'allow_pairs', label: 'Allow selected pairs', description: 'Block cross-country unless viewer→seller pair is whitelisted.' },
  { value: 'open', label: 'Open', description: 'No cross-country blocks (surface toggles still apply if re-enabled).' },
] as const

const SURFACE_OPTIONS = [
  { key: 'app_deep_link', label: 'App deep links', help: 'RegionBlockedScreen on product, reel, and store routes.' },
  { key: 'checkout', label: 'Checkout / orders', help: 'orders INSERT trigger rejects mismatched countries.' },
  { key: 'chat', label: 'Chat initiation', help: 'Reserved for future chat guard.' },
  { key: 'discovery', label: 'Discovery feeds', help: 'Explore/Discover RPC country filters.' },
] as const

const REASON_CATEGORIES = [
  { value: 'policy_change', label: 'Policy change' },
  { value: 'market_launch', label: 'Market launch' },
  { value: 'support_escalation', label: 'Support escalation' },
  { value: 'other', label: 'Other' },
]

export default function GeoPolicyPage() {
  const supabase = createClient()
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null)
  const [config, setConfig] = useState<GeoConfig | null>(null)
  const [effectivePolicy, setEffectivePolicy] = useState<EffectivePolicy | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pendingSave, setPendingSave] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)

  const [modeDraft, setModeDraft] = useState<'strict_same_country' | 'allow_pairs' | 'open'>('strict_same_country')
  const [pairsDraft, setPairsDraft] = useState<Array<{ viewer: string; seller: string }>>([])
  const [surfacesDraft, setSurfacesDraft] = useState<Record<string, boolean>>({
    app_deep_link: true,
    checkout: true,
    chat: false,
    discovery: true,
  })
  const [titleDraft, setTitleDraft] = useState('')
  const [bodyDraft, setBodyDraft] = useState('')
  const [notesDraft, setNotesDraft] = useState('')

  const canEdit = adminRole === 'super_admin'

  useEffect(() => {
    let mounted = true
    const loadRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return
      const { data } = await supabase.from('admin_users').select('role').eq('id', user.id).maybeSingle()
      if (mounted && data?.role) setAdminRole(data.role as AdminRole)
    }
    void loadRole()
    return () => { mounted = false }
  }, [supabase])

  const applyConfigToDraft = useCallback((next: GeoConfig | null) => {
    setConfig(next)
    setModeDraft(next?.mode ?? 'strict_same_country')
    setPairsDraft(Array.isArray(next?.allowed_pairs) ? next.allowed_pairs : [])
    setSurfacesDraft({
      app_deep_link: next?.block_surfaces?.app_deep_link ?? true,
      checkout: next?.block_surfaces?.checkout ?? true,
      chat: next?.block_surfaces?.chat ?? false,
      discovery: next?.block_surfaces?.discovery ?? true,
    })
    setTitleDraft(next?.message_title ?? '')
    setBodyDraft(next?.message_body ?? '')
    setNotesDraft(next?.notes ?? '')
  }, [])

  const loadConfig = useCallback(async () => {
    setLoading(true)
    const response = await fetch('/api/admin/geo-policy/config')
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load geo policy.')
      setFeedback({ tone: 'error', message: msg })
      applyConfigToDraft(null)
      setEffectivePolicy(null)
      setLoading(false)
      return
    }
    const payload = (await response.json()) as { config?: GeoConfig; effectivePolicy?: EffectivePolicy }
    applyConfigToDraft(payload.config ?? null)
    setEffectivePolicy(payload.effectivePolicy ?? null)
    setLoading(false)
  }, [applyConfigToDraft])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const dirty = useMemo(() => {
    if (!config) return false
    const pairsEqual =
      JSON.stringify(pairsDraft) === JSON.stringify(config.allowed_pairs ?? [])
    const surfacesEqual =
      JSON.stringify(surfacesDraft) === JSON.stringify(config.block_surfaces ?? {})
    return (
      modeDraft !== (config.mode ?? 'strict_same_country')
      || !pairsEqual
      || !surfacesEqual
      || titleDraft !== (config.message_title ?? '')
      || bodyDraft !== (config.message_body ?? '')
      || notesDraft !== (config.notes ?? '')
    )
  }, [bodyDraft, config, modeDraft, notesDraft, pairsDraft, surfacesDraft, titleDraft])

  const submitUpdate = async ({ category, reason }: { category: string; reason: string }) => {
    setSubmitting(true)
    const response = await fetch('/api/admin/geo-policy/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `geo-policy-${Date.now()}`,
      },
      body: JSON.stringify({
        mode: modeDraft,
        allowedPairs: pairsDraft,
        blockSurfaces: surfacesDraft,
        messageTitle: titleDraft || null,
        messageBody: bodyDraft || null,
        notes: notesDraft || null,
        reason: `[${category}] ${reason}`,
      }),
    })
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to update geo policy.')
      setFeedback({ tone: 'error', message: msg })
      setSubmitting(false)
      return
    }
    setPendingSave(false)
    setSubmitting(false)
    setFeedback({ tone: 'success', message: 'Geo visibility policy updated. Mobile clients pick this up within ~10 minutes.' })
    await loadConfig()
  }

  const addPair = () => {
    setPairsDraft((prev) => [...prev, { viewer: 'NG', seller: 'GH' }])
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Geo Visibility Policy"
        subtitle="Configure cross-country visibility rules for mobile deep links, checkout, chat, and discovery."
        actions={
          <DeskLinkPills
            links={[
              { href: '/dashboard/legal-policy', label: 'Legal & Policy' },
              { href: '/dashboard/onboarding', label: 'Onboarding' },
              { href: '/dashboard/users', label: 'Users' },
            ]}
          />
        }
      />

      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div className="space-y-2 text-xs text-blue-900">
            <p className="font-bold">Effective policy</p>
            <p>{effectivePolicy?.description ?? 'Cross-country rules apply when viewer and seller ISO codes differ.'}</p>
            <ul className="list-inside list-disc space-y-0.5">
              {(effectivePolicy?.surfaces ?? SURFACE_OPTIONS).map((surface) => (
                <li key={surface.key}>
                  <span className="font-semibold">{surface.label}</span>
                  {' — '}
                  {surface.mobile ?? SURFACE_OPTIONS.find((s) => s.key === surface.key)?.help}
                </li>
              ))}
            </ul>
            <p>{effectivePolicy?.deployNote ?? 'Policy changes apply at runtime via get_geo_visibility_config (no app deploy required after client helper ships).'}</p>
            <p className="border-t border-blue-200 pt-2 font-semibold">
              Launched markets: NG, GH, KE, ZA — each is a separate marketplace. Ghana users cannot browse Nigerian sellers until you enable cross-border pairs or open mode here.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Platform policy</p>
          </div>
          <button
            type="button"
            onClick={() => void loadConfig()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase text-gray-400">Mode</label>
            <div className="space-y-2">
              {MODE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
                    modeDraft === option.value ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                  } ${!canEdit ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name="geo-mode"
                    value={option.value}
                    checked={modeDraft === option.value}
                    disabled={!canEdit}
                    onChange={() => setModeDraft(option.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-bold text-gray-800">{option.label}</span>
                    <span className="block text-xs text-gray-500">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase text-gray-400">Blocked surfaces</label>
            <div className="space-y-2">
              {SURFACE_OPTIONS.map((surface) => (
                <label key={surface.key} className="flex items-start gap-2 rounded-lg border border-gray-100 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(surfacesDraft[surface.key])}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setSurfacesDraft((prev) => ({ ...prev, [surface.key]: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-gray-300"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-800">{surface.label}</span>
                    <span className="block text-xs text-gray-500">{surface.help}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {modeDraft === 'allow_pairs' && (
          <div className="space-y-3 rounded-lg border border-dashed border-gray-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Allowed viewer → seller pairs</p>
              {canEdit && (
                <button
                  type="button"
                  onClick={addPair}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50"
                >
                  <Plus className="h-3 w-3" /> Add pair
                </button>
              )}
            </div>
            {pairsDraft.length === 0 ? (
              <p className="text-xs text-gray-500">No pairs whitelisted — all cross-country traffic remains blocked.</p>
            ) : (
              <div className="space-y-2">
                {pairsDraft.map((pair, index) => (
                  <div key={`${pair.viewer}-${pair.seller}-${index}`} className="flex flex-wrap items-center gap-2">
                    <select
                      value={pair.viewer}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setPairsDraft((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, viewer: e.target.value } : row))
                        )
                      }
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                    >
                      {MARKET_COUNTRIES.map((country) => (
                        <option key={`viewer-${country.code}`} value={country.code}>
                          {country.flag} Viewer {country.code}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-gray-400">→</span>
                    <select
                      value={pair.seller}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setPairsDraft((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, seller: e.target.value } : row))
                        )
                      }
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                    >
                      {MARKET_COUNTRIES.map((country) => (
                        <option key={`seller-${country.code}`} value={country.code}>
                          {country.flag} Seller {country.code}
                        </option>
                      ))}
                    </select>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setPairsDraft((prev) => prev.filter((_, i) => i !== index))}
                        className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400">Blocked screen title (optional)</label>
            <input
              value={titleDraft}
              disabled={!canEdit}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder="Not available in your region"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400">Operator notes</label>
            <input
              value={notesDraft}
              disabled={!canEdit}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Why this policy is configured..."
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-gray-400">Blocked screen body (optional)</label>
          <textarea
            value={bodyDraft}
            disabled={!canEdit}
            onChange={(e) => setBodyDraft(e.target.value)}
            rows={3}
            placeholder="Override RegionBlockedScreen copy shown in the mobile app."
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>

        {config?.updated_at && (
          <p className="text-[10px] text-gray-400">Last updated {new Date(config.updated_at).toLocaleString()}</p>
        )}

        {canEdit ? (
          <button
            type="button"
            disabled={!dirty || loading}
            onClick={() => setPendingSave(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Save policy
          </button>
        ) : (
          <p className="text-xs text-gray-500">Read-only for your role. Only super_admin can edit geo policy.</p>
        )}
      </div>

      <ActionReasonModal
        open={pendingSave}
        title="Update geo visibility policy?"
        description="This changes runtime cross-country rules for mobile clients and checkout enforcement."
        impactSummary="Mobile apps refresh policy from get_geo_visibility_config within ~10 minutes."
        categoryOptions={REASON_CATEGORIES}
        submitting={submitting}
        onClose={() => setPendingSave(false)}
        onSubmit={submitUpdate}
      />
    </div>
  )
}
