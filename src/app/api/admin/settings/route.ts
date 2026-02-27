import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../utils/auth/apiAdmin'

type SettingsPayload = {
  maintenance_mode?: boolean
  min_version_ios?: string
  min_version_android?: string
  support_phone?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as SettingsPayload
  if (
    typeof body.maintenance_mode !== 'boolean' ||
    typeof body.min_version_ios !== 'string' ||
    typeof body.min_version_android !== 'string' ||
    typeof body.support_phone !== 'string'
  ) {
    return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('app_settings')
    .update({
      maintenance_mode: body.maintenance_mode,
      min_version_ios: body.min_version_ios,
      min_version_android: body.min_version_android,
      support_phone: body.support_phone,
    })
    .eq('id', 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'SYSTEM_CONFIG_CHANGE',
    details: `Updated config. Maintenance: ${body.maintenance_mode}`,
  })

  return NextResponse.json({ ok: true })
}
