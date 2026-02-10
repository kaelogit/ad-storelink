'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { 
  Search, Eye, ShieldOff, Ban, UserCheck, Wallet, ShoppingCart, 
  Loader2, Users as UsersIcon, Award, Clock, AlertTriangle, 
  TrendingUp, CreditCard, MapPin, Calendar, Activity, CheckCircle, Copy
} from 'lucide-react'

export default function UserManagement() {
  const supabase = createClient()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  
  const [dossier, setDossier] = useState<any>(null)
  const [dossierLoading, setDossierLoading] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setUsers(data)
    setLoading(false)
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`email.ilike.%${search}%,display_name.ilike.%${search}%,id.eq.${search.includes('-') ? search : '00000000-0000-0000-0000-000000000000'}`)
    if (data) setUsers(data)
    setLoading(false)
  }

  const selectUser = async (userId: string) => {
    setDossierLoading(true)
    setDossier(null)
    const { data, error } = await supabase.rpc('get_user_dossier', { p_user_id: userId })
    if (data) setDossier(data)
    setDossierLoading(false)
  }

  const toggleAccountStatus = async () => {
    if (!dossier) return
    const newStatus = dossier.status === 'active' ? 'suspended' : 'active'
    if (!confirm(`Confirm: Set status to ${newStatus}?`)) return

    await supabase.from('profiles').update({ account_status: newStatus }).eq('id', dossier.id)
    await supabase.from('admin_audit_logs').insert({
        action_type: 'USER_STATUS_CHANGE',
        target_id: dossier.id,
        details: `Changed status to ${newStatus}`
    })
    setDossier({...dossier, status: newStatus})
    fetchUsers()
  }

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert(`Copied: ${text}`);
  }

  if (loading && users.length === 0) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">User Intelligence</h1>
            <p className="text-gray-500 text-sm">Deep dive into user behavior, financials, and risk.</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-96">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Search name, email, UUID..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black transition">Search</button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden h-[80vh] overflow-y-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] sticky top-0">
                    <tr>
                        <th className="px-6 py-4">Identity</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {users.map((user) => (
                        <tr key={user.id} onClick={() => selectUser(user.id)} className={`cursor-pointer transition-colors ${dossier?.id === user.id ? 'bg-blue-50' : 'hover:bg-gray-50/50'}`}>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-gray-200 overflow-hidden">
                                        <img src={user.logo_url || `https://ui-avatars.com/api/?name=${user.display_name}`} className="h-full w-full object-cover" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">{user.display_name}</p>
                                        <p className="text-[10px] text-gray-400">{user.email}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${user.is_seller ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                    {user.is_seller ? 'SELLER' : 'BUYER'}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${user.account_status === 'active' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                    {user.account_status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right"><Eye size={14} className="text-gray-400 ml-auto" /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <div className="lg:col-span-1">
            {dossierLoading ? (
                <div className="h-full flex items-center justify-center bg-white border border-gray-200 rounded-xl"><Loader2 className="animate-spin text-blue-600" /></div>
            ) : dossier ? (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-0 sticky top-6 overflow-hidden flex flex-col h-[80vh]">
                    
                    <div className="bg-gray-50 p-6 border-b border-gray-100 text-center relative">
                        <div className="absolute top-4 right-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${dossier.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{dossier.status}</span>
                        </div>
                        <img src={dossier.logo_url || `https://ui-avatars.com/api/?name=${dossier.full_name}`} className="h-20 w-20 rounded-full mx-auto border-4 border-white shadow-sm mb-3 object-cover" />
                        <h3 className="font-bold text-lg text-gray-900">{dossier.full_name}</h3>
                        <div className="flex justify-center gap-4 text-xs text-gray-500 mt-2">
                            <div className="flex items-center gap-1"><MapPin size={12}/> {dossier.location || 'Unknown'}</div>
                            <div className="flex items-center gap-1"><Calendar size={12}/> Joined {dossier.joined_at ? new Date(dossier.joined_at).getFullYear() : '2024'}</div>
                        </div>
                        <button onClick={() => copyToClipboard(dossier.id)} className="mt-3 text-[10px] text-blue-500 bg-blue-50 px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-blue-100">
                            ID: {dossier.id.slice(0,8)}... <Copy size={10} />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 border-b border-gray-100 divide-x divide-gray-100">
                        <div className="p-4 text-center">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Followers</p>
                            <p className="text-lg font-bold text-gray-900">{dossier.followers}</p>
                        </div>
                        <div className="p-4 text-center">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Following</p>
                            <p className="text-lg font-bold text-gray-900">{dossier.following}</p>
                        </div>
                        <div className="p-4 text-center">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Curations</p>
                            <p className="text-lg font-bold text-gray-900">{dossier.curations_count}</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* RECENT ORDERS (The Fix for Support) */}
                        <div>
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-2"><Activity size={12}/> Recent Activity</h4>
                            <div className="space-y-2">
                                {dossier.recent_orders?.length > 0 ? dossier.recent_orders.map((o: any) => (
                                    <div key={o.id} className="bg-gray-50 border border-gray-100 p-3 rounded-lg flex justify-between items-center group">
                                        <div>
                                            <p className="text-xs font-bold text-gray-800">{o.currency_code} {o.total_amount}</p>
                                            <p className="text-[9px] text-gray-400">{new Date(o.created_at).toLocaleDateString()} • {o.status}</p>
                                        </div>
                                        <button onClick={() => copyToClipboard(o.id)} className="opacity-0 group-hover:opacity-100 transition text-[10px] bg-white border border-gray-200 px-2 py-1 rounded text-gray-500 hover:text-blue-600 flex items-center gap-1">
                                            Copy ID <Copy size={10} />
                                        </button>
                                    </div>
                                )) : (
                                    <p className="text-xs text-gray-400 italic">No recent orders found.</p>
                                )}
                            </div>
                        </div>

                        {/* Subscription */}
                        <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
                            <h4 className="text-[10px] font-bold text-blue-400 uppercase mb-3 flex items-center gap-2"><CreditCard size={12}/> Subscription</h4>
                            <div className="space-y-2">
                                <InfoRow label="Plan" value={dossier.plan_name} />
                                <InfoRow label="Plan Time Left" value={`${dossier.plan_days_left} Days`} />
                            </div>
                        </div>

                        {/* Financials */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-2"><Wallet size={12}/> Financials</h4>
                            <DossierStat icon={Wallet} label="Wallet Balance" value={`₦${dossier.wallet_balance}`} color="blue" />
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 p-3 rounded-lg text-center">
                                    <p className="text-[9px] text-gray-400 uppercase">Total Earned</p>
                                    <p className="text-xs font-bold text-gray-900">₦{dossier.total_earned}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg text-center">
                                    <p className="text-[9px] text-gray-400 uppercase">Total Spent</p>
                                    <p className="text-xs font-bold text-gray-900">₦{dossier.total_spent}</p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-4">
                            <button 
                                onClick={toggleAccountStatus}
                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition shadow-sm ${dossier.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-600 text-white hover:bg-green-700'}`}
                            >
                                {dossier.status === 'active' ? <><ShieldOff size={16} /> Freeze Account</> : <><UserCheck size={16} /> Activate Account</>}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl h-[80vh] flex flex-col items-center justify-center text-gray-400 text-center p-8">
                    <UsersIcon size={48} className="mb-4 opacity-20" />
                    <p className="font-medium text-sm">Select a user to view full intelligence dossier.</p>
                </div>
            )}
        </div>

      </div>
    </div>
  )
}

function DossierStat({ icon: Icon, label, value, color = 'gray' }: any) {
    const colors: any = {
        gray: "text-gray-900",
        green: "text-green-600",
        red: "text-red-600",
        blue: "text-blue-600"
    }
    return (
        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{label}</p>
                <p className={`text-sm font-black ${colors[color]}`}>{value}</p>
            </div>
            <Icon size={16} className="text-gray-300" />
        </div>
    )
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex justify-between text-xs border-b border-blue-200/30 pb-1 last:border-0 last:pb-0">
            <span className="text-blue-400 font-medium">{label}</span>
            <span className="font-bold text-blue-900">{value}</span>
        </div>
    )
}