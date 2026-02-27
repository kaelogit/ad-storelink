'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ConfirmActionModal } from '../../../components/admin/ConfirmActionModal'
import { parseApiError } from '../../../utils/http'
import type { AdminRole } from '../../../types/admin'
import { Card, CardHeader, CardContent, Button, Input } from '../../../components/ui'
import { Save, Power, Smartphone, ShieldAlert, Loader2, Phone } from 'lucide-react'

export default function SystemSettings() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState(false)

  const [config, setConfig] = useState({
    maintenance_mode: false,
    min_version_ios: '1.0.0',
    min_version_android: '1.0.0',
    support_phone: '',
  })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const { data: adminUser } = await supabase.from('admin_users').select('role').eq('id', user.id).single()
      const role = adminUser?.role as AdminRole | undefined
      if (role !== 'super_admin') {
        router.replace('/dashboard')
        return
      }
      await fetchSettings()
    }
    init()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    const { data } = await supabase.from('app_settings').select('*').single()
    if (data) setConfig(data)
    setLoading(false)
  }

  const saveSettings = async () => {
    setSaving(true)
    setFeedback({ tone: 'info', message: 'Saving settings...' })
    const response = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })

    if (response.ok) {
      setFeedback({ tone: 'success', message: 'System settings updated successfully.' })
    } else {
      const errorMessage = await parseApiError(response, 'Failed to update system settings.')
      setFeedback({ tone: 'error', message: errorMessage })
    }
    setSaving(false)
  }

  const handleSaveClick = () => {
    if (config.maintenance_mode) setShowMaintenanceConfirm(true)
    else saveSettings()
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="System Configuration"
        subtitle="Global app switches, version gates, and support contact."
        actions={
          <Button onClick={handleSaveClick} disabled={saving} loading={saving}>
            <Save className="h-4 w-4" /> Save changes
          </Button>
        }
      />
      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <ConfirmActionModal
        open={showMaintenanceConfirm}
        title="Enable maintenance mode?"
        description="You are about to lock the app for all users. Only admins will be able to access the platform until you turn it off."
        impactSummary="All users will see an “Under maintenance” screen and cannot use the app."
        danger
        confirmLabel="Lock app"
        submitting={saving}
        onClose={() => setShowMaintenanceConfirm(false)}
        onConfirm={async () => {
          setShowMaintenanceConfirm(false)
          await saveSettings()
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className={config.maintenance_mode ? 'border-[var(--danger)] bg-[var(--danger)]/5' : ''}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${config.maintenance_mode ? 'bg-[var(--danger)]/20 text-[var(--danger)]' : 'bg-[var(--surface)] text-[var(--muted)]'}`}>
                <Power className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--foreground)]">Maintenance mode</h3>
                <p className="text-xs text-[var(--muted)]">Lock the app for all non-admin users.</p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={config.maintenance_mode}
              onClick={() => setConfig({ ...config, maintenance_mode: !config.maintenance_mode })}
              className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${config.maintenance_mode ? 'bg-[var(--danger)]' : 'bg-[var(--border)]'}`}
            >
              <div className={`bg-white w-6 h-6 rounded-full shadow-sm transform transition-transform duration-300 ${config.maintenance_mode ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </CardHeader>
          <CardContent>
            {config.maintenance_mode ? (
              <div className="flex items-center gap-2 text-[var(--danger)] text-sm bg-[var(--danger)]/10 p-3 rounded-[var(--radius)] border border-[var(--danger)]/20">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span className="font-semibold">App is currently locked.</span>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                When active, users see an “Under maintenance” screen and cannot access any features. Use during critical updates.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-[var(--muted)]" />
            <span className="text-base font-semibold text-[var(--foreground)]">Force update</span>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[var(--muted)] mb-4">
              Users with app versions lower than these will be prompted to update via App Store or Play Store.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Min iOS version</label>
                <Input
                  type="text"
                  value={config.min_version_ios}
                  onChange={(e) => setConfig({ ...config, min_version_ios: e.target.value })}
                  placeholder="1.0.0"
                  className="font-mono"
                />
                <p className="text-[10px] text-[var(--muted)] mt-1">Semver, e.g. 1.2.3</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Min Android version</label>
                <Input
                  type="text"
                  value={config.min_version_android}
                  onChange={(e) => setConfig({ ...config, min_version_android: e.target.value })}
                  placeholder="1.0.0"
                  className="font-mono"
                />
                <p className="text-[10px] text-[var(--muted)] mt-1">Semver, e.g. 1.2.3</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-[var(--muted)]" />
            <span className="text-base font-semibold text-[var(--foreground)]">Support contact</span>
          </CardHeader>
          <CardContent>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Support phone (optional)</label>
              <Input
                type="tel"
                value={config.support_phone}
                onChange={(e) => setConfig({ ...config, support_phone: e.target.value })}
                placeholder="+1 234 567 8900"
              />
              <p className="text-[10px] text-[var(--muted)] mt-1">Shown in-app for users who need help.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
