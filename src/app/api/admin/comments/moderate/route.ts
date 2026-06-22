import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type ModerateCommentPayload = {
  sourceType?: 'product' | 'service' | 'spotlight' | 'reel'
  commentId?: string
  action?: 'dismiss' | 'hide' | 'delete' | 'reinstate'
  reasonCategory?: string
  reason?: string
  reportId?: string | null
  applyStrike?: boolean
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as ModerateCommentPayload
  const sourceType = body.sourceType
  const commentId = body.commentId?.trim()
  const action = body.action
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()
  const reportId = body.reportId?.trim() || null
  const applyStrike = Boolean(body.applyStrike)

  if (!sourceType || !commentId || !action || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'sourceType, commentId, action, reasonCategory and reason are required' },
      { status: 400 }
    )
  }

  if (!['product', 'service', 'spotlight', 'reel'].includes(sourceType)) {
    return NextResponse.json({ error: 'Invalid sourceType' }, { status: 400 })
  }

  if (!['dismiss', 'hide', 'delete', 'reinstate'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  if (reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('moderate_comment', {
    p_source_type: sourceType,
    p_comment_id: commentId,
    p_action: action,
    p_reason_category: reasonCategory,
    p_reason: reason,
    p_report_id: reportId,
    p_apply_strike: applyStrike,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data ?? { ok: true })
}
