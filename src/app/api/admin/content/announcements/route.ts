import { NextResponse } from 'next/server'
import { getApiAdminContext } from '@/utils/auth/apiAdmin'

type CreateBody = {
  title?: string
  body?: string
  segment?: 'ALL' | 'SELLERS' | 'BUYERS'
  scheduledAt?: string
}

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'content', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  let query = auth.supabase
    .from('admin_scheduled_announcements')
    .select('*')
    .order('scheduled_at', { ascending: true })
    .limit(200)

  if (from) query = query.gte('scheduled_at', from)
  if (to) query = query.lte('scheduled_at', to)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ announcements: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as CreateBody
  const title = body.title?.trim()
  const message = body.body?.trim()
  const segment = body.segment || 'ALL'
  const scheduledAt = body.scheduledAt?.trim()

  if (!title || !message || !scheduledAt) {
    return NextResponse.json({ error: 'title, body and scheduledAt are required' }, { status: 400 })
  }
  if (!['ALL', 'SELLERS', 'BUYERS'].includes(segment)) {
    return NextResponse.json({ error: 'Invalid segment' }, { status: 400 })
  }
  const when = new Date(scheduledAt)
  if (Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: 'scheduledAt must be a valid ISO datetime' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('admin_scheduled_announcements')
    .insert({
      title,
      body: message,
      segment,
      scheduled_at: when.toISOString(),
      status: 'scheduled',
      created_by: auth.userId,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'ANNOUNCEMENT_SCHEDULED',
    target_id: data.id,
    details: {
      message: 'Scheduled announcement.',
      title,
      segment,
      scheduledAt: when.toISOString(),
    },
  })

  return NextResponse.json({ ok: true, announcement: data })
}
