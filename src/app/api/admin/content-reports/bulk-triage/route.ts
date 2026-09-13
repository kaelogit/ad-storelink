import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type ReportItem = {
  reportId: string
  reportType: 'spotlight' | 'reel' | 'comment' | 'profile' | 'chat' | 'group' | 'policy'
}

type Body = {
  action?: 'dismiss'
  reason?: string
  items?: ReportItem[]
}

/**
 * Bulk triage for Report Inbox — mark reports dismissed (or policy inconclusive).
 */
export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const action = body.action
  const reason = (body.reason || 'Bulk dismiss from Report Inbox').trim()
  const items = Array.isArray(body.items) ? body.items.slice(0, 40) : []

  if (action !== 'dismiss' || items.length === 0) {
    return NextResponse.json({ error: 'action=dismiss and items[] required (max 40)' }, { status: 400 })
  }
  if (reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const results: { reportId: string; ok: boolean; error?: string }[] = []

  for (const item of items) {
    const reportId = item.reportId?.trim()
    const reportType = item.reportType
    if (!reportId || !reportType) {
      results.push({ reportId: reportId || 'unknown', ok: false, error: 'Invalid item' })
      continue
    }

    try {
      if (reportType === 'reel') {
        const { error } = await auth.supabase
          .from('reel_reports')
          .update({
            status: 'dismissed',
            admin_reviewed_by: auth.userId,
            admin_reviewed_at: now,
            admin_note: reason,
          })
          .eq('id', reportId)
        if (error) throw new Error(error.message)
      } else if (reportType === 'comment') {
        const { error } = await auth.supabase
          .from('comment_reports')
          .update({
            status: 'dismissed',
            admin_reviewed_by: auth.userId,
            admin_reviewed_at: now,
            admin_note: reason,
          })
          .eq('id', reportId)
        if (error) throw new Error(error.message)
      } else if (reportType === 'spotlight') {
        const { error } = await auth.supabase
          .from('spotlight_reports')
          .update({
            status: 'dismissed',
            admin_reviewed_by: auth.userId,
            admin_reviewed_at: now,
            admin_note: reason,
          })
          .eq('id', reportId)
        if (error) throw new Error(error.message)
      } else if (reportType === 'policy') {
        const { error } = await auth.supabase.rpc('resolve_content_policy_flag', {
          p_flag_id: reportId,
          p_outcome: 'inconclusive',
          p_status: 'dismissed',
          p_notes: reason,
        })
        if (error) throw new Error(error.message)
      } else if (reportType === 'profile' || reportType === 'chat' || reportType === 'group') {
        const { error } = await auth.supabase
          .from('abuse_reports')
          .update({ status: 'dismissed' })
          .eq('id', reportId)
        if (error) throw new Error(error.message)
      } else {
        throw new Error('Unsupported report type')
      }

      results.push({ reportId, ok: true })
    } catch (e) {
      results.push({
        reportId,
        ok: false,
        error: e instanceof Error ? e.message : 'Failed',
      })
    }
  }

  const okCount = results.filter((r) => r.ok).length
  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'CONTENT_REPORTS_BULK_DISMISS',
    target_id: 'bulk',
    details: {
      message: `Bulk dismiss ${okCount}/${results.length}.`,
      reason,
      results,
    },
  })

  return NextResponse.json({
    ok: true,
    okCount,
    failCount: results.length - okCount,
    results,
  })
}
