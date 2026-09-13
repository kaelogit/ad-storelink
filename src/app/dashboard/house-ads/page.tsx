'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import { PageHeader } from '../../../components/admin/PageHeader'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ConfirmActionModal } from '../../../components/admin/ConfirmActionModal'
import { Card, CardHeader, CardContent, Button, Input } from '../../../components/ui'
import { parseApiError } from '../../../utils/http'
import {
  HOUSE_AD_TEMPLATES,
  type HouseAdTemplate,
} from '../../../constants/houseAdTemplates'
import { useAdminRole } from '../../../hooks/useAdminRole'

type HouseCampaign = {
  id: string
  name: string
  status: string
  country_code: string
  placements: string[]
  image_url: string | null
  headline: string | null
  deeplink: string | null
  start_at: string | null
  end_at: string | null
  created_at: string
}

const PLACEMENT_OPTIONS = [
  { id: 'discover_tile', label: 'Discover' },
  { id: 'home_card', label: 'Home' },
] as const

export default function HouseAdsPage() {
  const { canWrite } = useAdminRole()
  const [campaigns, setCampaigns] = useState<HouseCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<{
    campaignId: string
    status: string
    name: string
  } | null>(null)

  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [headline, setHeadline] = useState('')
  const [deeplink, setDeeplink] = useState('/seller/what-is-selling')
  const [countryCode, setCountryCode] = useState('NG')
  const [placements, setPlacements] = useState<string[]>(['discover_tile', 'home_card'])
  const [imageHint, setImageHint] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/house-ads/list')
    if (!res.ok) {
      setFeedback({ tone: 'error', message: await parseApiError(res, 'Failed to load house ads.') })
      setLoading(false)
      return
    }
    const data = await res.json()
    setCampaigns(Array.isArray(data?.campaigns) ? data.campaigns : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const applyTemplate = (tpl: HouseAdTemplate) => {
    setActiveTemplateId(tpl.id)
    setName(tpl.name)
    setHeadline(tpl.headline)
    setDeeplink(tpl.deeplink)
    setPlacements([...tpl.placements])
    if (tpl.countryCode) setCountryCode(tpl.countryCode)
    setImageHint(tpl.imageHint || null)
    setFeedback({
      tone: 'info',
      message: `Preset “${tpl.label}” loaded — paste an image URL and publish.`,
    })
  }

  const togglePlacement = (id: string) => {
    setPlacements((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
        return prev.filter((p) => p !== id)
      }
      return [...prev, id]
    })
  }

  const create = async () => {
    if (!imageUrl.trim()) {
      setFeedback({ tone: 'error', message: 'Image URL is required.' })
      return
    }
    setSaving(true)
    setFeedback({ tone: 'info', message: 'Creating house ad…' })
    const res = await fetch('/api/admin/house-ads/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim() || headline.trim() || 'StoreLink house ad',
        imageUrl: imageUrl.trim(),
        headline: headline.trim() || null,
        deeplink: deeplink.trim() || null,
        placements,
        countryCode: countryCode.trim() || 'NG',
        activate: true,
      }),
    })
    if (!res.ok) {
      setFeedback({ tone: 'error', message: await parseApiError(res, 'Create failed.') })
      setSaving(false)
      return
    }
    setFeedback({ tone: 'success', message: 'House ad is live (no Paystack).' })
    setName('')
    setImageUrl('')
    setHeadline('')
    setActiveTemplateId(null)
    setImageHint(null)
    setSaving(false)
    await load()
  }

  const setStatus = async (campaignId: string, status: string) => {
    setSaving(true)
    const res = await fetch('/api/admin/house-ads/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, status }),
    })
    if (!res.ok) {
      setFeedback({ tone: 'error', message: await parseApiError(res, 'Status update failed.') })
      setSaving(false)
      return
    }
    setFeedback({ tone: 'success', message: `Campaign set to ${status}.` })
    setSaving(false)
    setPendingStatus(null)
    await load()
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="House ads"
        subtitle="Platform banners for Discover and Home. Use a launch preset, paste an image, publish — under 5 minutes. Requires ads_enabled."
      />

      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}
      {!canWrite ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Analyst view — create and status actions are hidden.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Launch presets</h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            One tap fills copy and deeplink. You only need a HTTPS image URL.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {HOUSE_AD_TEMPLATES.map((tpl) => {
              const on = activeTemplateId === tpl.id
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className={`rounded-lg border p-3 text-left transition ${
                    on
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <p className="text-sm font-semibold text-zinc-900">{tpl.label}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{tpl.description}</p>
                  <p className="mt-2 truncate font-mono text-[11px] text-zinc-400">{tpl.deeplink}</p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Create house campaign</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Internal name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Headline (shown on card)" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          <div>
            <Input placeholder="Image URL (HTTPS)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            {imageHint ? <p className="mt-1 text-xs text-zinc-500">Art tip: {imageHint}</p> : null}
          </div>
          <Input
            placeholder="Deeplink e.g. /seller/what-is-selling"
            value={deeplink}
            onChange={(e) => setDeeplink(e.target.value)}
          />
          <Input
            placeholder="Country code"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
          />
          <div className="flex flex-wrap gap-2">
            {PLACEMENT_OPTIONS.map((opt) => {
              const on = placements.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => togglePlacement(opt.id)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    on ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-zinc-200 text-zinc-600'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <Button onClick={() => void create()} disabled={saving || !canWrite}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish house ad'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Active & recent</h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-zinc-500">No house campaigns yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {campaigns.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt="" className="h-16 w-24 rounded object-cover" />
                  ) : (
                    <div className="flex h-16 w-24 items-center justify-center rounded bg-zinc-100 text-xs text-zinc-400">
                      No image
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{c.name}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {c.status} · {c.country_code} · {(c.placements || []).join(', ')}
                    </p>
                    {c.headline ? <p className="truncate text-xs text-zinc-600">{c.headline}</p> : null}
                    {c.deeplink ? <p className="truncate text-xs text-zinc-400">{c.deeplink}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canWrite && c.status !== 'active' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={saving}
                        onClick={() =>
                          setPendingStatus({ campaignId: c.id, status: 'active', name: c.name })
                        }
                      >
                        Activate
                      </Button>
                    ) : null}
                    {canWrite && c.status === 'active' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={saving}
                        onClick={() =>
                          setPendingStatus({ campaignId: c.id, status: 'paused', name: c.name })
                        }
                      >
                        Pause
                      </Button>
                    ) : null}
                    {canWrite && c.status !== 'ended' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={saving}
                        onClick={() =>
                          setPendingStatus({ campaignId: c.id, status: 'ended', name: c.name })
                        }
                      >
                        End
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmActionModal
        open={!!pendingStatus}
        title={`${pendingStatus?.status === 'active' ? 'Activate' : pendingStatus?.status === 'paused' ? 'Pause' : 'End'} house ad`}
        description={`Set “${pendingStatus?.name || 'campaign'}” to ${pendingStatus?.status || 'new status'}.`}
        impactSummary={
          pendingStatus?.status === 'active'
            ? 'Creative can deliver when ads_enabled is on.'
            : pendingStatus?.status === 'paused'
              ? 'Delivery pauses until reactivated.'
              : 'Campaign ends and will no longer deliver.'
        }
        danger={pendingStatus?.status === 'ended'}
        confirmLabel="Confirm"
        submitting={saving}
        onClose={() => setPendingStatus(null)}
        onConfirm={async () => {
          if (!pendingStatus) return
          await setStatus(pendingStatus.campaignId, pendingStatus.status)
        }}
      />
    </div>
  )
}
