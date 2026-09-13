import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../utils/auth/apiAdmin'

type UpdatePolicy = 'silent' | 'optional' | 'mandatory'

type SettingsPayload = {
  maintenance_mode?: boolean
  min_version_ios?: string
  min_version_android?: string
  latest_version_ios?: string
  latest_version_android?: string
  update_policy_ios?: UpdatePolicy
  update_policy_android?: UpdatePolicy
  release_notes?: string
  store_url_ios?: string
  store_url_android?: string
  support_phone?: string
}

const POLICIES: UpdatePolicy[] = ['silent', 'optional', 'mandatory']

function isPolicy(value: unknown): value is UpdatePolicy {
  return typeof value === 'string' && POLICIES.includes(value as UpdatePolicy)
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
    typeof body.latest_version_ios !== 'string' ||
    typeof body.latest_version_android !== 'string' ||
    !isPolicy(body.update_policy_ios) ||
    !isPolicy(body.update_policy_android) ||
    typeof body.release_notes !== 'string' ||
    typeof body.store_url_ios !== 'string' ||
    typeof body.store_url_android !== 'string' ||
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
      latest_version_ios: body.latest_version_ios,
      latest_version_android: body.latest_version_android,
      update_policy_ios: body.update_policy_ios,
      update_policy_android: body.update_policy_android,
      release_notes: body.release_notes,
      store_url_ios: body.store_url_ios,
      store_url_android: body.store_url_android,
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
    details: {
      message: 'Updated system config.',
      maintenance_mode: body.maintenance_mode,
      min_version_ios: body.min_version_ios,
      min_version_android: body.min_version_android,
      latest_version_ios: body.latest_version_ios,
      latest_version_android: body.latest_version_android,
      update_policy_ios: body.update_policy_ios,
      update_policy_android: body.update_policy_android,
      release_notes: body.release_notes ? '[set]' : '',
      store_url_ios: body.store_url_ios ? '[set]' : '',
      store_url_android: body.store_url_android ? '[set]' : '',
      support_phone: body.support_phone,
    },
  })

  return NextResponse.json({ ok: true })
}
