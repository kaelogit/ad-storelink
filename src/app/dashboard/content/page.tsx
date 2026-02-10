'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { 
  Megaphone, Image as ImageIcon, Send, Loader2, 
  Trash2, Plus, Eye, BarChart3, Smartphone, Bell
} from 'lucide-react'

export default function ContentStudio() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'broadcast' | 'banners'>('broadcast')
  
  // Broadcast State
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [segment, setSegment] = useState('ALL')
  const [broadcasting, setBroadcasting] = useState(false)

  // Banner State
  const [banners, setBanners] = useState<any[]>([])
  const [bannerLoading, setBannerLoading] = useState(false)
  const [newBannerUrl, setNewBannerUrl] = useState('')
  const [newBannerTitle, setNewBannerTitle] = useState('')

  useEffect(() => {
    if (activeTab === 'banners') fetchBanners()
  }, [activeTab])

  // --- BROADCAST LOGIC ---
  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !message) return
    if (!confirm(`📢 SEND TO ${segment} USERS?\n\nTitle: ${title}\nMsg: ${message}`)) return

    setBroadcasting(true)
    const { error } = await supabase.rpc('send_broadcast_notification', {
        p_title: title,
        p_message: message,
        p_segment: segment
    })

    if (!error) {
        alert('Broadcast Sent! 🚀')
        setTitle('')
        setMessage('')
        // Log it
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('admin_audit_logs').insert({
            admin_id: user?.id,
            action_type: 'BROADCAST_SENT',
            details: `Sent "${title}" to ${segment}`
        })
    } else {
        alert('Failed: ' + error.message)
    }
    setBroadcasting(false)
  }

  // --- BANNER LOGIC ---
  const fetchBanners = async () => {
    setBannerLoading(true)
    const { data } = await supabase.from('banners').select('*').order('created_at', { ascending: false })
    if (data) setBanners(data)
    setBannerLoading(false)
  }

  const createBanner = async () => {
    if (!newBannerUrl || !newBannerTitle) return
    setBannerLoading(true)
    
    await supabase.from('banners').insert({
        image_url: newBannerUrl,
        title: newBannerTitle,
        is_active: true
    })
    
    setNewBannerUrl('')
    setNewBannerTitle('')
    fetchBanners()
  }

  const deleteBanner = async (id: string) => {
    if (!confirm('Remove this banner?')) return
    await supabase.from('banners').delete().eq('id', id)
    fetchBanners()
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Tabs */}
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Content Studio</h1>
            <p className="text-gray-500 text-sm">Manage app-wide communications and assets.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button 
                onClick={() => setActiveTab('broadcast')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'broadcast' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <Megaphone size={16} /> Broadcasts
            </button>
            <button 
                onClick={() => setActiveTab('banners')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'banners' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <ImageIcon size={16} /> Banners
            </button>
        </div>
      </div>

      {/* --- BROADCAST TAB --- */}
      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* The Composer */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 font-bold text-xs text-gray-500 uppercase flex items-center gap-2">
                    <Send size={14} /> New Campaign
                </div>
                <form onSubmit={sendBroadcast} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Target Audience</label>
                        <select 
                            value={segment} 
                            onChange={(e) => setSegment(e.target.value)}
                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="ALL">All Users (Everyone)</option>
                            <option value="SELLERS">Sellers Only</option>
                            <option value="BUYERS">Buyers Only</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Title</label>
                        <input 
                            type="text" 
                            placeholder="e.g., Flash Sale Alert! ⚡" 
                            className="w-full p-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={50}
                        />
                        <p className="text-right text-[10px] text-gray-400 mt-1">{title.length}/50</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Message Body</label>
                        <textarea 
                            placeholder="e.g., Get 50% off all sneakers for the next 2 hours only..." 
                            className="w-full p-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500 h-32 resize-none"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            maxLength={150}
                        />
                        <p className="text-right text-[10px] text-gray-400 mt-1">{message.length}/150</p>
                    </div>

                    <button 
                        type="submit" 
                        disabled={broadcasting}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
                    >
                        {broadcasting ? <Loader2 className="animate-spin" /> : <Megaphone size={18} />}
                        Send Push Notification
                    </button>
                </form>
            </div>

            {/* The Preview */}
            <div className="flex flex-col items-center justify-center">
                <div className="w-[300px] h-[600px] bg-gray-900 rounded-[3rem] border-8 border-gray-800 relative shadow-2xl overflow-hidden flex flex-col items-center pt-12">
                    <div className="absolute top-0 w-40 h-6 bg-gray-800 rounded-b-xl"></div>
                    
                    {/* Mock Phone Screen */}
                    <div className="w-full px-4 pt-8">
                        <div className="text-gray-400 text-center text-xs mb-4">
                            {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        
                        {/* The Notification Card */}
                        {(title || message) ? (
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-lg animate-in fade-in slide-in-from-top-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-5 h-5 bg-purple-500 rounded-md flex items-center justify-center">
                                        <Bell size={12} color="white" fill="white" />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">STORELINK • NOW</span>
                                </div>
                                <p className="text-sm font-bold text-white leading-tight">{title || 'Notification Title'}</p>
                                <p className="text-xs text-gray-300 mt-1 leading-relaxed">{message || 'Your message preview will appear here.'}</p>
                            </div>
                        ) : (
                            <div className="text-center text-gray-600 mt-20 text-xs">
                                <Smartphone size={32} className="mx-auto mb-2 opacity-50"/>
                                Live Preview
                            </div>
                        )}
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-4">Actual delivery appearance varies by device.</p>
            </div>
        </div>
      )}

      {/* --- BANNERS TAB --- */}
      {activeTab === 'banners' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Banner List */}
            <div className="lg:col-span-2 space-y-4">
                {banners.map((banner) => (
                    <div key={banner.id} className="group relative aspect-[3/1] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                        <img src={banner.image_url} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4">
                            <button onClick={() => deleteBanner(banner.id)} className="bg-white p-3 rounded-full text-red-600 hover:bg-red-50 transition">
                                <Trash2 size={20} />
                            </button>
                        </div>
                        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                            <p className="text-xs font-bold text-white">{banner.title}</p>
                        </div>
                    </div>
                ))}
                {banners.length === 0 && <div className="p-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">No active banners.</div>}
            </div>

            {/* Add New Banner */}
            <div className="lg:col-span-1">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 sticky top-6">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus size={18}/> Add Billboard</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500">Title (Internal)</label>
                            <input 
                                type="text" className="w-full p-2 border rounded-lg text-sm mt-1" 
                                placeholder="e.g. Easter Promo"
                                value={newBannerTitle} onChange={e => setNewBannerTitle(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500">Image URL</label>
                            <input 
                                type="text" className="w-full p-2 border rounded-lg text-sm mt-1" 
                                placeholder="https://..."
                                value={newBannerUrl} onChange={e => setNewBannerUrl(e.target.value)}
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Recommended: 1200x600px (2:1 Ratio)</p>
                        </div>
                        <button 
                            onClick={createBanner}
                            disabled={bannerLoading || !newBannerUrl}
                            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition flex justify-center"
                        >
                            {bannerLoading ? <Loader2 className="animate-spin"/> : 'Publish Banner'}
                        </button>
                    </div>
                </div>
            </div>

        </div>
      )}

    </div>
  )
}