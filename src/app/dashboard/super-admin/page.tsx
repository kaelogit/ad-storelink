'use client'

import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ConfirmActionModal } from '../../../components/admin/ConfirmActionModal'
import { useTableStateFromUrl } from '../../../hooks/useTableStateFromUrl'
import { parseApiError } from '../../../utils/http'
import { StatusBadge } from '../../../components/admin/StatusBadge'
import type { AdminAuditLog, AdminUser } from '../../../types/admin'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../../../components/ui'
import {
  Users,
  Loader2,
  CheckCircle,
  AlertCircle,
  Search,
  History,
  Ban,
  Globe,
  RotateCcw,
  Activity,
} from 'lucide-react'

type AdminSession = {
  id: string
  admin_id: string
  admin_email: string | null
  admin_name: string | null
  admin_role: string | null
  device_info: string | null
  ip: string | null
  last_activity: string
  created_at: string
}

export default function SuperAdminPage() {
  const supabase = createClient()
  const tableState = useTableStateFromUrl()
  const { q: auditFilterQ, setQ: setAuditFilterQ } = tableState
  const [activeTab, setActiveTab] = useState<'staff' | 'sessions' | 'audit'>('staff')
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [auditSearchInput, setAuditSearchInput] = useState('')

  // Form States
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('moderator')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [pendingStaffAction, setPendingStaffAction] = useState<{
    id: string
    email: string
    currentStatus: boolean
  } | null>(null)
  const [pendingSession, setPendingSession] = useState<AdminSession | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'audit') setAuditSearchInput(auditFilterQ)
  }, [activeTab, auditFilterQ])

  const loadData = async () => {
    if (activeTab === 'staff') {
      setLoading(true)
      const { data } = await supabase.from('admin_users').select('*').order('created_at', { ascending: false })
      if (data) setAdmins(data)
      setLoading(false)
      return
    }

    if (activeTab === 'sessions') {
      setSessionsLoading(true)
      const response = await fetch('/api/admin/staff/sessions')
      if (response.ok) {
        const payload = (await response.json()) as { sessions: AdminSession[] }
        setSessions(payload.sessions ?? [])
      } else {
        const message = await parseApiError(response, 'Failed to load sessions.')
        setFeedback({ tone: 'error', message })
      }
      setSessionsLoading(false)
      return
    }

    // audit tab
    setLoading(true)
    const { data } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setLogs(data)
    setLoading(false)
  }

  // 🛡️ SECURITY CONTROLS
  const requestStaffStatusChange = (id: string, currentStatus: boolean, email: string) => {
    setPendingStaffAction({ id, email, currentStatus })
  }

  const executeStaffStatusChange = async () => {
    if (!pendingStaffAction) return
    const { id, email, currentStatus } = pendingStaffAction
    setFeedback({ tone: 'info', message: `${currentStatus ? 'Suspending' : 'Activating'} ${email}...` })
    const response = await fetch('/api/admin/staff/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staffId: id,
        isActive: !currentStatus,
      }),
    })
    setPendingStaffAction(null)
    if (!response.ok) {
      const errorMessage = await parseApiError(response, 'Failed to update staff status.')
      setFeedback({ tone: 'error', message: errorMessage })
      return
    }
    setFeedback({ tone: 'success', message: `${email} ${currentStatus ? 'suspended' : 'activated'} successfully.` })
    loadData()
  }

  const requestSessionRevoke = (session: AdminSession) => {
    setPendingSession(session)
  }

  const executeSessionRevoke = async () => {
    if (!pendingSession) return
    setFeedback({
      tone: 'info',
      message: `Revoking session for ${pendingSession.admin_email ?? 'admin'}...`,
    })
    const response = await fetch('/api/admin/staff/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: pendingSession.id }),
    })
    const current = pendingSession
    setPendingSession(null)
    if (!response.ok) {
      const errorMessage = await parseApiError(response, 'Failed to revoke session.')
      setFeedback({ tone: 'error', message: errorMessage })
      return
    }
    setFeedback({
      tone: 'success',
      message: `Session revoked for ${current.admin_email ?? 'admin'}.`,
    })
    loadData()
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const response = await fetch('/api/admin/staff/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        fullName,
        role,
      }),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ error: 'Request failed' }))) as {
        error?: string
      }
      setStatus('error')
      setErrorMsg(payload.error || 'Failed to invite staff member.')
    } else {
      setStatus('success')
      loadData()
      setTimeout(() => {
        setIsInviteOpen(false)
        setStatus('idle')
        setEmail('')
        setFullName('')
      }, 2000)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 🏛️ Header */}
      <PageHeader
        title="Security & Staffing"
        subtitle="Oversight and access control for the StoreLink team."
        actions={
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
            <TabBtn active={activeTab === 'staff'} onClick={() => setActiveTab('staff')} label="Staff List" icon={Users} />
            <TabBtn
              active={activeTab === 'sessions'}
              onClick={() => setActiveTab('sessions')}
              label="Sessions"
              icon={Activity}
            />
            <TabBtn active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} label="Audit Log" icon={History} />
          </div>
        }
      />
      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <ConfirmActionModal
        open={pendingStaffAction !== null}
        title={
          pendingStaffAction?.currentStatus
            ? `Suspend ${pendingStaffAction.email}?`
            : `Activate ${pendingStaffAction?.email ?? ''}?`
        }
        description={
          pendingStaffAction?.currentStatus
            ? 'This admin will lose access immediately. Their session will be invalidated.'
            : 'This admin will regain access and can sign in again.'
        }
        impactSummary={
          pendingStaffAction?.currentStatus
            ? 'They will be logged out and cannot access the admin panel until reactivated.'
            : 'They can sign in and use the admin panel according to their role.'
        }
        danger={pendingStaffAction?.currentStatus === true}
        confirmLabel={pendingStaffAction?.currentStatus ? 'Suspend' : 'Activate'}
        onClose={() => setPendingStaffAction(null)}
        onConfirm={executeStaffStatusChange}
      />

      <ConfirmActionModal
        open={pendingSession !== null}
        title="Revoke session?"
        description={
          pendingSession
            ? `Kill session for ${pendingSession.admin_email ?? 'this admin'} on ${
                pendingSession.device_info ?? 'unknown device'
              }?`
            : ''
        }
        impactSummary="This session will be logged out and removed from the session list. The admin will need to sign in again."
        danger
        confirmLabel="Revoke session"
        onClose={() => setPendingSession(null)}
        onConfirm={executeSessionRevoke}
      />

      {loading && activeTab !== 'sessions' ? (
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : activeTab === 'staff' ? (
        <>
          {/* STAFF MANAGEMENT VIEW */}
          <div className="flex justify-end">
            <button
              onClick={() => setIsInviteOpen(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium shadow-sm"
            >
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
                        <div
                          className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${
                            admin.is_active ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {admin.full_name?.[0] || admin.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-semibold ${admin.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
                            {admin.full_name}
                          </p>
                          <p className="text-xs text-gray-400">{admin.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <RoleBadge role={admin.role} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-600 font-medium">
                          {admin.last_login ? new Date(admin.last_login).toLocaleDateString() : 'No Login Yet'}
                        </span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Globe size={10} /> IP: {admin.last_login_ip || '---'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge label={admin.is_active ? 'ACTIVE' : 'SUSPENDED'} tone={admin.is_active ? 'success' : 'danger'} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {admin.role !== 'super_admin' && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => requestStaffStatusChange(admin.id, admin.is_active, admin.email)}
                            className={`p-2 rounded-lg border transition ${
                              admin.is_active
                                ? 'text-gray-400 border-gray-100 hover:text-red-600 hover:border-red-100 hover:bg-red-50'
                                : 'text-green-600 border-green-100 bg-green-50 hover:bg-green-100'
                            }`}
                            title={admin.is_active ? 'Kill Session (Suspend)' : 'Restore Access'}
                          >
                            <Ban size={16} />
                          </button>
                          <button
                            className="p-2 text-gray-400 border border-gray-100 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50 rounded-lg transition"
                            title="Force Security Reset"
                          >
                            <RotateCcw size={16} />
                          </button>
                        </div>
                      )}
                      {admin.role === 'super_admin' && (
                        <span className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">Protected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : activeTab === 'sessions' ? (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Live view of active admin sessions across devices. Revoke sessions that look suspicious or belong to suspended staff.
          </p>
          {sessionsLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
              No active admin sessions recorded yet.
            </div>
          ) : (
            <DataTable>
              <DataTableHeader>
                <tr>
                  <DataTableHead>Admin</DataTableHead>
                  <DataTableHead>Role</DataTableHead>
                  <DataTableHead>Device</DataTableHead>
                  <DataTableHead>IP</DataTableHead>
                  <DataTableHead>Last activity</DataTableHead>
                  <DataTableHead>Created</DataTableHead>
                  <DataTableHead className="text-right">Actions</DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {sessions.map((session) => (
                  <DataTableRow key={session.id}>
                    <DataTableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-[var(--foreground)]">
                          {session.admin_name || session.admin_email || 'Unknown admin'}
                        </span>
                        {session.admin_email && (
                          <span className="text-xs text-gray-400">{session.admin_email}</span>
                        )}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-xs text-gray-600 uppercase">
                        {session.admin_role?.replace('_', ' ') ?? '—'}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-xs text-gray-600">
                        {session.device_info ? session.device_info.slice(0, 80) : 'Unknown device'}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-xs text-gray-600">{session.ip ?? '—'}</span>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-xs text-gray-600">
                        {new Date(session.last_activity).toLocaleString()}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-xs text-gray-600">
                        {new Date(session.created_at).toLocaleString()}
                      </span>
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <button
                        className="px-3 py-1.5 rounded-lg border border-red-100 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                        onClick={() => requestSessionRevoke(session)}
                      >
                        Revoke
                      </button>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </div>
      ) : (
        /* 🕵️‍♂️ AUDIT LOG VIEW (The Black Box) */
        <div className="space-y-4">
          <form
            className="flex gap-4 items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault()
              setAuditFilterQ(auditSearchInput)
            }}
          >
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by admin email or action type..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={auditSearchInput}
                onChange={(e) => setAuditSearchInput(e.target.value)}
                onBlur={() => setAuditFilterQ(auditSearchInput)}
              />
            </div>
            <button
              type="submit"
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black transition"
            >
              Apply
            </button>
          </form>

          {(() => {
            const filteredLogs = logs.filter(
              (l) =>
                l.admin_email?.toLowerCase().includes(auditFilterQ.toLowerCase()) ||
                l.action_type?.toLowerCase().includes(auditFilterQ.toLowerCase())
            )
            return (
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
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 text-gray-400 whitespace-nowrap text-xs">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 font-semibold text-gray-700">{log.admin_email}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-[9px] font-black uppercase tracking-tighter border border-gray-200">
                              {log.action_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-600 text-xs">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {logs.length === 0 && (
                  <div className="p-12 text-center text-gray-400">
                    The Black Box is currently empty. All actions will be recorded here.
                  </div>
                )}
                {logs.length > 0 && filteredLogs.length === 0 && (
                  <div className="p-12 text-center text-gray-400">
                    No audit logs match your filter. Try a different search.
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Authorize New Admin</h3>
              <button onClick={() => setIsInviteOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              {status === 'error' && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2 border border-red-100">
                  <AlertCircle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}
              {status === 'success' && (
                <div className="bg-green-50 text-green-700 p-3 rounded-lg text-xs flex items-center gap-2 border border-green-100">
                  <CheckCircle size={14} />
                  <span>Staff member added successfully.</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="staff@storelink.ng"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Shedrach Storelink"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Access Level</label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none bg-white text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="moderator">🛡️ Moderator (KYC & Trust)</option>
                  <option value="finance">💰 Finance (Payouts & Fees)</option>
                  <option value="support">🎧 Support (User Help)</option>
                  <option value="content">🎨 Content (CMO / Growth)</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200"
              >
                {status === 'loading' ? <Loader2 className="animate-spin h-4 w-4 mx-auto" /> : 'Authorize Staff Member'}
              </button>
            </form>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm text-xs text-gray-500">
        <p className="font-semibold text-gray-800 mb-1">Smoke tests</p>
        <p>
          Run the end-to-end smoke suite from CI before risky deploys. Configure{' '}
          <code className="rounded bg-gray-50 px-1 py-0.5 text-[10px] border border-gray-200">
            NEXT_PUBLIC_SMOKE_TESTS_URL
          </code>{' '}
          to deep-link a button here directly to your CI runs.
        </p>
      </div>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: ComponentType<{ size?: number }>
}) {
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