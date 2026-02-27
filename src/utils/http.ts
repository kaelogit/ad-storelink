export async function parseApiError(response: Response, fallback = 'Request failed') {
  try {
    const payload = (await response.json()) as { error?: string; message?: string }
    return payload.error || payload.message || fallback
  } catch {
    return fallback
  }
}
