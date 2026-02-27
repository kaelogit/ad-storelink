import type { AdminRole } from '../../types/admin'
import { createServerSupabaseClient } from '../supabase/server'

type ApiAdminContext =
  | {
      ok: true
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
      userId: string
      email: string | null
      role: AdminRole
    }
  | {
      ok: false
      status: number
      error: string
    }

export async function getApiAdminContext(allowedRoles: AdminRole[]): Promise<ApiAdminContext> {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { ok: false, status: 401, error: 'Unauthorized' }
    }

    const { data: adminUser, error: adminUserError } = await supabase
      .from('admin_users')
      .select('email, role, is_active')
      .eq('id', user.id)
      .single()

    if (adminUserError || !adminUser || !adminUser.is_active) {
      return { ok: false, status: 403, error: 'Admin access required' }
    }

    const role = adminUser.role as AdminRole
    if (!allowedRoles.includes(role)) {
      return { ok: false, status: 403, error: 'Forbidden for current role' }
    }

    return {
      ok: true,
      supabase,
      userId: user.id,
      email: adminUser.email,
      role,
    }
  } catch {
    // Fail closed for auth-path errors so protected routes never return unexpected 500s on unauthenticated requests.
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
}
