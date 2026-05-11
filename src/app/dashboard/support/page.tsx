'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ConfirmActionModal } from '../../../components/admin/ConfirmActionModal'
import { parseApiError } from '../../../utils/http'
import { Card, CardHeader, CardContent, Button, Badge, Input } from '../../../components/ui'
import { TabsRoot, Tab } from '../../../components/ui'
import {
  Search, Package, Truck, CheckCircle, AlertTriangle, Loader2, RefreshCcw,
  Ticket, Send, ArrowLeft, ArrowRight, ShoppingBag, User, ExternalLink, Copy,
} from 'lucide-react'

export default function SupportWorkspace() {
  const supabase = createClient()
  
  // 1. TOP LEVEL NAVIGATION
  const [activeTab, setActiveTab] = useState<'tickets' | 'ops'>('tickets')
  
  // 2. TICKET STATE
  const [tickets, setTickets] = useState<any[]>([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<any>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  // 3. ORDER OPS STATE
  const [orderQuery, setOrderQuery] = useState('')
  const [order, setOrder] = useState<any>(null)
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<'COMPLETED' | 'CANCELLED' | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [showResolveConfirm, setShowResolveConfirm] = useState(false)
  const [ticketsLoadError, setTicketsLoadError] = useState<string | null>(null)
  const [ticketsInfoBanner, setTicketsInfoBanner] = useState<string | null>(null)
  const [ticketUserProfile, setTicketUserProfile] = useState<{
    email?: string | null
    display_name?: string | null
  } | null>(null)

  // --- INIT ---
  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    setLoadingTickets(true)
    setTicketsLoadError(null)
    setTicketsInfoBanner(null)
    // Prefer FK join (migration adds support_tickets_user_id_fkey). Fallback: list tickets without profile embed.
    let data: any[] | null = null
    let error: { message: string } | null = null

    const withProfiles = await supabase
      .from('support_tickets')
      .select(
        `
        *,
        profiles!support_tickets_user_id_fkey (
          email,
          display_name
        )
      `
      )
      .order('created_at', { ascending: false })

    if (withProfiles.error) {
      const plain = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false })
      data = plain.data
      error = plain.error
      if (error) {
        setTicketsLoadError(error.message)
        setTickets([])
        setLoadingTickets(false)
        return
      }
      setTicketsInfoBanner(
        'User emails in the list need FK support_tickets → profiles. Run migration 20260622000000. Open a ticket to load profile from the user id.'
      )
    } else {
      data = withProfiles.data
    }

    if (data) {
      setTickets(data.filter((ticket) => normalizeTicketStatus(ticket.status) !== 'CLOSED'))
    }
    setLoadingTickets(false)
  }

  const openTicket = async (ticketId: string) => {
    setSelectedTicketId(ticketId)
    setTicketUserProfile(null)
    const { data } = await supabase.rpc('get_ticket_conversation', { p_ticket_id: ticketId })
    if (data) {
      setConversation(data)
      const uid = (data as { ticket?: { user_id?: string | null } }).ticket?.user_id
      if (uid) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('email, display_name')
          .eq('id', uid)
          .maybeSingle()
        if (prof) setTicketUserProfile(prof)
      }
    }
  }

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || !selectedTicketId) return
    setSending(true)
    setFeedback({ tone: 'info', message: 'Sending reply...' })
    
    const response = await fetch('/api/admin/support/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: selectedTicketId,
        message: replyText,
      }),
    })

    if (response.ok) {
      setReplyText('')
      const { data } = await supabase.rpc('get_ticket_conversation', { p_ticket_id: selectedTicketId })
      if (data) setConversation(data)
      setFeedback({ tone: 'success', message: 'Reply sent.' })
    } else {
      const errorMessage = await parseApiError(response, 'Failed to send reply.')
      setFeedback({ tone: 'error', message: errorMessage })
    }
    setSending(false)
  }

  const requestResolveTicket = () => {
    setShowResolveConfirm(true)
  }

  const closeTicket = async () => {
    setShowResolveConfirm(false)
    setFeedback({ tone: 'info', message: 'Resolving ticket...' })
    const response = await fetch('/api/admin/support/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: selectedTicketId,
      }),
    })
    if (!response.ok) {
      const errorMessage = await parseApiError(response, 'Failed to resolve ticket.')
      setFeedback({ tone: 'error', message: errorMessage })
      return
    }
    setSelectedTicketId(null)
    setFeedback({ tone: 'success', message: 'Ticket resolved.' })
    fetchTickets()
  }

  // --- ORDER OPS LOGIC ---
  const searchOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderQuery) return
    setLoadingOrder(true)
    setOrder(null)
    const { data } = await supabase.rpc('get_order_details', { p_query: orderQuery.trim() })
    if (data) setOrder(data)
    else setFeedback({ tone: 'error', message: 'Order not found. Check UUID or reference.' })
    setLoadingOrder(false)
  }

  const forceUpdateStatus = async ({
    status,
    reason,
    category,
  }: {
    status: 'COMPLETED' | 'CANCELLED'
    reason: string
    category: string
  }) => {
    if (!order) return
    setActionLoading(true)
    setFeedback({ tone: 'info', message: `Applying order status ${status}...` })
    const response = await fetch('/api/admin/orders/force-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `support-order-force-status-${order.id}-${status}`,
      },
      body: JSON.stringify({
        orderId: order.id,
        newStatus: status,
        reasonCategory: category,
        reason,
      }),
    })

    if (!response.ok) {
      const errorMessage = await parseApiError(response, 'Failed to update order status.')
      setFeedback({ tone: 'error', message: errorMessage })
      setActionLoading(false)
      return
    }
    const payload = (await response.json().catch(() => ({}))) as {
      refund?: { executed?: boolean; paystackReference?: string | null }
      mode?: string
    }

    const { data: updated } = await supabase.rpc('get_order_details', { p_query: order.id })
    setOrder(updated)
    setPendingStatus(null)
    const refundMsg =
      status === 'CANCELLED'
        ? payload?.refund?.executed
          ? ` Refund executed${payload.refund.paystackReference ? ` (${payload.refund.paystackReference})` : ''}.`
          : ''
        : ''
    setFeedback({ tone: 'success', message: `Order status updated to ${status}.${refundMsg}`.trim() })
    setActionLoading(false)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:min-h-[calc(100dvh-7rem)]">
      <PageHeader
        title="Support Desk"
        subtitle="Customer care and order debugging center."
      />
      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}
      {ticketsLoadError && (
        <ActionFeedback tone="error" message={ticketsLoadError} />
      )}
      {ticketsInfoBanner && <ActionFeedback tone="info" message={ticketsInfoBanner} />}

      <TabsRoot>
        <Tab
          active={activeTab === 'tickets'}
          onClick={() => {
            setActiveTab('tickets')
            setSelectedTicketId(null)
            setTicketUserProfile(null)
          }}
        >
          <span className="flex items-center gap-2">
            <Ticket size={16} /> Inbox {tickets.length > 0 && <Badge tone="neutral">{tickets.length}</Badge>}
          </span>
        </Tab>
        <Tab active={activeTab === 'ops'} onClick={() => setActiveTab('ops')}>
          <span className="flex items-center gap-2"><Package size={16} /> Order Diagnostics</span>
        </Tab>
      </TabsRoot>

      {/* --- CONTENT AREA --- */}
      
      {activeTab === 'tickets' && (
        !selectedTicketId ? (
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CardContent className="p-0 flex-1 overflow-y-auto">
                {loadingTickets ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-(--primary)" /></div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-background border-b border-(--border) text-(--muted) font-bold uppercase text-[10px]">
                      <tr>
                        <th className="px-6 py-4">Subject</th>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-(--border)">
                      {tickets.map((ticket) => (
                        <tr key={ticket.id} onClick={() => openTicket(ticket.id)} className="hover:bg-(--background)/50 cursor-pointer transition">
                          <td className="px-6 py-4 font-semibold text-foreground">{ticket.subject}</td>
                          <td className="px-6 py-4 text-(--muted)">
                            {(ticket as { profiles?: { email?: string | null } }).profiles?.email ||
                              (ticket as { user_id?: string | null }).user_id?.slice(0, 8) ||
                              'Guest'}
                          </td>
                          <td className="px-6 py-4"><Badge tone={normalizeTicketStatus(ticket.status) === 'RESOLVED' ? 'success' : 'neutral'}>{normalizeTicketStatus(ticket.status)}</Badge></td>
                          <td className="px-6 py-4 text-right"><ArrowRight size={16} className="text-(--muted) ml-auto" /></td>
                        </tr>
                      ))}
                      {tickets.length === 0 && <tr><td colSpan={4} className="p-12 text-center text-(--muted)">No tickets pending.</td></tr>}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
        ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:gap-5">
                <Card className="flex min-h-[min(520px,calc(100dvh-12rem))] flex-col overflow-hidden lg:min-h-[calc(100dvh-13rem)]">
                    <CardHeader className="flex shrink-0 flex-col gap-3 border-b border-(--border) bg-background py-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0"
                              onClick={() => {
                                setSelectedTicketId(null)
                                setTicketUserProfile(null)
                              }}
                            >
                              <ArrowLeft size={18} />
                            </Button>
                            <div className="min-w-0 flex-1 space-y-2">
                              <h2 className="text-base font-semibold text-foreground leading-snug">
                                {conversation?.ticket?.subject ?? 'Loading...'}
                              </h2>
                              <TicketUserBar
                                userId={conversation?.ticket?.user_id as string | undefined}
                                profile={ticketUserProfile}
                              />
                            </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={requestResolveTicket}
                          className="shrink-0 border-0 bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Mark Resolved
                        </Button>
                    </CardHeader>
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-(--background)/50 p-4 sm:p-6">
                        {normalizeThreadMessages(conversation).map((msg, i) => (
                            <div
                              key={msg.id ?? `thread-${i}`}
                              className={`flex flex-col ${msg.is_admin_reply ? 'items-end' : 'items-start'}`}
                            >
                                <div
                                  className={`max-w-[min(100%,42rem)] rounded-2xl px-4 py-3 text-[15px] leading-relaxed sm:text-base ${msg.is_admin_reply ? 'bg-(--primary) text-white rounded-br-none' : 'border border-(--border) bg-(--surface) text-foreground rounded-bl-none'}`}
                                >
                                    {msg.message}
                                </div>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={sendReply} className="flex shrink-0 flex-col gap-3 border-t border-(--border) bg-(--surface) p-4 sm:flex-row sm:items-end">
                        <textarea
                          placeholder="Type your reply…"
                          className="min-h-30 flex-1 resize-y rounded-(--radius) border border-(--border) bg-background px-3 py-3 text-[15px] text-foreground placeholder-(--muted) focus:border-(--primary) focus:outline-none focus:ring-1 focus:ring-(--primary) disabled:opacity-50 sm:min-h-35"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          disabled={sending}
                        />
                        <Button
                          type="submit"
                          disabled={sending}
                          size="md"
                          className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 sm:h-11 sm:w-auto sm:min-w-14 sm:self-stretch"
                        >
                          <Send size={18} />
                          <span className="sm:sr-only">Send reply</span>
                        </Button>
                    </form>
                </Card>
                <Card className="flex max-h-80 min-h-0 flex-col overflow-hidden lg:max-h-none">
                    <CardHeader className="flex shrink-0 flex-row items-center gap-2 bg-background py-3 text-xs font-bold uppercase text-(--muted)">
                        <RefreshCcw size={14} /> Diagnostic Sidekick
                    </CardHeader>
                    <CardContent className="min-h-0 flex-1 overflow-y-auto">
                        <form onSubmit={searchOrder} className="mb-4 flex gap-2">
                            <Input
                              placeholder="Order Ref..."
                              className="flex-1 font-mono text-xs"
                              value={orderQuery}
                              onChange={(e) => setOrderQuery(e.target.value)}
                            />
                            <Button type="submit" size="sm">
                              Search
                            </Button>
                        </form>
                        {order && (
                          <CompactOrderView
                            order={order}
                            loading={actionLoading}
                            onForce={(status: 'COMPLETED' | 'CANCELLED') => setPendingStatus(status)}
                          />
                        )}
                    </CardContent>
                </Card>
            </div>
        )
      )}

      {activeTab === 'ops' && (
        <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
             <CardHeader className="py-4 flex items-center gap-4 bg-background">
                <form onSubmit={searchOrder} className="flex gap-2 w-full max-w-lg">
                    <Input placeholder="Order UUID or Paystack Reference..." className="flex-1 text-sm font-mono" value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} />
                    <Button type="submit" disabled={loadingOrder} loading={loadingOrder}>Lookup</Button>
                </form>
             </CardHeader>
             <CardContent className="flex-1 overflow-y-auto">
                {order ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div>
                            <div className="mb-6">
                                <span className={`text-2xl font-black ${order.status === 'COMPLETED' ? 'text-(--success)' : order.status === 'CANCELLED' ? 'text-(--danger)' : 'text-foreground'}`}>{order.status}</span>
                                <p className="text-sm text-(--muted) font-mono mt-1">Ref: {order.reference}</p>
                            </div>

                            <div className="mb-8">
                                <h4 className="text-xs font-bold text-(--muted) uppercase mb-3 flex items-center gap-2"><ShoppingBag size={12}/> Order Items</h4>
                                <div className="space-y-3">
                                    {order.items?.map((item: any, i: number) => (
                                        <div key={i} className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <div className="h-12 w-12 bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                <img src={item.image} className="h-full w-full object-cover" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{item.name}</p>
                                                <p className="text-xs text-gray-500">{item.quantity} x ₦{item.price.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {(!order.items || order.items.length === 0) && <p className="text-xs text-gray-400 italic">No item details available.</p>}
                                </div>
                            </div>

                            {/* TIMELINE */}
                            <div className="space-y-6 relative pl-2">
                                <div className="absolute left-4.75 top-2 bottom-2 w-0.5 bg-gray-100"></div>
                                <TimelineItem icon={Package} label="Created" date={order.created_at} active={true} />
                                <TimelineItem icon={CheckCircle} label="Paid (Escrow)" date={order.created_at} active={true} />
                                <TimelineItem icon={Truck} label="Shipped" date={order.shipped_at} active={!!order.shipped_at} />
                                <TimelineItem icon={CheckCircle} label="Complete" date={order.status === 'COMPLETED' ? order.updated_at : null} active={order.status === 'COMPLETED'} isLast />
                            </div>
                        </div>

                        {/* ACTIONS (RIGHT COLUMN) */}
                        <div className="space-y-6">
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm space-y-2">
                                <div className="flex justify-between"><span className="text-gray-500">Buyer</span> <span className="font-bold">{order.buyer.email}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Seller</span> <span className="font-bold">{order.seller.email}</span></div>
                            </div>
                            
                            {/* SMART INTERVENTION ZONE */}
                            {['COMPLETED', 'CANCELLED'].includes(order.status) ? (
                                <div className="bg-gray-100 border border-gray-200 rounded-xl p-6 text-center">
                                    <CheckCircle size={32} className="mx-auto mb-2 text-gray-400" />
                                    <p className="font-bold text-gray-600">Case Closed</p>
                                    <p className="text-xs text-gray-400">This order is finalized. No further actions allowed.</p>
                                </div>
                            ) : (
                                <div className="bg-red-50 border border-red-100 rounded-xl p-6">
                                    <h4 className="text-sm font-bold text-red-800 uppercase mb-4 flex items-center gap-2"><AlertTriangle size={16}/> Intervention Zone</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Button variant="secondary" disabled={actionLoading} onClick={() => setPendingStatus('COMPLETED')} className="border-red-200 text-red-700 hover:bg-red-50">Force Complete</Button>
                                        <Button variant="danger" disabled={actionLoading} onClick={() => setPendingStatus('CANCELLED')}>Force Cancel</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-(--muted)">
                        <Package size={48} className="mb-4 opacity-20" />
                        <p>Enter an Order ID above to begin diagnostics.</p>
                    </div>
                )}
             </CardContent>
        </Card>
      )}

      <ConfirmActionModal
        open={showResolveConfirm}
        title="Mark ticket as resolved?"
        description="This will close the ticket and remove it from your active queue."
        impactSummary="The ticket will be marked resolved. The user can open a new ticket if they need further help."
        confirmLabel="Mark resolved"
        onClose={() => setShowResolveConfirm(false)}
        onConfirm={closeTicket}
      />

      <ActionReasonModal
        open={pendingStatus !== null}
        title={pendingStatus === 'COMPLETED' ? 'Confirm Force Complete' : 'Confirm Force Cancel'}
        description="Provide a structured reason for this support intervention."
        impactSummary={
          pendingStatus === 'COMPLETED'
            ? 'Order will be marked complete and funds released to the seller.'
            : 'Order will be cancelled and buyer refunded.'
        }
        categoryOptions={[
          { value: 'fraud', label: 'Fraud risk' },
          { value: 'payment_issue', label: 'Payment issue' },
          { value: 'customer_request', label: 'Customer request' },
          { value: 'fulfillment_issue', label: 'Fulfillment issue' },
          { value: 'compliance', label: 'Compliance' },
          { value: 'other', label: 'Other' },
        ]}
        submitting={actionLoading}
        onClose={() => setPendingStatus(null)}
        onSubmit={({ category, reason }) => {
          if (!pendingStatus) return
          return forceUpdateStatus({ status: pendingStatus, category, reason })
        }}
      />
    </div>
  )
}

function TicketUserBar({
  userId,
  profile,
}: {
  userId?: string
  profile: { email?: string | null; display_name?: string | null } | null
}) {
  if (!userId) {
    return <p className="text-xs text-(--muted)">No user linked to this ticket.</p>
  }

  const usersHref = `/dashboard/users?q=${encodeURIComponent(userId)}`

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-(--border) bg-(--surface) px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2">
        <User className="mt-0.5 h-4 w-4 shrink-0 text-(--muted)" />
        <div className="min-w-0">
          {profile?.display_name ? (
            <p className="truncate text-sm font-medium text-foreground">{profile.display_name}</p>
          ) : null}
          {profile?.email ? (
            <p className="truncate text-xs text-(--muted)">{profile.email}</p>
          ) : (
            <p className="font-mono text-[11px] text-(--muted)" title={userId}>
              {userId.slice(0, 8)}…{userId.slice(-4)}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-(--border) bg-background px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-(--surface)"
          onClick={() => {
            void navigator.clipboard.writeText(userId)
          }}
        >
          <Copy className="h-3.5 w-3.5" />
          Copy user ID
        </button>
        <Link
          href={usersHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-(--primary) px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white hover:opacity-90"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open profile
        </Link>
      </div>
    </div>
  )
}

function normalizeTicketStatus(status: string): 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED' {
  const upper = (status || '').toUpperCase()
  if (upper === 'IN_PROGRESS') return 'PENDING'
  if (upper === 'OPEN' || upper === 'PENDING' || upper === 'RESOLVED' || upper === 'CLOSED') {
    return upper
  }
  return 'OPEN'
}

/** App historically stored the first user message only on support_tickets.message; thread RPC lists support_messages only. */
type ThreadMsg = {
  id?: string | null
  message?: string | null
  is_admin_reply?: boolean | null
  created_at?: string | null
}

function sortThreadByTime(msgs: ThreadMsg[]): ThreadMsg[] {
  return [...msgs].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return ta - tb
  })
}

function normalizeThreadMessages(conversation: { ticket?: Record<string, unknown>; messages?: ThreadMsg[] } | null): ThreadMsg[] {
  const ticket = conversation?.ticket as
    | { id?: string; message?: string | null; created_at?: string | null }
    | undefined
  const raw: ThreadMsg[] = [...(conversation?.messages ?? [])]
  const initial = typeof ticket?.message === 'string' ? ticket.message.trim() : ''
  if (!initial) return sortThreadByTime(raw)

  const hasSame = raw.some(
    (m) =>
      !m.is_admin_reply &&
      typeof m.message === 'string' &&
      m.message.trim() === initial
  )
  if (hasSame) return sortThreadByTime(raw)

  return sortThreadByTime([
    {
      id: ticket?.id ? `ticket-initial-${ticket.id}` : 'ticket-initial',
      message: initial,
      is_admin_reply: false,
      created_at: ticket?.created_at ?? null,
    },
    ...raw,
  ])
}

// --- SUB COMPONENTS ---

function CompactOrderView({ order, loading, onForce }: any) {
    const isTerminal = ['COMPLETED', 'CANCELLED'].includes(order.status);
    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className={`p-4 rounded-xl border text-center ${order.status === 'CANCELLED' ? 'bg-red-50 border-red-100' : 'bg-purple-50 border-purple-100'}`}>
                <p className="text-xs font-bold uppercase opacity-60">Status</p>
                <p className="text-xl font-black">{order.status}</p>
            </div>
            
            {/* COMPACT ITEMS LIST */}
            <div className="space-y-2">
                {order.items?.slice(0, 2).map((item: any, i: number) => (
                    <div key={i} className="flex gap-3 items-center text-xs border-b border-gray-50 pb-2">
                        <img src={item.image} className="h-8 w-8 rounded bg-gray-100 object-cover" />
                        <div>
                            <p className="font-bold text-gray-800 truncate w-40">{item.name}</p>
                            <p className="text-gray-400">₦{item.price.toLocaleString()}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="space-y-3 pt-2">
                <TimelineItem icon={Package} label="Created" date={order.created_at} active={true} compact />
                <TimelineItem icon={Truck} label="Shipped" date={order.shipped_at} active={!!order.shipped_at} compact />
                <TimelineItem icon={CheckCircle} label="Complete" date={order.status === 'COMPLETED' ? order.updated_at : null} active={order.status === 'COMPLETED'} isLast compact />
            </div>
            
                            {!isTerminal && (
                                <div className="pt-4 border-t border-(--border) space-y-2">
                                    <Button variant="secondary" size="sm" className="w-full" disabled={loading} onClick={() => onForce('COMPLETED')}>Force Complete</Button>
                                    <Button variant="danger" size="sm" className="w-full" disabled={loading} onClick={() => onForce('CANCELLED')}>Force Cancel</Button>
                                </div>
                            )}
        </div>
    )
}

function TimelineItem({ icon: Icon, label, date, active, isLast, compact }: any) {
    return (
        <div className="flex gap-3 relative z-10">
            {!isLast && <div className="absolute left-2.75 top-6 -bottom-2.5 w-0.5 bg-gray-100 -z-10"></div>}
            <div className={`h-6 w-6 rounded-full flex items-center justify-center border-2 shrink-0 ${active ? 'bg-purple-600 border-purple-100 text-white' : 'bg-gray-100 border-gray-200 text-gray-300'}`}>
                <Icon size={10} />
            </div>
            <div>
                <p className={`text-xs font-bold ${active ? 'text-gray-900' : 'text-gray-400'}`}>{label}</p>
                <p className="text-[10px] text-gray-400 font-mono">{date ? new Date(date).toLocaleDateString() : '...'}</p>
            </div>
        </div>
    )
}