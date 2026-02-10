'use client'

import { useState } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { 
  Search, Package, Truck, CheckCircle, XCircle, AlertTriangle, 
  MapPin, User, ArrowRight, Loader2, RefreshCcw
} from 'lucide-react'

export default function OrderOps() {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const searchOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query) return
    
    setLoading(true)
    setOrder(null)
    const { data, error } = await supabase.rpc('get_order_details', { p_query: query.trim() })
    
    if (data) setOrder(data)
    else if (!data) alert('Order not found. Check UUID or Reference.')
    
    setLoading(false)
  }

  const forceUpdateStatus = async (newStatus: 'COMPLETED' | 'CANCELLED') => {
    const action = newStatus === 'COMPLETED' ? 'Force Complete (Release Funds)' : 'Force Cancel (Refund Buyer)'
    if (!confirm(`⚠️ DANGER: You are about to ${action}.\n\nThis overrides all checks. Are you sure?`)) return

    setActionLoading(true)
    
    // 1. Update Order
    const { error } = await supabase
      .from('orders')
      .update({ 
        status: newStatus,
        // If cancelling, mark for full refund logic
        refund_status: newStatus === 'CANCELLED' ? 'full' : 'none'
      })
      .eq('id', order.id)

    if (!error) {
        // 2. Audit Log
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('admin_audit_logs').insert({
            admin_id: user?.id,
            action_type: 'ORDER_INTERVENTION',
            target_id: order.id,
            details: `Forced status to ${newStatus}`
        })
        
        // Refresh
        const { data: updated } = await supabase.rpc('get_order_details', { p_query: order.id })
        setOrder(updated)
    }
    setActionLoading(false)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Transaction Ops</h1>
            <p className="text-gray-500 text-sm">Debug orders and intervene in stuck transactions.</p>
        </div>
        <form onSubmit={searchOrder} className="flex gap-2 w-full md:w-96">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Paste Order UUID or Paystack Ref..." 
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>
            <button type="submit" disabled={loading} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black transition">
                {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Lookup'}
            </button>
        </form>
      </div>

      {/* Main Content */}
      {order ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT: Timeline & Status */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Status Card */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Current Status</p>
                        <span className={`text-2xl font-black ${getStatusColor(order.status)}`}>{order.status}</span>
                        {order.dispute && (
                            <div className="mt-2 flex items-center gap-2 text-orange-600 bg-orange-50 px-2 py-1 rounded text-xs font-bold w-fit">
                                <AlertTriangle size={12} /> Dispute Active: {order.dispute.reason}
                            </div>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Value</p>
                        <span className="text-2xl font-mono text-gray-900">{order.currency} {order.amount.toLocaleString()}</span>
                    </div>
                </div>

                {/* The Timeline */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-900 mb-6">Order Timeline</h3>
                    <div className="space-y-6 relative pl-2">
                        {/* Vertical Line */}
                        <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gray-100"></div>

                        <TimelineItem 
                            icon={Package} 
                            label="Order Created" 
                            date={order.created_at} 
                            active={true} 
                        />
                        <TimelineItem 
                            icon={CheckCircle} 
                            label="Payment Secured (Escrow)" 
                            date={order.created_at} 
                            active={true} 
                        />
                        <TimelineItem 
                            icon={Truck} 
                            label="Marked as Shipped" 
                            date={order.shipped_at} 
                            active={!!order.shipped_at} 
                        />
                        <TimelineItem 
                            icon={CheckCircle} 
                            label="Completed & Funds Released" 
                            date={order.status === 'COMPLETED' ? order.updated_at : null} 
                            active={order.status === 'COMPLETED'} 
                            isLast
                        />
                    </div>
                </div>

            </div>

            {/* RIGHT: Participants & Controls */}
            <div className="lg:col-span-1 space-y-6">
                
                {/* Participants */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-xs text-gray-500 uppercase">Parties Involved</div>
                    <div className="p-4 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="bg-blue-100 p-2 rounded-full text-blue-600"><User size={16} /></div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Buyer</p>
                                <p className="font-bold text-gray-900">{order.buyer.name}</p>
                                <p className="text-xs text-gray-500">{order.buyer.email}</p>
                                <p className="text-xs text-gray-500">{order.buyer.phone}</p>
                            </div>
                        </div>
                        <hr className="border-gray-100" />
                        <div className="flex items-start gap-3">
                            <div className="bg-purple-100 p-2 rounded-full text-purple-600"><User size={16} /></div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Seller</p>
                                <p className="font-bold text-gray-900">{order.seller.name}</p>
                                <p className="text-xs text-gray-500">{order.seller.email}</p>
                                <p className="text-xs text-gray-500">{order.seller.phone}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Shipping Info */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
                    <div className="flex items-start gap-3">
                        <div className="bg-gray-100 p-2 rounded-full text-gray-600"><MapPin size={16} /></div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Delivery Address</p>
                            <p className="text-sm text-gray-800 mt-1 leading-relaxed">{order.shipping_address}</p>
                        </div>
                    </div>
                </div>

                {/* INTERVENTION ZONE (Danger) */}
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-red-800 uppercase mb-3 flex items-center gap-2">
                        <AlertTriangle size={14} /> Intervention Zone
                    </h4>
                    <p className="text-[10px] text-red-600/80 mb-4">
                        Manually overriding order status skips normal safety checks. Use with caution.
                    </p>
                    <div className="space-y-2">
                        <button 
                            disabled={actionLoading}
                            onClick={() => forceUpdateStatus('COMPLETED')}
                            className="w-full bg-white border border-red-200 text-red-700 font-bold py-2 rounded text-xs hover:bg-red-100 transition flex items-center justify-center gap-2"
                        >
                            {actionLoading ? <Loader2 size={14} className="animate-spin"/> : <RefreshCcw size={14}/>}
                            Force Complete (Release)
                        </button>
                        <button 
                            disabled={actionLoading}
                            onClick={() => forceUpdateStatus('CANCELLED')}
                            className="w-full bg-red-600 text-white font-bold py-2 rounded text-xs hover:bg-red-700 transition flex items-center justify-center gap-2"
                        >
                            {actionLoading ? <Loader2 size={14} className="animate-spin"/> : <XCircle size={14}/>}
                            Force Cancel (Refund)
                        </button>
                    </div>
                </div>

            </div>
        </div>
      ) : (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl h-96 flex flex-col items-center justify-center text-gray-400 text-center p-8">
            <Search size={48} className="mb-4 opacity-20" />
            <p className="font-medium text-sm">Enter an Order ID or Reference to begin diagnostics.</p>
        </div>
      )}
    </div>
  )
}

function TimelineItem({ icon: Icon, label, date, active, isLast }: any) {
    return (
        <div className="flex gap-4 relative z-10">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center border-4 ${active ? 'bg-green-600 border-green-100 text-white' : 'bg-gray-200 border-gray-50 text-gray-400'}`}>
                <Icon size={14} />
            </div>
            <div className="pt-1.5">
                <p className={`text-sm font-bold ${active ? 'text-gray-900' : 'text-gray-400'}`}>{label}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{date ? new Date(date).toLocaleString() : 'Pending...'}</p>
            </div>
        </div>
    )
}

function getStatusColor(status: string) {
    switch (status) {
        case 'COMPLETED': return 'text-green-600'
        case 'CANCELLED': return 'text-red-600'
        case 'PAID': return 'text-blue-600'
        case 'SHIPPED': return 'text-purple-600'
        default: return 'text-gray-600'
    }
}