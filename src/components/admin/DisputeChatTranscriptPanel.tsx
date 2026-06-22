'use client'

import { useState } from 'react'
import { FileText, ImageIcon, Loader2, MessageCircle } from 'lucide-react'
import {
  attachmentSummary,
  type DisputeChatMessageRow,
} from '../../utils/disputeChat'

type DisputeChatTranscriptPanelProps = {
  title: string
  description: string
  conversationId: string | null | undefined
  entityId: string
  endpoint: string
  requestBody: Record<string, string | boolean>
  onLoaded?: (messageCount: number) => void
}

export function DisputeChatTranscriptPanel({
  title,
  description,
  conversationId,
  entityId,
  endpoint,
  requestBody,
  onLoaded,
}: DisputeChatTranscriptPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<DisputeChatMessageRow[]>([])

  const loadChat = async () => {
    if (!entityId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
        messages?: DisputeChatMessageRow[]
      }
      if (!res.ok) {
        setError(payload.error || 'Could not load chat.')
        setMessages([])
        return
      }
      const rows = Array.isArray(payload.messages) ? payload.messages : []
      setMessages(rows)
      onLoaded?.(rows.length)
    } catch {
      setError('Network error loading chat.')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <MessageCircle className="h-5 w-5 text-amber-800 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-amber-950">{title}</h3>
          <p className="text-[11px] text-amber-900/90 mt-1 leading-relaxed">{description}</p>
          {conversationId ? (
            <p className="text-[10px] font-mono text-amber-800/80 mt-1 break-all">
              conversation_id: {conversationId}
            </p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={() => loadChat()}
        className="inline-flex items-center gap-2 rounded-lg bg-amber-900 px-3 py-2 text-xs font-bold text-white hover:bg-amber-950 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
        Load messages
      </button>
      {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}
      {messages.length > 0 ? (
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-amber-200/80 bg-white">
          {messages.map((m) => {
            const att = attachmentSummary(m)
            const when = m.created_at ? new Date(m.created_at).toLocaleString() : '—'
            const role = m.sender_role || '—'
            const body = (m.text || '').trim()
            return (
              <div
                key={m.message_id}
                className="border-b border-gray-100 px-3 py-2.5 text-xs last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                  <span className="font-mono text-gray-400">{when}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-bold uppercase text-gray-700">
                    {role}
                  </span>
                  <span className="font-semibold text-gray-800">{m.sender_display_name || 'Unknown'}</span>
                </div>
                {body ? (
                  <p className="mt-1 whitespace-pre-wrap text-gray-900">{body}</p>
                ) : att ? (
                  <p className="mt-1 flex items-center gap-1 text-gray-600">
                    {m.image_url || m.gif_url ? (
                      <ImageIcon className="h-3.5 w-3.5" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    {att}
                  </p>
                ) : (
                  <p className="mt-1 italic text-gray-400">[empty]</p>
                )}
                {m.reply_to_snippet ? (
                  <p className="mt-1 border-l-2 border-gray-200 pl-2 text-[10px] text-gray-500">
                    Replying to: {m.reply_to_snippet}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
