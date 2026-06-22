import { createClient } from '@supabase/supabase-js'

export function createServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function invokeSupabaseEdgeFunction<T = Record<string, unknown>>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null; status: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return { data: null, error: 'Server missing Supabase service credentials', status: 500 }
  }

  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string }

  if (!response.ok) {
    return {
      data: null,
      error: payload?.error || `Edge function ${functionName} failed (${response.status})`,
      status: response.status,
    }
  }

  return { data: payload as T, error: null, status: response.status }
}
