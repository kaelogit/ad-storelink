'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ConfirmActionModal } from '../../../components/admin/ConfirmActionModal'
import { parseApiError } from '../../../utils/http'
import { Card, CardHeader, CardContent, Button, Input } from '../../../components/ui'
import { TabsRoot, Tab } from '../../../components/ui'
import { Megaphone, Image as ImageIcon, Send, Loader2, Trash2, Plus, Smartphone, Bell, CalendarDays } from 'lucide-react'
import { AnnouncementsCalendarPanel } from '../../../components/admin/AnnouncementsCalendarPanel'
import { useAdminRole } from '../../../hooks/useAdminRole'

export default function ContentStudio() {
  const supabase = createClient()
  const { canWrite, loading: roleLoading } = useAdminRole()
  const [activeTab, setActiveTab] = useState<'broadcast' | 'banners' | 'calendar'>('broadcast')

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [segment, setSegment] = useState('ALL')
  const [broadcasting, setBroadcasting] = useState(false)

  const [banners, setBanners] = useState<any[]>([])
  const [bannerLoading, setBannerLoading] = useState(false)
  const [newBannerUrl, setNewBannerUrl] = useState('')
  const [newBannerTitle, setNewBannerTitle] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [pendingBroadcast, setPendingBroadcast] = useState<{ title: string; message: string; segment: string } | null>(null)
  const [pendingDeleteBanner, setPendingDeleteBanner] = useState<{ id: string; title: string } | null>(null)

  useEffect(() => {
    if (activeTab === 'banners') fetchBanners()
  }, [activeTab])

  const requestBroadcastConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    if (!title?.trim() || !message?.trim()) return
    setPendingBroadcast({ title: title.trim(), message: message.trim(), segment })
  }

  const executeBroadcast = async () => {
    if (!pendingBroadcast || !canWrite) return
    setBroadcasting(true)
    setFeedback({ tone: 'info', message: 'Sending broadcast...' })
    try {
      const response = await fetch('/api/admin/content/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingBroadcast),
      })
      if (response.ok) {
        setFeedback({ tone: 'success', message: 'Broadcast sent successfully.' })
        setTitle('')
        setMessage('')
      } else {
        const errorMessage = await parseApiError(response, 'Failed to send broadcast.')
        setFeedback({ tone: 'error', message: errorMessage })
      }
    } catch (err) {
      setFeedback({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to send broadcast.' })
    } finally {
      setPendingBroadcast(null)
      setBroadcasting(false)
    }
  }

  const fetchBanners = async () => {
    setBannerLoading(true)
    try {
      const { data, error } = await supabase.from('banners').select('*').order('created_at', { ascending: false })
      if (error) {
        setFeedback({ tone: 'error', message: error.message || 'Failed to load banners.' })
        return
      }
      setBanners(data ?? [])
    } catch (err) {
      setFeedback({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to load banners.' })
    } finally {
      setBannerLoading(false)
    }
  }

  const createBanner = async () => {
    if (!canWrite) return
    if (!newBannerUrl?.trim() || !newBannerTitle?.trim()) return
    setBannerLoading(true)
    setFeedback({ tone: 'info', message: 'Publishing banner...' })
    try {
      const response = await fetch('/api/admin/content/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: newBannerUrl.trim(), title: newBannerTitle.trim() }),
      })
      if (!response.ok) {
        const errorMessage = await parseApiError(response, 'Failed to create banner.')
        setFeedback({ tone: 'error', message: errorMessage })
        return
      }
      setFeedback({ tone: 'success', message: 'Banner published.' })
      setNewBannerUrl('')
      setNewBannerTitle('')
      await fetchBanners()
    } catch (err) {
      setFeedback({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to create banner.' })
    } finally {
      setBannerLoading(false)
    }
  }

  const requestDeleteBanner = (id: string, bannerTitle: string) => {
    if (!canWrite) return
    setPendingDeleteBanner({ id, title: bannerTitle })
  }

  const executeDeleteBanner = async () => {
    if (!pendingDeleteBanner || !canWrite) return
    setFeedback({ tone: 'info', message: 'Removing banner...' })
    try {
      const response = await fetch('/api/admin/content/banners', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bannerId: pendingDeleteBanner.id }),
      })
      if (!response.ok) {
        const errorMessage = await parseApiError(response, 'Failed to delete banner.')
        setFeedback({ tone: 'error', message: errorMessage })
        return
      }
      setFeedback({ tone: 'success', message: 'Banner removed.' })
      await fetchBanners()
    } catch (err) {
      setFeedback({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to delete banner.' })
    } finally {
      setPendingDeleteBanner(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Studio"
        subtitle="Manage app-wide communications and assets."
        actions={
          <TabsRoot className="border-0 p-0 gap-0">
            <Tab active={activeTab === 'broadcast'} onClick={() => setActiveTab('broadcast')}>
              <Megaphone className="h-4 w-4 mr-1.5" /> Broadcasts
            </Tab>
            <Tab active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')}>
              <CalendarDays className="h-4 w-4 mr-1.5" /> Calendar
            </Tab>
            <Tab active={activeTab === 'banners'} onClick={() => setActiveTab('banners')}>
              <ImageIcon className="h-4 w-4 mr-1.5" /> Banners
            </Tab>
          </TabsRoot>
        }
      />
      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      {!roleLoading && !canWrite && (
        <ActionFeedback
          tone="info"
          message="Read-only: your role can view content but cannot send broadcasts or manage banners."
        />
      )}

      <ConfirmActionModal
        open={canWrite && pendingBroadcast !== null}
        title="Send push notification?"
        description={`This will send to ${pendingBroadcast?.segment ?? 'ALL'} users.`}
        impactSummary="Users will receive this notification on their devices. This action cannot be undone."
        confirmLabel="Send broadcast"
        submitting={broadcasting}
        onClose={() => setPendingBroadcast(null)}
        onConfirm={executeBroadcast}
      >
        {pendingBroadcast && (
          <div className="mt-3 rounded-lg bg-[var(--background)] p-3 text-sm border border-[var(--border)]">
            <p className="font-bold text-[var(--foreground)]">{pendingBroadcast.title}</p>
            <p className="mt-1 text-[var(--muted)]">{pendingBroadcast.message}</p>
          </div>
        )}
      </ConfirmActionModal>

      <ConfirmActionModal
        open={canWrite && pendingDeleteBanner !== null}
        title="Remove this banner?"
        description={pendingDeleteBanner ? `"${pendingDeleteBanner.title}" will be removed from the app.` : ''}
        impactSummary="The banner will no longer appear for users. You can add it again later."
        confirmLabel="Remove banner"
        danger
        onClose={() => setPendingDeleteBanner(null)}
        onConfirm={executeDeleteBanner}
      />

      {activeTab === 'calendar' && <AnnouncementsCalendarPanel canWrite={canWrite} />}

      {activeTab === 'broadcast' && !canWrite && (
        <Card className="border-dashed flex items-center justify-center py-16">
          <p className="text-[var(--muted)]">Broadcasts are limited to non-analyst roles.</p>
        </Card>
      )}

      {activeTab === 'broadcast' && canWrite && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Send className="h-4 w-4 text-[var(--muted)]" />
              <span className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">New campaign</span>
            </CardHeader>
            <CardContent>
              <form onSubmit={requestBroadcastConfirm} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Target audience</label>
                  <select
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  >
                    <option value="ALL">All users</option>
                    <option value="SELLERS">Sellers only</option>
                    <option value="BUYERS">Buyers only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Title</label>
                  <Input
                    placeholder="e.g. Flash Sale Alert"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={50}
                  />
                  <p className="text-right text-xs text-[var(--muted)] mt-1">{title.length}/50</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Message</label>
                  <textarea
                    placeholder="Your message..."
                    className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] h-32 resize-none"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={150}
                  />
                  <p className="text-right text-xs text-[var(--muted)] mt-1">{message.length}/150</p>
                </div>
                <Button type="submit" disabled={broadcasting} loading={broadcasting} className="w-full">
                  <Megaphone className="h-4 w-4" /> Send push notification
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="flex flex-col items-center justify-center p-8">
            <div className="w-[280px] h-[560px] bg-[var(--foreground)] rounded-[2rem] border-8 border-[var(--border)] shadow-xl overflow-hidden flex flex-col items-center pt-10">
              <div className="w-32 h-5 rounded-b-xl bg-[var(--border)]" />
              <div className="w-full px-4 pt-6">
                <p className="text-center text-xs text-[var(--muted)] mb-4">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                {(title || message) ? (
                  <div className="rounded-xl border border-white/20 bg-white/10 backdrop-blur p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded bg-[var(--primary)] flex items-center justify-center">
                        <Bell className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-[10px] font-bold text-[var(--muted)] uppercase">StoreLink</span>
                    </div>
                    <p className="text-sm font-bold text-white leading-tight">{title || 'Title'}</p>
                    <p className="text-xs text-white/80 mt-1">{message || 'Message'}</p>
                  </div>
                ) : (
                  <div className="text-center text-[var(--muted)] text-xs py-16">
                    <Smartphone className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    Live preview
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-[var(--muted)] mt-4">Preview. Actual delivery varies by device.</p>
          </Card>
        </div>
      )}

      {activeTab === 'banners' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {banners.map((banner) => (
              <Card key={banner.id} className="overflow-hidden p-0">
                <div className="group relative aspect-[3/1] bg-[var(--background)]">
                  <img src={banner.image_url} alt="" className="w-full h-full object-cover" />
                  {canWrite && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => requestDeleteBanner(banner.id, banner.title)}
                      >
                        <Trash2 className="h-4 w-4" /> Remove
                      </Button>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 backdrop-blur px-3 py-1.5">
                    <p className="text-xs font-bold text-white">{banner.title}</p>
                  </div>
                </div>
              </Card>
            ))}
            {banners.length === 0 && (
              <Card className="border-dashed flex items-center justify-center py-16">
                <p className="text-[var(--muted)]">{canWrite ? 'No banners yet. Add one below.' : 'No banners yet.'}</p>
              </Card>
            )}
          </div>
          {canWrite && (
          <Card className="lg:col-span-1 h-fit sticky top-6">
            <CardHeader>
              <span className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add billboard
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Title (internal)</label>
                <Input
                  placeholder="e.g. Easter Promo"
                  value={newBannerTitle}
                  onChange={(e) => setNewBannerTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Image URL</label>
                <Input
                  placeholder="https://..."
                  value={newBannerUrl}
                  onChange={(e) => setNewBannerUrl(e.target.value)}
                />
                <p className="text-[10px] text-[var(--muted)] mt-1">Recommended: 1200×600 (2:1)</p>
              </div>
              <Button
                onClick={createBanner}
                disabled={bannerLoading || !newBannerUrl?.trim()}
                loading={bannerLoading}
                className="w-full"
              >
                Publish banner
              </Button>
            </CardContent>
          </Card>
          )}
        </div>
      )}
    </div>
  )
}
