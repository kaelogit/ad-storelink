'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { 
  Users, Shield, Trash2, Loader2, CheckCircle, AlertCircle, 
  Search, Filter, History, Ban, Key, Globe, Eye, UserMinus, RotateCcw
} from 'lucide-react'

export default function SuperAdminPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'staff' | 'audit'>('staff')
  const [admins, setAdmins] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  
  // Audit Log Filters
  const [searchQuery, setSearchQuery] = useState('')
  
  // Form States
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('moderator')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    if (activeTab === 'staff') {
      const { data } = await supabase.from('admin_users').select('*').order('created_at', { ascending: false })
      if (data) setAdmins(data)
    } else {
      const { data } = await supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(100)
      if (data) setLogs(data)
    }
    setLoading(false)
  }

  // 🛡️ SECURITY CONTROLS
  const toggleStaffStatus = async (id: string, currentStatus: boolean, email: string) => {
    const actionLabel = currentStatus ? 'Suspend' : 'Activate'
    if (!confirm(`Are you sure you want to ${actionLabel} ${email}?`)) return

    const { error } = await supabase
      .from('admin_users')
      .update({ is_active: !currentStatus })
      .eq('id', id)
    
    if (!error) {
      // Manual Log for security action
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('admin_audit_logs').insert({
        admin_id: user?.id,
        admin_email: user?.email,
        action_type: currentStatus ? 'STAFF_SUSPENDED' : 'STAFF_ACTIVATED',
        target_id: id,
        details: `${actionLabel}ed access for staff: ${email}`
      })
      loadData()
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setStatus('loading');
    setErrorMsg('');

    // Step 1: Find User ID from main Auth system
    const { data: userId, error: rpcError } = await supabase.rpc('get_user_id_by_email', { p_email: email })

    if (rpcError || !userId) {
      setStatus('error');
      setErrorMsg('User not found. They must sign up on the mobile app first.');
      return
    }

    // Step 2: Grant Admin Rights
    const { error } = await supabase.from('admin_users').insert({
      id: userId, 
      email: email, 
      full_name: fullName, 
      role: role, 
      is_active: true
    })

    if (error) {
        setStatus('error');
        setErrorMsg(error.message.includes('unique') ? 'User is already a staff member.' : error.message);
    } else {
      setStatus('success');
      loadData();
      setTimeout(() => { setIsInviteOpen(false); setStatus('idle'); setEmail(''); setFullName('') }, 2000)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* 🏛️ Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Security & Staffing</h1>
            <p className="text-gray-500 text-sm">Oversight and access control for the StoreLink team.</p>
        </div>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
            <TabBtn active={activeTab === 'staff'} onClick={() => setActiveTab('staff')} label="Staff List" icon={Users} />
            <TabBtn active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} label="Audit Log" icon={History} />
        </div>
      </div>

      {loading ? (
        <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : activeTab === 'staff' ? (
        <>
          {/* STAFF MANAGEMENT VIEW */}
          <div className="flex justify-end">
            <button onClick={() => setIsInviteOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium shadow-sm">
                <Users size={18} /> Add Staff Member
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                        <th className="px-6 py-4">Staff Member</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Session Info</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Security Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {admins.map((admin) => (
                        <tr key={admin.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${admin.is_active ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                                        {admin.full_name?.[0] || admin.email[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p className={`font-semibold ${admin.is_active ? 'text-gray-900' : 'text-gray-400'}`}>{admin.full_name}</p>
                                        <p className="text-xs text-gray-400">{admin.email}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <RoleBadge role={admin.role} />
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-gray-600 font-medium">{admin.last_login ? new Date(admin.last_login).toLocaleDateString() : 'No Login Yet'}</span>
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                        <Globe size={10}/> IP: {admin.last_login_ip || '---'}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${admin.is_active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${admin.is_active ? 'bg-green-600' : 'bg-red-600'}`}></span>
                                    {admin.is_active ? 'Active' : 'Suspended'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                {admin.role !== 'super_admin' && (
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={() => toggleStaffStatus(admin.id, admin.is_active, admin.email)}
                                            className={`p-2 rounded-lg border transition ${admin.is_active ? 'text-gray-400 border-gray-100 hover:text-red-600 hover:border-red-100 hover:bg-red-50' : 'text-green-600 border-green-100 bg-green-50 hover:bg-green-100'}`}
                                            title={admin.is_active ? "Kill Session (Suspend)" : "Restore Access"}
                                        >
                                            <Ban size={16} />
                                        </button>
                                        <button className="p-2 text-gray-400 border border-gray-100 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50 rounded-lg transition" title="Force Security Reset">
                                            <RotateCcw size={16} />
                                        </button>
                                    </div>
                                )}
                                {admin.role === 'super_admin' && <span className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">Protected</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
        </>
      ) : (
        /* 🕵️‍♂️ AUDIT LOG VIEW (The Black Box) */
        <div className="space-y-4">
            <div className="flex gap-4 items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Filter by admin email or action type..." 
                        className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">Admin</th>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.filter(l => l.admin_email?.includes(searchQuery) || l.action_type?.includes(searchQuery.toUpperCase())).map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 text-gray-400 whitespace-nowrap text-xs">
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-gray-700">{log.admin_email}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-0.5 rounded bg-gray-100 text-[9px] font-black uppercase tracking-tighter border border-gray-200">{log.action_type}</span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 text-xs">{log.details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {logs.length === 0 && <div className="p-12 text-center text-gray-400">The Black Box is currently empty. All actions will be recorded here.</div>}
            </div>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <h3 className="text-lg font-bold text-gray-900">Authorize New Admin</h3>
                      <button onClick={() => setIsInviteOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                  <form onSubmit={handleInvite} className="p-6 space-y-4">
                      {status === 'error' && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2 border border-red-100">
                            <AlertCircle size={14}/><span>{errorMsg}</span>
                        </div>
                      )}
                      {status === 'success' && (
                        <div className="bg-green-50 text-green-700 p-3 rounded-lg text-xs flex items-center gap-2 border border-green-100">
                            <CheckCircle size={14}/><span>Staff member added successfully.</span>
                        </div>
                      )}
                      
                      <div>
                          <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Email Address</label>
                          <input type="email" required placeholder="staff@storelink.ng" className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all" value={email} onChange={e => setEmail(e.target.value)} />
                      </div>
                      <div>
                          <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Full Name</label>
                          <input type="text" required placeholder="Shedrach Storelink" className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all" value={fullName} onChange={e => setFullName(e.target.value)} />
                      </div>
                      <div>
                          <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Access Level</label>
                          <select className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none bg-white text-sm" value={role} onChange={e => setRole(e.target.value)}>
                              <option value="moderator">🛡️ Moderator (KYC & Trust)</option>
                              <option value="finance">💰 Finance (Payouts & Fees)</option>
                              <option value="support">🎧 Support (User Help)</option>
                              <option value="content">🎨 Content (CMO / Growth)</option>
                          </select>
                      </div>
                      <button type="submit" disabled={status === 'loading'} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                          {status === 'loading' ? <Loader2 className="animate-spin h-4 w-4 mx-auto" /> : 'Authorize Staff Member'}
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, label, icon: Icon }: any) {
    return (
        <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${active ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50' : 'text-gray-400 hover:text-gray-600'}`}>
            <Icon size={14} /> {label}
        </button>
    )
}

function RoleBadge({ role }: { role: string }) {
    const styles: any = {
        super_admin: "bg-purple-100 text-purple-700 border-purple-200",
        finance: "bg-emerald-100 text-emerald-700 border-emerald-200",
        moderator: "bg-orange-100 text-orange-700 border-orange-200",
        support: "bg-blue-100 text-blue-700 border-blue-200",
        content: "bg-pink-100 text-pink-700 border-pink-200",
    }
    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-tighter ${styles[role] || 'bg-gray-100'}`}>{role.replace('_', ' ')}</span>
}