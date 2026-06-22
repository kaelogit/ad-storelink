'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Info, Loader2, RefreshCcw } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { parseApiError } from '../../../utils/http'
import { createClient } from '../../../utils/supabase/client'
import { SUPPORTED_COUNTRIES } from '../../../constants/SupportedCountries'
import type { AdminRole } from '../../../types/admin'

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
  const supabase = createClient()
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null)
  const [desk, setDesk] = useState<DeskPayload | null>(null)
  const [loading, setLoading] = useState(false)
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
      setLoading(false)
      return
    }
    const payload = (await response.json()) as DeskPayload
    applyDeskToDraft(payload)
    setLoading(false)
  }, [applyDeskToDraft, effectiveCountry, policyType, surface])

  useEffect(() => {
    void loadDesk()
  }, [loadDesk])

  const publicUrl = useMemo(() => {
    if (policyType === 'service_policies') return 'https://storelink.ng/legal/service-policies'
    const path = policyType === 'terms' ? 'terms' : 'privacy'
    return `https://storelink.ng/${path}/${effectiveCountry.toLowerCase()}`
  }, [effectiveCountry, policyType])

  const submitPublish = async ({ category, reason }: { category: string; reason: string }) => {
    setSubmitting(true)
    let parsedBody: unknown = bodyDraft
    if (format === 'structured_json') {
      try {
        parsedBody = JSON.parse(bodyDraft)
      } catch {
        setFeedback({ tone: 'error', message: 'Body must be valid JSON for structured_json format.' })
        setSubmitting(false)
        return
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
      const msg = await parseApiError(response, 'Failed to publish legal policy.')
      setFeedback({ tone: 'error', message: msg })
      setSubmitting(false)
      return
    }

    setPendingPublish(false)
    setSubmitting(false)
    setFeedback({ tone: 'success', message: 'Legal policy published as a new version.' })
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
          <div className="space-y-1 text-xs text-blue-900">
            <p className="font-bold">Publishing model</p>
            <p>
              Each publish creates a new version. Clients cache policy for ~30 minutes. Structured JSON uses{' '}
              <code className="rounded bg-white/80 px-1">{`{ "sections": [{ "title", "intro?", "bullets?", "body?" }] }`}</code>.
            </p>
            <p>{desk?.methodology?.deployNote}</p>
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
            Current published: v{desk.current.version}
            {desk.current.publishedAt ? ` · ${new Date(desk.current.publishedAt).toLocaleString()}` : ''}
          </p>
        ) : (
          <p className="text-xs text-amber-700">No published document yet for this scope.</p>
        )}

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
