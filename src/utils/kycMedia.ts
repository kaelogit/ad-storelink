import { createClient } from './supabase/client'

export type KycMediaResolveResult = {
  url: string | null
  error?: string
}

/**
 * Resolve a KYC media ref for admin preview (Gap 8).
 * Always goes through get-kyc-download-url — never opens private keys as site paths
 * and never opens legacy public HTTPS URLs directly.
 */
export async function resolveAdminKycMediaUrl(
  ref: string | null | undefined,
): Promise<string | null> {
  const result = await resolveAdminKycMedia(ref)
  return result.url
}

export async function resolveAdminKycMedia(
  ref: string | null | undefined,
): Promise<KycMediaResolveResult> {
  const raw = (ref || '').trim()
  if (!raw) return { url: null }

  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke<{
    signedUrl?: string
    error?: string
    code?: string
  }>('get-kyc-download-url', {
    body: { key: raw },
  })

  if (error) {
    console.warn('[kyc-media] sign failed', error.message)
    return { url: null, error: error.message || 'Could not sign KYC media' }
  }

  const signed = (data?.signedUrl || '').trim()
  if (!signed || !/^https?:\/\//i.test(signed)) {
    const msg = data?.error || data?.code || 'KYC signed URL missing'
    console.warn('[kyc-media] sign failed', msg)
    return { url: null, error: msg }
  }

  return { url: signed }
}
