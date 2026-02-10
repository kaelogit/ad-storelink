'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { 
  ShieldCheck, XCircle, CheckCircle, Eye, Search, 
  Filter, Loader2, AlertCircle, ExternalLink, Clock, UserCheck
} from 'lucide-react'

export default function ModeratorPage() {
  const supabase = createClient()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    setLoading(true)
    // Fetch pending verifications from merchant_verifications table
    const { data, error } = await supabase
      .from('merchant_verifications')
      .select(`
        *,
        profile:profile_id (display_name, email, logo_url, slug)
      `)
      .order('created_at', { ascending: false })
    
    if (data) setRequests(data)
    setLoading(false)
  }

  const handleVerification = async (requestId: string, profileId: string, status: 'verified' | 'rejected') => {
    if (!confirm(`Are you sure you want to mark this merchant as ${status}?`)) return
    
    setIsProcessing(true)

    // 1. Update the verification request status
    const { error: updateError } = await supabase
      .from('merchant_verifications')
      .update({ status: status === 'verified' ? 'approved' : 'rejected' })
      .eq('id', requestId)

    // 2. Update the main profile table (Grant the badge)
    if (!updateError && status === 'verified') {
      await supabase
        .from('profiles')
        .update({ 
          is_verified: true,
          verification_status: 'verified'
        })
        .eq('id', profileId)
    }

    // 3. Log this in the Audit Log (The Black Box we built)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('admin_audit_logs').insert({
        admin_id: user?.id,
        admin_email: user?.email,
        action_type: 'KYC_VERIFICATION',
        target_id: profileId,
        details: `Merchant ${status === 'verified' ? 'Approved' : 'Rejected'}. Request ID: ${requestId}`
    })

    setSelectedRequest(null)
    setIsProcessing(false)
    fetchRequests()
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Moderation Hub</h1>
          <p className="text-gray-500 text-sm">Review merchant verification requests and maintain platform safety.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LIST SIDE (Left) */}
        <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <Clock size={16} className="text-orange-500" /> Pending Requests
                    </h3>
                    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {requests.filter(r => r.status === 'pending').length} Action Required
                    </span>
                </div>
                <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-gray-100">
                        {requests.map((req) => (
                            <tr 
                                key={req.id} 
                                onClick={() => setSelectedRequest(req)}
                                className={`cursor-pointer transition-colors ${selectedRequest?.id === req.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center font-bold text-blue-600">
                                            {req.profile?.display_name?.[0]}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{req.profile?.display_name}</p>
                                            <p className="text-[10px] text-gray-500">@{req.profile?.slug}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                        req.status === 'approved' ? 'bg-green-100 text-green-700' : 
                                        req.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                        {req.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-400 text-[11px]">
                                    {new Date(req.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Eye size={16} className="text-gray-400 ml-auto" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {requests.length === 0 && <div className="p-12 text-center text-gray-400">No verification requests found.</div>}
            </div>
        </div>

        {/* DETAILS SIDE (Right) */}
        <div className="lg:col-span-1">
            {selectedRequest ? (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm sticky top-6 overflow-hidden animate-in slide-in-from-right-4">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="font-bold text-gray-900">Review Application</h3>
                        <p className="text-xs text-gray-500 mt-1">Submitted on {new Date(selectedRequest.created_at).toLocaleString()}</p>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* ID Preview (Simulation) */}
                        <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center text-white relative group">
                           {selectedRequest.id_url ? (
                               <img src={selectedRequest.id_url} className="w-full h-full object-contain rounded-lg" alt="Identity Document" />
                           ) : (
                               <div className="text-center">
                                   <ShieldCheck size={32} className="mx-auto mb-2 opacity-20" />
                                   <p className="text-[10px] opacity-50 uppercase tracking-widest font-bold">Document Image</p>
                               </div>
                           )}
                           <button className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 font-bold text-xs">
                               <ExternalLink size={14} /> Full Preview
                           </button>
                        </div>

                        <div className="space-y-4">
                            <InfoRow label="Business Name" value={selectedRequest.profile?.display_name} />
                            <InfoRow label="Email Address" value={selectedRequest.profile?.email} />
                            <InfoRow label="Document Type" value={selectedRequest.id_type || 'National ID'} />
                            <InfoRow label="Document Number" value={selectedRequest.id_number || 'TRX-9982-11'} />
                        </div>

                        {selectedRequest.status === 'pending' && (
                            <div className="flex gap-3 pt-4">
                                <button 
                                    disabled={isProcessing}
                                    onClick={() => handleVerification(selectedRequest.id, selectedRequest.profile_id, 'rejected')}
                                    className="flex-1 flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 py-2.5 rounded-lg text-xs font-bold hover:bg-red-50 transition"
                                >
                                    <XCircle size={14} /> Reject
                                </button>
                                <button 
                                    disabled={isProcessing}
                                    onClick={() => handleVerification(selectedRequest.id, selectedRequest.profile_id, 'verified')}
                                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-xs font-bold hover:bg-green-700 transition"
                                >
                                    {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={14} /> Verify</>}
                                </button>
                            </div>
                        )}

                        {selectedRequest.status === 'approved' && (
                            <div className="bg-green-50 border border-green-100 p-4 rounded-lg flex items-center gap-3">
                                <UserCheck className="text-green-600" size={20} />
                                <p className="text-green-700 text-xs font-medium">This merchant is verified.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl h-64 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                    <Eye size={32} className="mb-2 opacity-20" />
                    <p className="text-sm">Select a request from the list to view merchant documents.</p>
                </div>
            )}
        </div>

      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
            <p className="text-sm font-medium text-gray-800">{value}</p>
        </div>
    )
}