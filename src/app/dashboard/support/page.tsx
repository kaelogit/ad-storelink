'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { 
  MessageSquare, Search, Package, Truck, CheckCircle, 
  XCircle, AlertTriangle, MapPin, User, Loader2, RefreshCcw, 
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

  // --- INIT ---
  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    setLoadingTickets(true)
    const { data } = await supabase
      .from('support_tickets')
      .select('*, user:user_id(email, display_name)')
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
    
    if (data) setTickets(data)
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
    
    const { error } = await supabase.from('support_messages').insert({
        ticket_id: selectedTicketId,
        sender_id: (await supabase.auth.getUser()).data.user?.id,
        is_admin_reply: true,
        message: replyText
    })
    await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', selectedTicketId)

    if (!error) {
        setReplyText('')
        const { data } = await supabase.rpc('get_ticket_conversation', { p_ticket_id: selectedTicketId })
        if (data) setConversation(data)
    }
    setSending(false)
  }

  const closeTicket = async () => {
    if (!confirm('Mark this ticket as resolved?')) return
    await supabase.from('support_tickets').update({ status: 'closed' }).eq('id', selectedTicketId)
    setSelectedTicketId(null)
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
    else alert('Order not found. Check UUID or Reference.')
    setLoadingOrder(false)
  }

  const forceUpdateStatus = async (newStatus: 'COMPLETED' | 'CANCELLED') => {
    if (!order) return
    const action = newStatus === 'COMPLETED' ? 'Force Complete' : 'Force Cancel'
    if (!confirm(`⚠️ DANGER: ${action}?`)) return

    setActionLoading(true)
    const { error } = await supabase.from('orders').update({ 
        status: newStatus,
        refund_status: newStatus === 'CANCELLED' ? 'full' : 'none'
    }).eq('id', order.id)

    if (!error) {
        await supabase.from('admin_audit_logs').insert({
            action_type: 'ORDER_INTERVENTION',
            target_id: order.id,
            details: `Support Agent forced status to ${newStatus}`
        })
        const { data: updated } = await supabase.rpc('get_order_details', { p_query: order.id })
        setOrder(updated)
    }
    setActionLoading(false)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-100px)] flex flex-col">
      
      {/* HEADER & TABS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Support Desk</h1>
            <p className="text-gray-500 text-sm">Customer care and order debugging center.</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 w-fit">
            <button 
                onClick={() => { setActiveTab('tickets'); setSelectedTicketId(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'tickets' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <Ticket size={16} /> Inbox <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">{tickets.length}</span>
            </button>
            <button 
                onClick={() => setActiveTab('ops')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'ops' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <Package size={16} /> Order Diagnostics
            </button>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      
      {/* VIEW 1: TICKET INBOX */}
      {activeTab === 'tickets' && (
        !selectedTicketId ? (
            // A. THE QUEUE
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex-1 overflow-y-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                        <tr>
                            <th className="px-6 py-4">Subject</th>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {tickets.map((ticket) => (
                            <tr key={ticket.id} onClick={() => openTicket(ticket.id)} className="hover:bg-gray-50 cursor-pointer transition">
                                <td className="px-6 py-4 font-bold text-gray-900">{ticket.subject}</td>
                                <td className="px-6 py-4 text-gray-600">{ticket.user?.email || 'Guest'}</td>
                                <td className="px-6 py-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase">{ticket.status}</span></td>
                                <td className="px-6 py-4 text-right"><ArrowRight size={16} className="text-gray-400 ml-auto" /></td>
                            </tr>
                        ))}
                        {tickets.length === 0 && <tr><td colSpan={4} className="p-12 text-center text-gray-400">Zero tickets pending.</td></tr>}
                    </tbody>
                </table>
            </div>
        ) : (
            // B. THE HIGH-END WORKSPACE (Chat + Compact Sidekick)
            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Chat */}
                <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setSelectedTicketId(null)} className="p-2 hover:bg-white rounded-lg transition"><ArrowLeft size={18} /></button>
                            <h2 className="font-bold text-gray-900 text-sm">{conversation?.ticket.subject}</h2>
                        </div>
                        <button onClick={closeTicket} className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 font-bold hover:bg-green-100">Mark Resolved</button>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50">
                        {conversation?.messages.map((msg: any) => (
                            <div key={msg.id} className={`flex flex-col ${msg.is_admin_reply ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl p-4 text-sm shadow-sm ${msg.is_admin_reply ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}`}>
                                    {msg.message}
                                </div>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={sendReply} className="p-4 bg-white border-t border-gray-200 flex gap-2">
                        <input type="text" placeholder="Type reply..." className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={replyText} onChange={(e) => setReplyText(e.target.value)} />
                        <button disabled={sending} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200"><Send size={20} /></button>
                    </form>
                </div>
                
                {/* Compact Sidekick */}
                <div className="w-[350px] bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 font-bold text-xs text-gray-500 uppercase flex items-center gap-2">
                        <RefreshCcw size={14} /> Diagnostic Sidekick
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto">
                        <form onSubmit={searchOrder} className="flex gap-2 mb-6">
                            <input type="text" placeholder="Order Ref..." className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500" value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} />
                            <button type="submit" className="bg-purple-600 text-white px-3 py-2 rounded-lg text-xs font-bold"><Search size={14} /></button>
                        </form>
                        {order && <CompactOrderView order={order} loading={actionLoading} onForce={forceUpdateStatus} />}
                    </div>
                </div>
            </div>
        )
      )}

      {/* VIEW 2: FULL ORDER OPS (Standalone) */}
      {activeTab === 'ops' && (
        <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
             <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
                <form onSubmit={searchOrder} className="flex gap-2 w-full max-w-lg">
                    <input type="text" placeholder="Paste Order UUID or Paystack Reference..." className="flex-1 px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm font-mono" value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} />
                    <button type="submit" disabled={loadingOrder} className="bg-purple-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 transition">{loadingOrder ? <Loader2 className="animate-spin h-4 w-4" /> : 'Diagnose'}</button>
                </form>
             </div>
             <div className="flex-1 p-8 overflow-y-auto">
                {order ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div>
                            {/* STATUS HEADER */}
                            <div className="mb-6">
                                <span className={`text-2xl font-black ${order.status === 'COMPLETED' ? 'text-green-600' : (order.status === 'CANCELLED' ? 'text-red-600' : 'text-gray-900')}`}>{order.status}</span>
                                <p className="text-sm text-gray-500 font-mono mt-1">Ref: {order.reference}</p>
                            </div>

                            {/* ITEM DETAILS (NEW) */}
                            <div className="mb-8">
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2"><ShoppingBag size={12}/> Order Items</h4>
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
                                        <button disabled={actionLoading} onClick={() => forceUpdateStatus('COMPLETED')} className="bg-white border border-red-200 text-red-700 font-bold py-3 rounded-lg text-xs hover:bg-red-50">Force Complete</button>
                                        <button disabled={actionLoading} onClick={() => forceUpdateStatus('CANCELLED')} className="bg-red-600 text-white font-bold py-3 rounded-lg text-xs hover:bg-red-700">Force Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Package size={48} className="mb-4 opacity-20" />
                        <p>Enter an Order ID above to begin diagnostics.</p>
                    </div>
                )}
             </div>
        </div>
      )}

    </div>
  )
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
                <div className="pt-4 border-t border-gray-100 space-y-2">
                    <button disabled={loading} onClick={() => onForce('COMPLETED')} className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-2 rounded-lg text-xs hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition">Force Complete</button>
                    <button disabled={loading} onClick={() => onForce('CANCELLED')} className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-2 rounded-lg text-xs hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition">Force Cancel</button>
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