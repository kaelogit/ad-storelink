import { NextResponse } from 'next/server'
import { getApiAdminContext } from '@/utils/auth/apiAdmin'

const QUEUE_KEYS = new Set(['kyc_identity', 'kyc_business', 'content_report'])

type Body = {
  queueKey?: string
  targetId?: string
  /** claim | release | assign */
  action?: 'claim' | 'release' | 'assign'
  /** required for assign */
  assigneeId?: string | null
  note?: string | null
}

export async function GET(request: Request) {
  const auth = await getApiAdminContext([
    'super_admin',
    'moderator',
    'support',
    'content',
    'analyst',
  ])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const queueKey = url.searchParams.get('queueKey')?.trim() || null
  const targetIds = (url.searchParams.get('targetIds') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  let query = auth.supabase
    .from('admin_queue_assignments')
    .select('queue_key, target_id, assigned_to, assigned_at, assigned_by, note')

  if (queueKey) query = query.eq('queue_key', queueKey)
  if (targetIds.length > 0) query = query.in('target_id', targetIds)

  const { data, error } = await query.limit(500)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const assigneeIds = Array.from(
    new Set((data ?? []).map((r) => r.assigned_to).filter(Boolean) as string[]),
  )
  let names: Record<string, string> = {}
  if (assigneeIds.length > 0) {
    const { data: admins } = await auth.supabase
      .from('admin_users')
      .select('id, email, role')
      .in('id', assigneeIds)
    names = Object.fromEntries(
      (admins ?? []).map((a) => [a.id, a.email || a.role || a.id.slice(0, 8)]),
    )
  }

  return NextResponse.json({
    assignments: (data ?? []).map((row) => ({
      ...row,
      assignee_label: names[row.assigned_to] || row.assigned_to,
    })),
    me: auth.userId,
  })
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const queueKey = body.queueKey?.trim()
  const targetId = body.targetId?.trim()
  const action = body.action

  if (!queueKey || !QUEUE_KEYS.has(queueKey) || !targetId || !action) {
    return NextResponse.json(
      { error: 'queueKey, targetId and action (claim|release|assign) are required' },
      { status: 400 },
    )
  }

  if (action === 'release') {
    const { error } = await auth.supabase
      .from('admin_queue_assignments')
      .delete()
      .eq('queue_key', queueKey)
      .eq('target_id', targetId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else {
    const assigneeId =
      action === 'claim' ? auth.userId : body.assigneeId?.trim() || null
    if (!assigneeId) {
      return NextResponse.json({ error: 'assigneeId required for assign' }, { status: 400 })
    }
    const { error } = await auth.supabase.from('admin_queue_assignments').upsert(
      {
        queue_key: queueKey,
        target_id: targetId,
        assigned_to: assigneeId,
        assigned_by: auth.userId,
        assigned_at: new Date().toISOString(),
        note: body.note?.trim() || null,
      },
      { onConflict: 'queue_key,target_id' },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'QUEUE_ASSIGNMENT',
    target_id: targetId,
    details: {
      message: `Queue ${action}.`,
      queueKey,
      targetId,
      action,
      assigneeId: action === 'release' ? null : action === 'claim' ? auth.userId : body.assigneeId,
    },
  })

  return NextResponse.json({ ok: true })
}
