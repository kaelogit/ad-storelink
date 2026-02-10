'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { 
  Users, Plus, Shield, Trash2, Loader2, CheckCircle, AlertCircle, Mail
} from 'lucide-react'

export default function StaffManager() {
  const supabase = createClient()
  const [admins, setAdmins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  
  // Invite Form
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('moderator')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetchAdmins()
  }, [])

  const fetchAdmins = async () => {
    const { data } = await supabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) setAdmins(data)
    setLoading(false)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    // 1. Check if user exists in Auth (We can't do this easily from client without Edge Function)
    // STRATEGY: We insert into admin_users. 
    // If the user ID exists in auth.users, we link it. 
    // If not, we can't create them here without an Invite Email system (Phase 2).
    
    // FOR NOW: We will assume you are adding someone who has ALREADY signed up on the app.
    // We will search for their email in the public.profiles or auth table via a secure RPC.

    const { data: userLink, error: linkError } = await supabase
        .rpc('get_user_id_by_email', { p_email: email }) // We need to create this simple RPC

    if (linkError || !userLink) {
        setStatus('error')
        setErrorMsg('User not found. Ask them to sign up on the app first.')
        return
    }

    // 2. Insert into Admin Table
    const { error: insertError } = await supabase
        .from('admin_users')
        .insert({
            id: userLink, // The UUID from the RPC
            email: email,
            full_name: fullName,
            role: role,
            is_active: true
        })

    if (insertError) {
        setStatus('error')
        setErrorMsg(insertError.message)
    } else {
        setStatus('success')
        fetchAdmins()
        setTimeout(() => {
            setIsInviteOpen(false)
            setStatus('idle')
            setEmail('')
            setFullName('')
        }, 2000)
    }
  }

  const handleRemove = async (id: string) => {
    if (!confirm("Are you sure? They will lose access immediately.")) return;
    await supabase.from('admin_users').delete().eq('id', id)
    fetchAdmins()
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Staff Management</h1>
            <p className="text-gray-500">Control who has access to the Admin Portal.</p>
        </div>
        <button 
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium shadow-sm"
        >
            <Plus size={18} /> Add Staff
        </button>
      </div>

      {/* Staff List */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs">
                <tr>
                    <th className="px-6 py-4 font-semibold">User</th>
                    <th className="px-6 py-4 font-semibold">Role</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm border border-indigo-100">
                                    {admin.full_name?.[0] || admin.email[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{admin.full_name || 'No Name'}</p>
                                    <p className="text-xs text-gray-500">{admin.email}</p>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <RoleBadge role={admin.role} />
                        </td>
                        <td className="px-6 py-4">
                            {admin.is_active ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-green-600"></span> Active
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                                    Suspended
                                </span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-right">
                            {admin.role !== 'super_admin' && (
                                <button 
                                    onClick={() => handleRemove(admin.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                    title="Revoke Access"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        {admins.length === 0 && (
            <div className="p-12 text-center text-gray-500">No staff members found.</div>
        )}
      </div>

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">Add Team Member</h3>
                    <button onClick={() => setIsInviteOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                
                {status === 'success' ? (
                    <div className="p-8 text-center">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={24} />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 mb-1">Access Granted!</h4>
                        <p className="text-gray-500 text-sm">They can now log in to the admin panel.</p>
                    </div>
                ) : (
                    <form onSubmit={handleInvite} className="p-6 space-y-4">
                        
                        {status === 'error' && (
                            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-xs flex gap-2">
                            <Mail size={16} />
                            <p>User must have already signed up on the mobile app or website.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                            <input 
                                type="email" required placeholder="colleague@storelink.ng"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                value={email} onChange={e => setEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input 
                                type="text" required placeholder="John Doe"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                value={fullName} onChange={e => setFullName(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select 
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                value={role} onChange={e => setRole(e.target.value)}
                            >
                                <option value="moderator">🛡️ Moderator (Safety & KYC)</option>
                                <option value="finance">💰 Finance (Payouts)</option>
                                <option value="support">🎧 Support (Tickets)</option>
                                <option value="content">🎨 Content (CMO)</option>
                            </select>
                        </div>

                        <button 
                            type="submit" disabled={status === 'loading'}
                            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 mt-4"
                        >
                            {status === 'loading' ? <Loader2 className="animate-spin h-4 w-4" /> : 'Grant Access'}
                        </button>
                    </form>
                )}
            </div>
        </div>
      )}
    </div>
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
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${styles[role] || 'bg-gray-100'}`}>
            {role.replace('_', ' ')}
        </span>
    )
}