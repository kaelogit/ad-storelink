import { NextResponse } from 'next/server'
import { getApiAdminContext } from '@/utils/auth/apiAdmin'

type SeriesRow = {
  report_date: string
  country_code: string
  placement: string
  metrics?: Record<string, unknown>
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'analyst', 'finance'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const country = (url.searchParams.get('country') || 'ALL').trim().toUpperCase()
  const placement = (url.searchParams.get('placement') || 'ALL').trim()
  const days = Math.max(1, Math.min(Number(url.searchParams.get('days') || 30), 365))

  const { data, error } = await auth.supabase.rpc('get_admin_ads_warehouse', {
    p_country_code: country || 'ALL',
    p_days: Number.isFinite(days) ? days : 30,
    p_placement: placement || 'ALL',
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const series = (Array.isArray((data as any)?.series) ? (data as any).series : []) as SeriesRow[]
  const header = [
    'report_date',
    'country_code',
    'placement',
    'impressions',
    'billableImpressions',
    'spentMinor',
    'clicks',
    'ctr',
    'ecpm',
    'revenueMinor',
    'addToCarts',
    'purchases',
    'activeCampaigns',
    'campaignsServed',
    'fillIsh',
  ]
  const lines = [header.join(',')]
  for (const row of series) {
    const m = row.metrics || {}
    lines.push(
      [
        row.report_date,
        row.country_code,
        row.placement,
        m.impressions,
        m.billableImpressions,
        m.spentMinor,
        m.clicks,
        m.ctr,
        m.ecpm,
        m.revenueMinor,
        m.addToCarts,
        m.purchases,
        m.activeCampaigns,
        m.campaignsServed,
        m.fillIsh,
      ]
        .map(csvEscape)
        .join(','),
    )
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'ADS_WAREHOUSE_EXPORT',
    target_id: `${country || 'ALL'}:${placement || 'ALL'}`,
    details: { days, country, placement, rows: series.length },
  })

  const filename = `ads-warehouse-${country}-${placement}-${days}d.csv`
  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
