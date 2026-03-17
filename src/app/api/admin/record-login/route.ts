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

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null
  return request.headers.get('x-real-ip') ?? null
}

/**
 * Called after successful admin login to:
 * - Update admin_users.last_login and last_login_ip
 * - Insert a row into admin_sessions (if table exists) for the Sessions tab
 */
export async function POST(request: Request) {
  const auth = await getApiAdminContext(ALL_ADMIN_ROLES)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const ip = getClientIp(request)
  const body = await request.json().catch(() => ({})) as { device_info?: string }
  const deviceInfo = typeof body.device_info === 'string' ? body.device_info.slice(0, 500) : null

  try {
    // Update last login on admin_users (columns must exist; migration may add them)
    await auth.supabase
      .from('admin_users')
      .update({
        last_login: new Date().toISOString(),
        last_login_ip: ip,
      })
      .eq('id', auth.userId)

    // Record session for Super Admin > Sessions tab (table must exist)
    const { error: sessionError } = await auth.supabase.from('admin_sessions').insert({
      admin_id: auth.userId,
      device_info: deviceInfo,
      ip,
      last_activity: new Date().toISOString(),
    })

    if (sessionError && process.env.NODE_ENV !== 'production') {
      // Table might not exist yet; don't fail login
      console.warn('[record-login] admin_sessions insert failed:', sessionError.message)
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('[record-login]', e)
  }

  return NextResponse.json({ ok: true })
}
