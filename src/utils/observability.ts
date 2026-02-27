import { createClient } from './supabase/client'

export async function logObservabilityEvent(eventType: string, payload: Record<string, unknown>) {
  const supabase = createClient()

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user?.id) return

  await supabase.rpc('log_observability_event', {
    p_event_name: eventType,
    p_source: 'admin_storelink',
    p_user_id: userData.user.id,
    p_level: 'error',
    p_metadata: payload,
  })
}
