import { NextResponse } from 'next/server'
import { getApiAdminContext } from '@/utils/auth/apiAdmin'

type SeriesRow = {
  report_date: string
  country_code: string
  metrics?: Record<string, unknown>
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const country = (url.searchParams.get('country') || 'ALL').trim().toUpperCase()
  const days = Math.max(1, Math.min(Number(url.searchParams.get('days') || 30), 365))

  const { data, error } = await auth.supabase.rpc('get_admin_analytics_warehouse', {
    p_country_code: country || 'ALL',
    p_days: Number.isFinite(days) ? days : 30,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const series = (Array.isArray((data as { series?: SeriesRow[] })?.series)
    ? (data as { series: SeriesRow[] }).series
    : []) as SeriesRow[]

  const header = [
    'report_date',
    'country_code',
    'currencyCode',
    'dau',
    'signups',
    'productOrders',
    'productGmv',
    'productGmvCompleted',
    'serviceOrders',
    'serviceGmv',
    'gmvTotal',
    'gmvCompleted',
    'firstOrderBuyers',
    'repeatBuyers',
    'd7RetentionRate',
    'awaitingPayment',
    'paidPlus',
    'completed',
    'onboardingCompletionRate',
  ]

  const lines = [header.join(',')]
  for (const row of series) {
    const m = (row.metrics || {}) as Record<string, any>
    const funnel = m.checkoutFunnel || {}
    const retention = m.retention || {}
    const onboarding = m.onboarding || {}
    lines.push(
      [
        row.report_date,
        row.country_code,
        m.currencyCode,
        m.dau,
        m.signups,
        m.productOrders,
        m.productGmv,
        m.productGmvCompleted,
        m.serviceOrders,
        m.serviceGmv,
        m.gmvTotal,
        m.gmvCompleted,
        m.firstOrderBuyers,
        retention.repeatBuyers,
        retention.d7RetentionRate,
        funnel.awaitingPayment,
        funnel.paidPlus,
        funnel.completed,
        onboarding.completionRate,
      ]
        .map(csvEscape)
        .join(','),
    )
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'ANALYTICS_WAREHOUSE_EXPORT',
    target_id: country || 'ALL',
    details: { days, country, rows: series.length },
  })

  const filename = `analytics-warehouse-${country}-${days}d.csv`
  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
