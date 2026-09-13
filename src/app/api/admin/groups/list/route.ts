import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export type AdminGroupChatRow = {
  group_id: string
  title: string
  status: string
  join_policy: string
  member_cap: number
  member_count: number
  open_report_count: number
  host_seller_id: string
  host_display_name: string | null
  host_slug: string | null
  host_email: string | null
  host_groups_create_banned: boolean
  created_at: string
  updated_at: string
  last_message_at: string | null
}

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') || '').trim()
  const status = (url.searchParams.get('status') || '').trim().toLowerCase() || null
  const hostId = (url.searchParams.get('hostId') || '').trim() || null
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 50), 200))
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))

  const { data, error } = await auth.supabase.rpc('get_admin_group_chats', {
    p_query: q || null,
    p_status: status,
    p_host_id: hostId,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'GROUP_CHATS_DESK_VIEW',
    target_id: hostId || 'list',
    details: { q: q || null, status, limit, offset, count: Array.isArray(data) ? data.length : 0 },
  })

  return NextResponse.json({
    rows: (Array.isArray(data) ? data : []) as AdminGroupChatRow[],
    pagination: { limit, offset },
  })
}
