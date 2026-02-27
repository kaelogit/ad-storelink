'use client'

import { useState, useEffect } from 'react'
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
  Ticket, Send, ArrowLeft, ArrowRight, ShoppingBag
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

  // --- INIT ---
  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    setLoadingTickets(true)
    const { data } = await supabase
      .from('support_tickets')
      .select('*, user:user_id(email, display_name)')
      .order('created_at', { ascending: false })
    
    if (data) {
      setTickets(data.filter((ticket) => normalizeTicketStatus(ticket.status) !== 'CLOSED'))
    }
    setLoadingTickets(false)
  }

  const openTicket = async (ticketId: string) => {
    setSelectedTicketId(ticketId)
    const { data } = await supabase.rpc('get_ticket_conversation', { p_ticket_id: ticketId })
    if (data) setConversation(data)
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
        'x-idempotency-key': makeIdempotencyKey('support-order-force-status'),
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

    const { data: updated } = await supabase.rpc('get_order_details', { p_query: order.id })
    setOrder(updated)
    setPendingStatus(null)
    setFeedback({ tone: 'success', message: `Order status updated to ${status}.` })
    setActionLoading(false)
  }

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      <PageHeader
        title="Support Desk"
        subtitle="Customer care and order debugging center."
      />
      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <TabsRoot>
        <Tab
          active={activeTab === 'tickets'}
          onClick={() => { setActiveTab('tickets'); setSelectedTicketId(null); }}
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
            <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
              <CardContent className="p-0 flex-1 overflow-y-auto">
                {loadingTickets ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" /></div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[var(--background)] border-b border-[var(--border)] text-[var(--muted)] font-bold uppercase text-[10px]">
                      <tr>
                        <th className="px-6 py-4">Subject</th>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {tickets.map((ticket) => (
                        <tr key={ticket.id} onClick={() => openTicket(ticket.id)} className="hover:bg-[var(--background)]/50 cursor-pointer transition">
                          <td className="px-6 py-4 font-semibold text-[var(--foreground)]">{ticket.subject}</td>
                          <td className="px-6 py-4 text-[var(--muted)]">{ticket.user?.email || 'Guest'}</td>
                          <td className="px-6 py-4"><Badge tone={normalizeTicketStatus(ticket.status) === 'RESOLVED' ? 'success' : 'neutral'}>{normalizeTicketStatus(ticket.status)}</Badge></td>
                          <td className="px-6 py-4 text-right"><ArrowRight size={16} className="text-[var(--muted)] ml-auto" /></td>
                        </tr>
                      ))}
                      {tickets.length === 0 && <tr><td colSpan={4} className="p-12 text-center text-[var(--muted)]">No tickets pending.</td></tr>}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
        ) : (
            <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
                <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
                    <CardHeader className="py-4 flex flex-row justify-between items-center bg-[var(--background)]">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedTicketId(null)}><ArrowLeft size={18} /></Button>
                            <h2 className="font-semibold text-[var(--foreground)] text-sm">{conversation?.ticket?.subject ?? 'Loading...'}</h2>
                        </div>
                        <Button size="sm" onClick={requestResolveTicket} className="bg-emerald-600 hover:bg-emerald-700 text-white border-0">Mark Resolved</Button>
                    </CardHeader>
                    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[var(--background)]/50">
                        {(conversation?.messages ?? []).map((msg: any) => (
                            <div key={msg.id} className={`flex flex-col ${msg.is_admin_reply ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl p-4 text-sm ${msg.is_admin_reply ? 'bg-[var(--primary)] text-white rounded-br-none' : 'bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-bl-none'}`}>
                                    {msg.message}
                                </div>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={sendReply} className="p-4 border-t border-[var(--border)] flex gap-2">
                        <Input placeholder="Type reply..." className="flex-1" value={replyText} onChange={(e) => setReplyText(e.target.value)} />
                        <Button type="submit" disabled={sending} size="md"><Send size={18} /></Button>
                    </form>
                </Card>
                <Card className="w-[350px] flex flex-col overflow-hidden shrink-0">
                    <CardHeader className="py-3 bg-[var(--background)] font-bold text-xs text-[var(--muted)] uppercase flex items-center gap-2">
                        <RefreshCcw size={14} /> Diagnostic Sidekick
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                        <form onSubmit={searchOrder} className="flex gap-2 mb-4">
                            <Input placeholder="Order Ref..." className="flex-1 text-xs font-mono" value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} />
                            <Button type="submit" size="sm">Search</Button>
                        </form>
                        {order && <CompactOrderView order={order} loading={actionLoading} onForce={(status: 'COMPLETED' | 'CANCELLED') => setPendingStatus(status)} />}
                    </CardContent>
                </Card>
            </div>
        )
      )}

      {activeTab === 'ops' && (
        <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
             <CardHeader className="py-4 flex items-center gap-4 bg-[var(--background)]">
                <form onSubmit={searchOrder} className="flex gap-2 w-full max-w-lg">
                    <Input placeholder="Order UUID or Paystack Reference..." className="flex-1 text-sm font-mono" value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} />
                    <Button type="submit" disabled={loadingOrder} loading={loadingOrder}>Diagnose</Button>
                </form>
             </CardHeader>
             <CardContent className="flex-1 overflow-y-auto">
                {order ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div>
                            <div className="mb-6">
                                <span className={`text-2xl font-black ${order.status === 'COMPLETED' ? 'text-emerald-600' : order.status === 'CANCELLED' ? 'text-red-600' : 'text-[var(--foreground)]'}`}>{order.status}</span>
                                <p className="text-sm text-[var(--muted)] font-mono mt-1">Ref: {order.reference}</p>
                            </div>

                            <div className="mb-8">
                                <h4 className="text-xs font-bold text-[var(--muted)] uppercase mb-3 flex items-center gap-2"><ShoppingBag size={12}/> Order Items</h4>
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
                                <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gray-100"></div>
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
                    <div className="h-full flex flex-col items-center justify-center text-[var(--muted)]">
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

function makeIdempotencyKey(scope: string) {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${scope}-${randomPart}`
}

function normalizeTicketStatus(status: string): 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED' {
  const upper = (status || '').toUpperCase()
  if (upper === 'IN_PROGRESS') return 'PENDING'
  if (upper === 'OPEN' || upper === 'PENDING' || upper === 'RESOLVED' || upper === 'CLOSED') {
    return upper
  }
  return 'OPEN'
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
                                <div className="pt-4 border-t border-[var(--border)] space-y-2">
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
            {!isLast && <div className="absolute left-[11px] top-6 bottom-[-10px] w-0.5 bg-gray-100 -z-10"></div>}
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