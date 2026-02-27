'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../utils/supabase/client'
import { PageHeader } from '../../components/admin/PageHeader'
import {
  Users,
  ShoppingBag,
  ShieldAlert,
  Activity,
  Server,
  Database,
  ArrowRight,
  Loader2,
  Wallet,
  Hourglass,
  BarChart3,
  PlayCircle,
  ExternalLink,
} from 'lucide-react'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts'

export default function DashboardOverview() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [trendWindow, setTrendWindow] = useState<'24h' | '7d' | '30d'>('7d')
  
  const [stats, setStats] = useState<any>({
    total_users: 0, 
    total_gmv: 0, 
    total_revenue: 0, 
    revenue_subscriptions: 0, 
    revenue_transactions: 0, 
    revenue_escrow: 0,
    active_disputes: 0, 
    pending_kyc: 0
  })
  const [chartData, setChartData] = useState<any[]>([])
  const [interventionTrends, setInterventionTrends] = useState<
    { actionType: string; category: string; count: number }[]
  >([])
  const [dbLatency, setDbLatency] = useState<number | null>(null)

  useEffect(() => {
    async function init() {
        // 1. Get User & Role
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: adminUser } = await supabase
                .from('admin_users')
                .select('role')
                .eq('id', user.id)
                .single()
            setRole(adminUser?.role || null)
        }

        // 2. Fetch Stats & Chart
        const { data: statsData } = await supabase.rpc('get_admin_dashboard_stats')
        if (statsData) setStats(statsData)

        const { data: graphData } = await supabase.rpc('get_daily_revenue_chart')
        if (graphData) setChartData(graphData)

        const since = getSinceISOString(trendWindow)
        const { data: auditData } = await supabase
          .from('admin_audit_logs')
          .select('action_type, details, created_at')
          .in('action_type', ['ORDER_INTERVENTION', 'DISPUTE_VERDICT', 'PAYOUT_APPROVE', 'PAYOUT_REJECT'])
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(400)
        if (auditData) {
          setInterventionTrends(buildInterventionTrends(auditData))
        }

        // 3. Health Check
        const start = Date.now()
        await supabase.from('admin_users').select('count', { count: 'exact', head: true })
        setDbLatency(Date.now() - start)

        setLoading(false)
    }
    init()
  }, [trendWindow])

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount)
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>

  const isBoss = role === 'super_admin'
  const canSeeMoney = ['super_admin', 'finance'].includes(role || '')

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. Header & Health */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <PageHeader
            title={isBoss ? 'Morning, Founder.' : 'Dashboard'}
            subtitle="Real-time platform overview"
          />
          <div className="flex items-center gap-2 text-gray-500">
            <span className="capitalize px-2 py-0.5 rounded-md bg-gray-100 text-xs font-bold border border-gray-200">
              {role?.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium shadow-sm">
            <Database className={`h-3 w-3 ${dbLatency && dbLatency < 500 ? 'text-green-500' : 'text-red-500'}`} />
            <span>DB: {dbLatency}ms</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium shadow-sm">
            <Server className="h-3 w-3 text-green-500" />
            <span>System: Online</span>
          </div>
        </div>
      </div>

      {/* 2. Command Center Grid (5 Cards) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        
        {/* PROFIT (Protected) */}
        {canSeeMoney && (
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Net Profit</h3>
                    <div className="rounded-full bg-emerald-50 p-2 text-emerald-600"><Wallet size={16} /></div>
                </div>
                <div className="flex flex-col">
                    <span className="text-xl font-bold text-gray-900">{formatNaira(stats.total_revenue)}</span>
                    <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-500">Subscriptions</span>
                            <span className="font-semibold text-blue-600">{formatNaira(stats.revenue_subscriptions)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-500">Commisions</span>
                            <span className="font-semibold text-orange-600">{formatNaira(stats.revenue_transactions)}</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* PENDING ESCROW (In-Flight) */}
        {canSeeMoney && (
            <div className="rounded-xl border border-yellow-100 bg-yellow-50/30 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold uppercase text-yellow-600 tracking-wider">In Escrow</h3>
                    <div className="rounded-full bg-yellow-100 p-2 text-yellow-600"><Hourglass size={16} /></div>
                </div>
                <div className="flex flex-col">
                    <span className="text-xl font-bold text-gray-900">{formatNaira(stats.revenue_escrow)}</span>
                    <p className="text-[10px] text-yellow-700 mt-2 font-medium italic">Pending delivery</p>
                </div>
            </div>
        )}

        {/* GMV (Protected) */}
        {canSeeMoney && (
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Total GMV</h3>
                    <div className="rounded-full bg-purple-50 p-2 text-purple-600"><ShoppingBag size={16} /></div>
                </div>
                <span className="text-xl font-bold text-gray-900">{formatNaira(stats.total_gmv)}</span>
                <p className="text-[10px] text-gray-400 mt-2">Closed sales only</p>
            </div>
        )}

        {/* USERS */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Total Users</h3>
            <div className="rounded-full bg-blue-50 p-2 text-blue-600"><Users size={16} /></div>
          </div>
          <span className="text-xl font-bold text-gray-900">{stats.total_users}</span>
          <p className="text-[10px] text-gray-400 mt-2">Active Accounts</p>
        </div>

        {/* PENDING ACTIONS */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Tickets</h3>
            <div className="rounded-full bg-orange-50 p-2 text-orange-600"><Activity size={16} /></div>
          </div>
          <div className="flex flex-col gap-1 mt-1">
             <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Disputes</span>
                <span className={`font-bold ${stats.active_disputes > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {stats.active_disputes}
                </span>
             </div>
             <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">KYC</span>
                <span className={`font-bold ${stats.pending_kyc > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                    {stats.pending_kyc}
                </span>
             </div>
          </div>
        </div>
      </div>

      {/* 3. The Visual Data & Access */}
      <div className="grid gap-6 md:grid-cols-3">
        
        {/* Trend Chart */}
        {canSeeMoney && (
            <div className="md:col-span-2 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Profit Realization</h3>
                        <p className="text-xs text-gray-500">Realized 2% Commisions (Last 7 Days)</p>
                    </div>
                    {chartData.length === 0 && <span className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500">Awaiting Data</span>}
                </div>
                
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.length > 0 ? chartData : [{date: 'Today', revenue: 0}]}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="date" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `₦${value}`} />
                        <Tooltip />
                        <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* Quick Access */}
        <div className={`rounded-xl border border-gray-100 bg-white p-6 shadow-sm ${!canSeeMoney ? 'md:col-span-3' : ''}`}>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Shortcuts</h3>
          <div className="space-y-3">
            {['super_admin', 'moderator', 'support'].includes(role || '') && (
              <QuickLink
                href="/dashboard/moderator"
                icon={ShieldAlert}
                label="KYC Station"
                count={stats.pending_kyc}
                color="orange"
              />
            )}
            {['super_admin', 'finance'].includes(role || '') && (
              <QuickLink
                href="/dashboard/finance"
                icon={Activity}
                label="Dispute Tribunal"
                count={stats.active_disputes}
                color="red"
              />
            )}
            <QuickLink href="/dashboard/users" icon={Users} label="User Manager" count={null} color="blue" />
          </div>

          <div className="mt-6 rounded-lg bg-gray-50 p-4 border border-gray-200 space-y-3">
            <h4 className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Quality gates</h4>
            <p className="text-[11px] text-gray-500">
              Run the end-to-end smoke suite before pushing risky changes.
            </p>
            <a
              href="/docs/QUALITY_AND_ROLLOUT"
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              <PlayCircle className="h-4 w-4 text-green-600" />
              Run smoke tests (read how)
              <ExternalLink className="h-3 w-3 text-gray-400" />
            </a>
          </div>

          <div className="mt-4 rounded-lg bg-gray-50 p-4 border border-gray-200">
            <h4 className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Infrastructure</h4>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">DB Latency</span>
                <span className="font-mono font-bold text-gray-900">{dbLatency || '-'}ms</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Intervention Trends */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Intervention Trends</h3>
            <p className="text-xs text-gray-500">
              {trendWindow} intervention logs grouped by category.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-indigo-50 p-2 text-indigo-600">
              <BarChart3 size={16} />
            </div>
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              {(['24h', '7d', '30d'] as const).map((windowOption) => (
                <button
                  key={windowOption}
                  onClick={() => setTrendWindow(windowOption)}
                  className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                    trendWindow === windowOption
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {windowOption}
                </button>
              ))}
            </div>
          </div>
        </div>

        {interventionTrends.length === 0 ? (
          <p className="text-sm text-gray-400">No intervention category data available yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {interventionTrends.map((item) => (
              <div
                key={`${item.actionType}-${item.category}`}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{item.actionType}</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">{item.category}</p>
                <p className="mt-2 text-xl font-black text-gray-900">{item.count}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function QuickLink({ href, icon: Icon, label, count, color }: any) {
    const colors: any = { 
        orange: "text-orange-600 bg-orange-50", 
        red: "text-red-600 bg-red-50", 
        blue: "text-blue-600 bg-blue-50" 
    }

    return (
        <a href={href} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
                <div className={`rounded-md p-2 ${colors[color]}`}><Icon size={16} /></div>
                <span className="text-sm font-semibold text-gray-700">{label}</span>
            </div>
            {count !== null && count > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${colors[color]}`}>{count}</span>
            )}
             {count === null && <ArrowRight size={14} className="text-gray-400" />}
        </a>
    )
}

function buildInterventionTrends(
  logs: { action_type: string; details: string | null; created_at: string }[]
): { actionType: string; category: string; count: number }[] {
  const aggregate = new Map<string, number>()

  logs.forEach((log) => {
    const actionType = log.action_type
    const details = log.details || ''
    const categoryMatch = details.match(/Category:\s*([a-zA-Z_]+)/)
    const category = categoryMatch ? categoryMatch[1] : 'uncategorized'
    const key = `${actionType}::${category}`
    aggregate.set(key, (aggregate.get(key) || 0) + 1)
  })

  return Array.from(aggregate.entries())
    .map(([key, count]) => {
      const [actionType, category] = key.split('::')
      return { actionType, category, count }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 9)
}

function getSinceISOString(window: '24h' | '7d' | '30d') {
  const now = new Date()
  const since = new Date(now)

  if (window === '24h') {
    since.setHours(now.getHours() - 24)
  } else if (window === '7d') {
    since.setDate(now.getDate() - 7)
  } else {
    since.setDate(now.getDate() - 30)
  }

  return since.toISOString()
}