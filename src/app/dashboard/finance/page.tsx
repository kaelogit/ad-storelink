'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { 
  Gavel, Wallet, TrendingUp, AlertTriangle, CheckCircle, XCircle, 
  MessageSquare, Loader2, ArrowRight, DollarSign, Scale, Eye, Landmark
} from 'lucide-react'

export default function FinanceCenter() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tribunal' | 'watchtower'>('tribunal')
  
  // Data States
  const [stats, setStats] = useState<any>({ escrow_balance: 0, pending_payouts: 0, payout_count: 0 })
  const [disputes, setDisputes] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  
  // Tribunal State
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [caseLoading, setCaseLoading] = useState(false)

  useEffect(() => {
    initData()
  }, [])

  const initData = async () => {
    setLoading(true)
    await Promise.all([fetchStats(), fetchDisputes(), fetchPayouts()])
    setLoading(false)
  }

  const fetchStats = async () => {
    const { data } = await supabase.rpc('get_finance_overview')
    if (data) setStats(data)
  }

  const fetchDisputes = async () => {
    const { data } = await supabase
      .from('disputes')
      .select('*, orders(total_amount, currency_code)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
    if (data) setDisputes(data)
  }

  const fetchPayouts = async () => {
    const { data } = await supabase
      .from('payouts')
      .select('*, profiles(display_name, bank_name, account_number)')
      .eq('status', 'pending')
      .order('amount', { ascending: false }) // Highest value first (Risk priority)
    if (data) setPayouts(data)
  }

  // --- ACTIONS ---

  const processPayout = async (payoutId: string, action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this payout?`)) return
    
    // 1. Update Payout Status
    const status = action === 'approve' ? 'processed' : 'rejected'
    await supabase.from('payouts').update({ status }).eq('id', payoutId)

    // 2. If rejected, refund coins to user (Logic needed in real app)
    // 3. Log it
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('admin_audit_logs').insert({
        action_type: `PAYOUT_${action.toUpperCase()}`,
        target_id: payoutId,
        details: `Payout ${status} by admin.`
    })
    
    fetchPayouts()
    fetchStats()
  }

  const openCourtroom = async (disputeId: string) => {
    setCaseLoading(true)
    setSelectedCase(null)
    const { data } = await supabase.rpc('get_dispute_dossier', { p_dispute_id: disputeId })
    if (data) setSelectedCase(data)
    setCaseLoading(false)
  }

  const deliverVerdict = async (verdict: 'refunded_buyer' | 'released_seller') => {
    if (!selectedCase) return
    const action = verdict === 'refunded_buyer' ? 'Refund Buyer' : 'Release to Seller'
    if (!confirm(`Verdict: ${action}. Proceed?`)) return

    await supabase.from('disputes').update({ 
        status: verdict,
        admin_verdict: `Resolved via Tribunal: ${action}`,
        resolved_at: new Date().toISOString()
    }).eq('id', selectedCase.dispute_id)

    const newOrderStatus = verdict === 'refunded_buyer' ? 'CANCELLED' : 'COMPLETED'
    await supabase.from('orders').update({ 
        status: newOrderStatus,
        refund_status: verdict === 'refunded_buyer' ? 'full' : 'none'
    }).eq('id', selectedCase.order_ref)

    setSelectedCase(null)
    fetchDisputes()
    fetchStats() // Update Escrow Balance
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* 1. THE VAULT (Top Overview) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest">Escrow Vault</h3>
                <div className="bg-blue-50 text-blue-600 p-2 rounded-full"><Landmark size={16} /></div>
            </div>
            <p className="text-2xl font-bold text-gray-900">₦{stats.escrow_balance?.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500 mt-1">Funds currently locked in trust</p>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest">Pending Outflows</h3>
                <div className="bg-orange-50 text-orange-600 p-2 rounded-full"><TrendingUp size={16} /></div>
            </div>
            <p className="text-2xl font-bold text-gray-900">₦{stats.pending_payouts?.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500 mt-1">{stats.payout_count} requests waiting</p>
        </div>

        <div className="bg-gray-900 p-5 rounded-xl text-white flex items-center justify-between">
            <div>
                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest">System Health</h3>
                <p className="text-lg font-bold mt-1">Operational</p>
            </div>
            <div className="h-10 w-10 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/50">
                <CheckCircle size={20} className="text-green-400" />
            </div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
            <button onClick={() => setActiveTab('tribunal')} className={`pb-4 text-sm font-medium border-b-2 transition ${activeTab === 'tribunal' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                Dispute Tribunal <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs ml-2">{disputes.length}</span>
            </button>
            <button onClick={() => setActiveTab('watchtower')} className={`pb-4 text-sm font-medium border-b-2 transition ${activeTab === 'watchtower' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                Withdrawal Watchtower <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs ml-2">{payouts.length}</span>
            </button>
        </nav>
      </div>

      {/* 3. MAIN CONTENT AREA */}
      {activeTab === 'tribunal' ? (
        // --- TRIBUNAL VIEW (Same as before, but compact) ---
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl overflow-hidden h-[70vh] overflow-y-auto">
                {disputes.map((dispute) => (
                    <div key={dispute.id} onClick={() => openCourtroom(dispute.id)} className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${selectedCase?.dispute_id === dispute.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}>
                        <div className="flex justify-between mb-1"><span className="font-bold text-sm text-gray-900 line-clamp-1">{dispute.reason}</span></div>
                        <div className="flex justify-between items-center"><span className="text-xs text-gray-500">₦{dispute.orders?.total_amount}</span><span className="text-[10px] text-gray-400">{new Date(dispute.created_at).toLocaleDateString()}</span></div>
                    </div>
                ))}
                {disputes.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No active disputes.</div>}
            </div>

            <div className="lg:col-span-2">
                {selectedCase ? (
                    <div className="bg-white border border-gray-200 rounded-xl h-[70vh] flex flex-col">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <span className="font-bold text-gray-900 flex items-center gap-2"><AlertTriangle size={16} className="text-orange-500"/> Dispute #{selectedCase.dispute_id.slice(0,6)}</span>
                            <span className="text-xs bg-white border px-2 py-1 rounded">Escrow: ₦{selectedCase.amount_held}</span>
                        </div>
                        <div className="flex-1 grid grid-cols-2 divide-x divide-gray-100 overflow-hidden">
                            <div className="p-4 overflow-y-auto">
                                <h4 className="text-[10px] font-bold uppercase text-gray-400 mb-2">Evidence</h4>
                                <p className="text-sm bg-red-50 p-3 rounded text-red-800 mb-4">"{selectedCase.reason}"</p>
                                <div className="grid grid-cols-2 gap-2">{selectedCase.evidence_images?.map((img:string, i:number)=>(<a key={i} href={img} target="_blank"><img src={img} className="rounded border h-20 w-full object-cover"/></a>))}</div>
                            </div>
                            <div className="flex flex-col bg-gray-50/50">
                                <div className="p-2 border-b text-[10px] font-bold text-gray-400 uppercase text-center">Chat Log</div>
                                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                                    {selectedCase.chat_logs.map((msg:any, i:number)=>(<div key={i} className={`text-xs p-2 rounded max-w-[85%] ${msg.role==='buyer'?'bg-blue-100 self-start':'bg-white border self-end ml-auto'}`}>{msg.text || '[Image]'}</div>))}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t flex gap-2">
                            <button onClick={()=>deliverVerdict('refunded_buyer')} className="flex-1 bg-red-600 text-white py-2 rounded font-bold text-sm hover:bg-red-700">Refund Buyer</button>
                            <button onClick={()=>deliverVerdict('released_seller')} className="flex-1 bg-green-600 text-white py-2 rounded font-bold text-sm hover:bg-green-700">Release to Seller</button>
                        </div>
                    </div>
                ) : (
                    <div className="h-full bg-gray-50 border-2 border-dashed rounded-xl flex items-center justify-center text-gray-400"><Gavel size={32} /></div>
                )}
            </div>
        </div>
      ) : (
        // --- WATCHTOWER VIEW (Payouts) ---
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                    <tr>
                        <th className="px-6 py-4">Merchant</th>
                        <th className="px-6 py-4">Bank Details</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {payouts.map((payout) => {
                        const isHighValue = payout.amount > 500000;
                        return (
                            <tr key={payout.id} className={isHighValue ? "bg-red-50/50" : "hover:bg-gray-50"}>
                                <td className="px-6 py-4">
                                    <p className="font-bold text-gray-900">{payout.profiles?.display_name || 'Unknown'}</p>
                                    <p className="text-[10px] text-gray-500">Req: {new Date(payout.created_at).toLocaleDateString()}</p>
                                </td>
                                <td className="px-6 py-4 text-xs">
                                    <p className="font-mono text-gray-700">{payout.profiles?.account_number}</p>
                                    <p className="text-gray-500">{payout.profiles?.bank_name}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900">₦{payout.amount.toLocaleString()}</span>
                                        {isHighValue && <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><AlertTriangle size={10}/> High Value</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => processPayout(payout.id, 'reject')} className="p-2 text-red-600 hover:bg-red-50 rounded border border-gray-200 hover:border-red-200 transition" title="Reject"><XCircle size={16} /></button>
                                        <button onClick={() => processPayout(payout.id, 'approve')} className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded hover:bg-black transition flex items-center gap-2">
                                            Process <ArrowRight size={12} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            {payouts.length === 0 && <div className="p-12 text-center text-gray-400">All payouts processed. Good job.</div>}
        </div>
      )}
    </div>
  )
}