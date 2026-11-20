import { NextResponse } from 'next/server'
import { getApiAdminContext } from '@/utils/auth/apiAdmin'
import type { AdminRole } from '@/types/admin'

const ALL_ADMIN_ROLES: AdminRole[] = [
  'super_admin',
  'moderator',
  'finance',
  'support',
  'content',
  'analyst',
]

const SESSION_REUSE_HOURS = 12

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim() ?? ''
    return first || null
  }
  const real = request.headers.get('x-real-ip')?.trim()
  return real || null
}

/**
 * Called after successful admin login (and optionally once per browser tab from the dashboard) to:
 * - Update admin_users.last_login and last_login_ip
 * - Upsert a row into admin_sessions for the Sessions tab
 */
export async function POST(request: Request) {
  const auth = await getApiAdminContext(ALL_ADMIN_ROLES)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const ip = getClientIp(request)
  const body = (await request.json().catch(() => ({}))) as {
    device_info?: string
    heartbeat?: boolean
  }
  const deviceInfo = typeof body.device_info === 'string' ? body.device_info.slice(0, 500) : null
  const heartbeat = body.heartbeat === true
  const now = new Date().toISOString()

  let lastLoginUpdated = false
  let sessionId: string | null = null
  let sessionAction: 'inserted' | 'refreshed' | 'skipped' | 'failed' = 'skipped'
  let sessionError: string | null = null

  try {
    if (!heartbeat) {
      const { error: loginError } = await auth.supabase
        .from('admin_users')
        .update({
          last_login: now,
          last_login_ip: ip,
        })
        .eq('id', auth.userId)

      lastLoginUpdated = !loginError
      if (loginError) {
        console.warn('[record-login] admin_users update failed:', loginError.message)
      }
    }

    const since = new Date(Date.now() - SESSION_REUSE_HOURS * 60 * 60 * 1000).toISOString()
    let existingQuery = auth.supabase
      .from('admin_sessions')
      .select('id')
      .eq('admin_id', auth.userId)
      .gte('last_activity', since)
      .order('last_activity', { ascending: false })
      .limit(1)

    if (deviceInfo) {
      existingQuery = existingQuery.eq('device_info', deviceInfo)
    }

    const { data: existingRows, error: existingError } = await existingQuery

    if (existingError) {
      sessionAction = 'failed'
      sessionError = existingError.message
      console.warn('[record-login] admin_sessions lookup failed:', existingError.message)
    } else if (existingRows?.[0]?.id) {
      const { error: refreshError } = await auth.supabase
        .from('admin_sessions')
        .update({
          last_activity: now,
          ...(ip ? { ip } : {}),
        })
        .eq('id', existingRows[0].id)

      if (refreshError) {
        sessionAction = 'failed'
        sessionError = refreshError.message
        console.warn('[record-login] admin_sessions refresh failed:', refreshError.message)
      } else {
        sessionId = existingRows[0].id
        sessionAction = 'refreshed'
      }
    } else {
      const { data: inserted, error: insertError } = await auth.supabase
        .from('admin_sessions')
        .insert({
          admin_id: auth.userId,
          device_info: deviceInfo,
          ip,
          last_activity: now,
        })
        .select('id')
        .maybeSingle()

      if (insertError) {
        sessionAction = 'failed'
        sessionError = insertError.message
        console.warn('[record-login] admin_sessions insert failed:', insertError.message)
      } else {
        sessionId = inserted?.id ?? null
        sessionAction = 'inserted'
      }
    }
  } catch (e) {
    sessionAction = 'failed'
    sessionError = e instanceof Error ? e.message : 'Unknown error'
    console.warn('[record-login]', e)
  }

  return NextResponse.json({
    ok: sessionAction !== 'failed',
    lastLoginUpdated,
    sessionId,
    sessionAction,
    sessionError,
  })
}
