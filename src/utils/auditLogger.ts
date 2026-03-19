import { createClient } from './supabase/client'

type AuditDetails = string | Record<string, unknown>

export const trackAdminAction = async (action: string, details: AuditDetails, targetId?: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return;

    const { error } = await supabase.from('admin_audit_logs').insert({
        admin_id: user.id,
        admin_email: user.email,
        action_type: action,
        target_id: targetId || null,
        details: typeof details === 'string' ? { message: details } : details
    })

    if (error) {
      throw new Error(error.message)
    }
}