import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type ModerateStoryPayload = {
  storyId?: string
  action?: 'dismiss' | 'hide' | 'remove' | 'reinstate'
  reasonCategory?: string
  reason?: string
  reportId?: string | null
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as ModerateStoryPayload
  const storyId = body.storyId?.trim()
  const action = body.action
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()
  const reportId = body.reportId?.trim() || null

  if (!storyId || !action || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'storyId, action, reasonCategory and reason are required' },
      { status: 400 }
    )
  }

  if (!['dismiss', 'hide', 'remove', 'reinstate'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  if (reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('moderate_story', {
    p_story_id: storyId,
    p_action: action,
    p_reason_category: reasonCategory,
    p_reason: reason,
    p_report_id: reportId,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data ?? { ok: true })
}
