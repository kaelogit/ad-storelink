import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '../supabase/server'

export type AdminRole = 'super_admin' | 'moderator' | 'finance' | 'support' | 'content'

export async function requireAdmin(
  allowedRoles?: AdminRole[]
): Promise<{ userId: string; role: AdminRole; email: string | null }> {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id, role, email, is_active')
    .eq('id', user.id)
    .single()

  if (!adminUser || !adminUser.is_active) {
    redirect('/unauthorized')
  }

  const role = adminUser.role as AdminRole
  if (allowedRoles && !allowedRoles.includes(role)) {
    redirect('/dashboard/unauthorized')
  }

  return { userId: user.id, role, email: adminUser.email }
}
