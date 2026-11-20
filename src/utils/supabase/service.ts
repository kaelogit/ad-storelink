import { createClient } from '@supabase/supabase-js'

export function createServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Invoke a privileged Edge Function (embeddings, etc.).
 * Auth mirrors authorizeMoneyCron: Bearer service_role and/or x-cron-secret.
 */
export async function invokeSupabaseEdgeFunction<T = Record<string, unknown>>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null; status: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const cronSecret =
    process.env.CRON_SECRET?.trim() || process.env.SUPABASE_CRON_SECRET?.trim() || ''

  if (!url || !serviceKey) {
    return { data: null, error: 'Server missing Supabase service credentials', status: 500 }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
  }
  if (cronSecret) {
    headers['x-cron-secret'] = cronSecret
  }

  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string
    message?: string
  }

  if (!response.ok) {
    const detail =
      payload?.error ||
      payload?.message ||
      `Edge function ${functionName} failed (${response.status})`
    return {
      data: null,
      error: detail,
      status: response.status,
    }
  }

  return { data: payload as T, error: null, status: response.status }
}
