'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { 
  Save, Power, Smartphone, ShieldAlert, Loader2, Info
} from 'lucide-react'

export default function SystemSettings() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Config State
  const [config, setConfig] = useState({
    maintenance_mode: false,
    min_version_ios: '1.0.0',
    min_version_android: '1.0.0',
    support_phone: ''
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    const { data } = await supabase.from('app_settings').select('*').single()
    if (data) setConfig(data)
    setLoading(false)
  }

  const saveSettings = async () => {
    if (config.maintenance_mode && !confirm("⚠️ DANGER: You are about to lock the app for ALL users. Are you sure?")) return
    
    setSaving(true)
    const { error } = await supabase
      .from('app_settings')
      .update(config)
      .eq('id', 1)

    if (!error) {
        alert('System settings updated successfully.')
        // Log it
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('admin_audit_logs').insert({
            admin_id: user?.id,
            action_type: 'SYSTEM_CONFIG_CHANGE',
            details: `Updated config. Maintenance: ${config.maintenance_mode}`
        })
    } else {
        alert('Error: ' + error.message)
    }
    setSaving(false)
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">System Configuration</h1>
            <p className="text-gray-500 text-sm">Global app switches and version control.</p>
        </div>
        <button 
            onClick={saveSettings}
            disabled={saving}
            className="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-black transition flex items-center gap-2"
        >
            {saving ? <Loader2 className="animate-spin h-4 w-4"/> : <Save size={16} />}
            Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 🛑 THE KILL SWITCH */}
        <div className={`p-6 rounded-xl border-2 transition ${config.maintenance_mode ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full ${config.maintenance_mode ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                        <Power size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Maintenance Mode</h3>
                        <p className="text-xs text-gray-500">Lock the app instantly.</p>
                    </div>
                </div>
                
                {/* Custom Toggle Switch */}
                <button 
                    onClick={() => setConfig({...config, maintenance_mode: !config.maintenance_mode})}
                    className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${config.maintenance_mode ? 'bg-red-600' : 'bg-gray-300'}`}
                >
                    <div className={`bg-white w-6 h-6 rounded-full shadow-sm transform transition-transform duration-300 ${config.maintenance_mode ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
            </div>
            
            {config.maintenance_mode ? (
                <div className="flex items-center gap-2 text-red-700 text-sm bg-white/50 p-3 rounded-lg border border-red-100">
                    <ShieldAlert size={16} />
                    <span className="font-bold">APP IS CURRENTLY LOCKED.</span>
                </div>
            ) : (
                <p className="text-sm text-gray-500 p-2">
                    When active, users will see a "Under Maintenance" screen and cannot access any features. Use during critical updates.
                </p>
            )}
        </div>

        {/* 📲 APP VERSIONS */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Smartphone size={20}/> Force Update</h3>
            <p className="text-xs text-gray-500 mb-6">Users with app versions lower than these will be forced to update via App Store/Play Store.</p>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Min iOS Version</label>
                    <input 
                        type="text" 
                        value={config.min_version_ios}
                        onChange={(e) => setConfig({...config, min_version_ios: e.target.value})}
                        className="w-full p-2 border border-gray-200 rounded-lg font-mono text-sm"
                        placeholder="1.0.0"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Min Android Version</label>
                    <input 
                        type="text" 
                        value={config.min_version_android}
                        onChange={(e) => setConfig({...config, min_version_android: e.target.value})}
                        className="w-full p-2 border border-gray-200 rounded-lg font-mono text-sm"
                        placeholder="1.0.0"
                    />
                </div>
            </div>
        </div>

      </div>
    </div>
  )
}