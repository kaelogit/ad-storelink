export type DisputeChatMessageRow = {
  message_id: string
  conversation_id: string
  sender_id: string | null
  sender_display_name: string | null
  sender_role: string | null
  created_at: string | null
  text: string | null
  type: string | null
  image_url: string | null
  gif_url: string | null
  audio_url: string | null
  audio_duration_seconds: number | null
  video_url: string | null
  document_url: string | null
  document_name: string | null
  reply_to_snippet: string | null
}

export function attachmentSummary(m: DisputeChatMessageRow): string | null {
  if (m.image_url) return 'Photo'
  if (m.gif_url) return 'GIF'
  if (m.video_url) return 'Video'
  if (m.audio_url) return 'Voice message'
  if (m.document_url) return m.document_name ? `File: ${m.document_name}` : 'File'
  return null
}

export function isActiveProductOrderDispute(order: {
  status?: string | null
  dispute?: unknown
}): boolean {
  const status = String(order.status || '').toUpperCase()
  return status === 'DISPUTE_OPEN' || Boolean(order.dispute)
}
