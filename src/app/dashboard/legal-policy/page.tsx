'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Info, Loader2, RefreshCcw } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { parseApiError } from '../../../utils/http'
import { useAdminRole } from '../../../hooks/useAdminRole'
import { SUPPORTED_COUNTRIES } from '../../../constants/SupportedCountries'

const STORE_APP_BASE = (process.env.NEXT_PUBLIC_STORELINK_APP_URL || 'https://storelink.ng').replace(/\/$/, '')

type PolicyType = 'terms' | 'privacy' | 'service_policies'
type PolicySurface = 'app' | 'web' | 'storefront'
type PolicyFormat = 'structured_json' | 'markdown' | 'html'

type DeskDocument = {
  format?: PolicyFormat
  title?: string
  effectiveLabel?: string
  intro?: string
  body?: { sections?: unknown[] } | string
  version?: number
  publishedAt?: string
}

type DeskPayload = {
  policyType?: PolicyType
  countryCode?: string
  surface?: PolicySurface
  current?: DeskDocument | null
  versions?: Array<{ version: number; publishedAt: string; title: string }>
  methodology?: {
    deployNote?: string
    structuredShape?: unknown
  }
}

const POLICY_TABS: Array<{ value: PolicyType; label: string }> = [
  { value: 'terms', label: 'Terms' },
  { value: 'privacy', label: 'Privacy' },
  { value: 'service_policies', label: 'Service policies' },
]

const MARKET_COUNTRIES = SUPPORTED_COUNTRIES.filter((c) => c.code !== 'ALL')

const REASON_CATEGORIES = [
  { value: 'legal_update', label: 'Legal update' },
  { value: 'regulatory_change', label: 'Regulatory change' },
  { value: 'product_change', label: 'Product/policy change' },
  { value: 'other', label: 'Other' },
]

export default function LegalPolicyPage() {
  const { role: adminRole } = useAdminRole()
  const [desk, setDesk] = useState<DeskPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [pendingPublish, setPendingPublish] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)

  const [policyType, setPolicyType] = useState<PolicyType>('terms')
  const [countryCode, setCountryCode] = useState('NG')
  const [surface, setSurface] = useState<PolicySurface>('app')
  const [format, setFormat] = useState<PolicyFormat>('structured_json')
  const [titleDraft, setTitleDraft] = useState('')
  const [effectiveLabelDraft, setEffectiveLabelDraft] = useState('')
  const [introDraft, setIntroDraft] = useState('')
  const [bodyDraft, setBodyDraft] = useState('{\n  "sections": []\n}')

  const canEdit = adminRole === 'super_admin' || adminRole === 'content'
  const effectiveCountry = policyType === 'service_policies' ? 'GLOBAL' : countryCode

  const applyDeskToDraft = useCallback((payload: DeskPayload | null) => {
    const current = payload?.current
    setDesk(payload)
    setFormat(current?.format ?? 'structured_json')
    setTitleDraft(current?.title ?? '')
    setEffectiveLabelDraft(current?.effectiveLabel ?? '')
    setIntroDraft(current?.intro ?? '')
    if (typeof current?.body === 'string') {
      setBodyDraft(current.body)
    } else {
      setBodyDraft(JSON.stringify(current?.body ?? { sections: [] }, null, 2))
    }
  }, [])

  const loadDesk = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        policyType,
        country: effectiveCountry,
        surface,
      })
      const response = await fetch(`/api/admin/legal-policy/desk?${params.toString()}`)
      if (!response.ok) {
        const msg = await parseApiError(response, 'Failed to load legal policy desk.')
        setFeedback({ tone: 'error', message: msg })
        applyDeskToDraft(null)
        return
      }
      const payload = (await response.json()) as DeskPayload
      applyDeskToDraft(payload)
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to load legal policy desk.',
      })
      applyDeskToDraft(null)
    } finally {
      setLoading(false)
    }
  }, [applyDeskToDraft, effectiveCountry, policyType, surface])

  useEffect(() => {
    void loadDesk()
  }, [loadDesk])

  const publicUrl = useMemo(() => {
    if (policyType === 'service_policies') return `${STORE_APP_BASE}/legal/service-policies`
    const path = policyType === 'terms' ? 'terms' : 'privacy'
    return `${STORE_APP_BASE}/${path}/${effectiveCountry.toLowerCase()}`
  }, [effectiveCountry, policyType])

  const versions = useMemo(() => {
    const list = Array.isArray(desk?.versions) ? desk!.versions! : []
    return list.slice(0, 12)
  }, [desk?.versions])

  const submitPublish = async ({ category, reason }: { category: string; reason: string }) => {
    setSubmitting(true)
    try {
      if (!titleDraft.trim()) {
        throw new Error('Title is required before publish.')
      }

      let parsedBody: unknown = bodyDraft
      if (format === 'structured_json') {
        try {
          parsedBody = JSON.parse(bodyDraft)
        } catch {
          throw new Error('Body must be valid JSON for structured_json format.')
        }
        const sections = (parsedBody as { sections?: unknown })?.sections
        if (!Array.isArray(sections) || sections.length === 0) {
          throw new Error('Structured JSON must include a non-empty "sections" array.')
        }
      }

      const response = await fetch('/api/admin/legal-policy/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': `legal-policy-${policyType}-${effectiveCountry}-${Date.now()}`,
        },
        body: JSON.stringify({
          policyType,
          countryCode: effectiveCountry,
          surface,
          format,
          title: titleDraft,
          effectiveLabel: effectiveLabelDraft,
          intro: introDraft,
          body: parsedBody,
          reason: `[${category}] ${reason}`,
        }),
      })

      if (!response.ok) {
        // Thrown so the reason modal shows the failure inline and stays open.
        throw new Error(await parseApiError(response, 'Failed to publish legal policy.'))
      }

      setPendingPublish(false)
      setFeedback({ tone: 'success', message: 'Legal policy published as a new version.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish legal policy.'
      setFeedback({ tone: 'error', message })
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setSubmitting(false)
    }
    await loadDesk()
  }

  const tabClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
      active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legal & Policy CMS"
        subtitle="Publish versioned terms, privacy, and service policies. Mobile app fetches via get_legal_policy."
        actions={
          <DeskLinkPills
            links={[
              { href: '/dashboard/geo-policy', label: 'Geo policy' },
              { href: '/dashboard/bookings', label: 'Bookings' },
              { href: '/dashboard/moderator', label: 'Moderation' },
            ]}
          />
        }
      />

      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div className="space-y-1.5 text-xs text-blue-900">
            <p className="font-bold">Publishing model</p>
            <p>
              Each publish creates a new immutable version. Mobile/web clients call{' '}
              <code className="rounded bg-white/80 px-1">get_legal_policy</code> and cache ~30 minutes.
            </p>
            <p>
              <strong>App / Web / Storefront are separate documents.</strong> Changing surface loads a different
              published row — publish each surface you need live.
            </p>
            <p>
              Structured JSON shape:{' '}
              <code className="rounded bg-white/80 px-1">{`{ "sections": [{ "title", "intro?", "bullets?", "body?" }] }`}</code>
            </p>
            <p>
              Public URL: <a href={publicUrl} className="underline" target="_blank" rel="noreferrer">{publicUrl}</a>
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {POLICY_TABS.map((tab) => (
              <button key={tab.value} className={tabClass(policyType === tab.value)} onClick={() => setPolicyType(tab.value)}>
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void loadDesk()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          {policyType !== 'service_policies' && (
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {MARKET_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={surface}
            onChange={(e) => setSurface(e.target.value as PolicySurface)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="app">App surface</option>
            <option value="web">Web surface</option>
            <option value="storefront">Storefront surface</option>
          </select>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as PolicyFormat)}
            disabled={!canEdit}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="structured_json">Structured JSON</option>
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
          </select>
        </div>

        {desk?.current?.version ? (
          <p className="text-xs text-gray-500">
            Current published: <span className="font-semibold text-gray-800">v{desk.current.version}</span>
            {desk.current.publishedAt ? ` · ${new Date(desk.current.publishedAt).toLocaleString()}` : ''}
            {' · '}
            {effectiveCountry}/{surface}
          </p>
        ) : (
          <p className="text-xs text-amber-700">
            No published document yet for {policyType} · {effectiveCountry} · {surface}.
          </p>
        )}

        {versions.length > 0 ? (
          <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Version history</p>
            <ul className="mt-1.5 space-y-1">
              {versions.map((v) => (
                <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600">
                  <span>
                    <span className="font-semibold text-gray-800">v{v.version}</span>
                    {v.title ? ` · ${v.title}` : ''}
                  </span>
                  <span className="text-gray-400">
                    {v.publishedAt ? new Date(v.publishedAt).toLocaleString() : '—'}
                    {desk?.current?.version === v.version ? (
                      <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        live
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400">Title</label>
            <input
              value={titleDraft}
              disabled={!canEdit}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400">Effective label</label>
            <input
              value={effectiveLabelDraft}
              disabled={!canEdit}
              onChange={(e) => setEffectiveLabelDraft(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-gray-400">Intro</label>
          <textarea
            value={introDraft}
            disabled={!canEdit}
            onChange={(e) => setIntroDraft(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-gray-400">
            Body {format === 'structured_json' ? '(JSON sections)' : `(${format})`}
          </label>
          <textarea
            value={bodyDraft}
            disabled={!canEdit}
            onChange={(e) => setBodyDraft(e.target.value)}
            rows={18}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
          />
        </div>

        {canEdit ? (
          <button
            type="button"
            onClick={() => setPendingPublish(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            <FileText className="h-4 w-4" />
            Publish new version
          </button>
        ) : (
          <p className="text-xs text-gray-500">Read-only for your role. Publishing requires content or super_admin.</p>
        )}
      </div>

      <ActionReasonModal
        open={pendingPublish}
        title="Publish legal policy?"
        description="This creates a new immutable version for the selected policy, country, and surface."
        impactSummary="Mobile clients refresh from get_legal_policy within ~30 minutes."
        categoryOptions={REASON_CATEGORIES}
        submitting={submitting}
        onClose={() => setPendingPublish(false)}
        onSubmit={submitPublish}
      />
    </div>
  )
}
