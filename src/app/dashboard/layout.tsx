'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  UserCog,
  ShieldAlert,
  Wallet,
  Headphones,
  PenTool,
  Settings,
  LogOut,
  Loader2,
  Lock,
  History,
  Activity,
  ShieldCheck,
  Package,
  Globe,
  CalendarCheck,
  List,
  ShoppingBag,
  HandCoins,
  Sparkles,
  Clapperboard,
  CircleDot,
  MessageSquare,
  MessagesSquare,
  Gift,
  FlaskConical,
  Flag,
  BrainCircuit,
  LayoutGrid,
  Coins,
  Zap,
  BarChart3,
  TrendingUp,
  FileText,
  CreditCard,
  Inbox,
  Shield,
  Megaphone,
  CircleDollarSign,
  UsersRound,
  Menu,
  X,
} from 'lucide-react'
import { createClient } from '../../utils/supabase/client'
import type { AdminRole } from '../../types/admin'
import { CommandPalette } from '../../components/admin/CommandPalette'
import { CountryFilterProvider, useCountryFilter } from '../../contexts/CountryFilterContext'
import { SUPPORTED_COUNTRIES } from '../../constants/SupportedCountries'
import {
  ADMIN_NAV_GROUPS,
  ADMIN_NAVIGATION,
  type AdminNavItem,
} from '../../constants/adminNavigation'

const ICON_MAP = {
  LayoutDashboard,
  Users,
  UserCog,
  ShieldAlert,
  Wallet,
  Headphones,
  PenTool,
  Settings,
  History,
  Activity,
  ShieldCheck,
  Package,
  Globe,
  CalendarCheck,
  List,
  ShoppingBag,
  HandCoins,
  Sparkles,
  Clapperboard,
  CircleDot,
  MessageSquare,
  MessagesSquare,
  Gift,
  FlaskConical,
  Flag,
  BrainCircuit,
  LayoutGrid,
  Coins,
  Zap,
  BarChart3,
  TrendingUp,
  FileText,
  CreditCard,
  Inbox,
  Shield,
  Megaphone,
  CircleDollarSign,
  UsersRound,
} as const

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  moderator: 'Moderator',
  finance: 'Finance',
  support: 'Support',
  content: 'Content',
  analyst: 'Analyst',
}

function NavLink({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: AdminNavItem
  active: boolean
  badge?: number
  onNavigate?: () => void
}) {
  const Icon = ICON_MAP[item.icon]
  const showBadge = typeof badge === 'number' && badge > 0
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
        active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
      <span className="min-w-0 flex-1 truncate">{item.name}</span>
      {showBadge ? (
        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Link>
  )
}

function NavSections({
  visible,
  locked,
  pathname,
  badges,
  onNavigate,
}: {
  visible: AdminNavItem[]
  locked: AdminNavItem[]
  pathname: string
  badges: Partial<Record<NonNullable<AdminNavItem['badgeKey']>, number>>
  onNavigate?: () => void
}) {
  const isActiveRoute = (href: string) => {
    if (href === '/dashboard') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div className="space-y-4">
      {ADMIN_NAV_GROUPS.map((group) => {
        const items = visible.filter((i) => i.group === group.id)
        if (items.length === 0) return null
        return (
          <div key={group.id}>
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              {group.label}
            </p>
            <div className="space-y-1">
              {items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActiveRoute(item.href)}
                  badge={item.badgeKey ? badges[item.badgeKey] : undefined}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        )
      })}

      {locked.length > 0 ? (
        <div className="pt-2">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Restricted</p>
          <div className="mt-2 space-y-1">
            {locked.map((item) => {
              const Icon = ICON_MAP[item.icon]
              return (
                <div
                  key={`locked-${item.href}`}
                  className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 text-sm text-gray-400"
                  title={`Requires role: ${item.allowedRoles.map((role) => ROLE_LABELS[role]).join(', ')}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-gray-300" />
                    <span>{item.name}</span>
                  </div>
                  <Lock className="h-4 w-4 text-gray-300" />
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [userRole, setUserRole] = useState<AdminRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [queueBadges, setQueueBadges] = useState<
    Partial<Record<NonNullable<AdminNavItem['badgeKey']>, number>>
  >({})

  useEffect(() => {
    const getUserRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('role')
          .eq('id', user.id)
          .single()

        if (adminUser) {
          setUserRole(adminUser.role as AdminRole)
        }
      }
      setLoading(false)
    }
    void getUserRole()
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadBadges = async () => {
      try {
        const res = await fetch('/api/admin/queue-counts')
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        setQueueBadges({
          kyc: Number(data.kyc || 0),
          ads: Number(data.ads || 0),
          disputes: Number(data.disputes || 0),
          reports: Number(data.reports || 0),
        })
      } catch {
        /* ignore badge poll errors */
      }
    }
    void loadBadges()
    const id = window.setInterval(() => void loadBadges(), 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [pathname])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleNavigation = useMemo(
    () => ADMIN_NAVIGATION.filter((item) => userRole && item.allowedRoles.includes(userRole)),
    [userRole],
  )
  const lockedNavigation = useMemo(
    () => ADMIN_NAVIGATION.filter((item) => !userRole || !item.allowedRoles.includes(userRole)),
    [userRole],
  )

  const isActiveRoute = (href: string) => {
    if (href === '/dashboard') return pathname === href
    return pathname.startsWith(href)
  }

  const currentNav = [...ADMIN_NAVIGATION]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isActiveRoute(item.href))

  const commandPaletteItems = visibleNavigation.map((item) => ({ name: item.name, href: item.href }))

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const sidebarBody = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-gray-100 px-6">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">
          StoreLink <span className="text-blue-600">Admin</span>
        </h1>
        <button
          type="button"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <NavSections
          visible={visibleNavigation}
          locked={lockedNavigation}
          pathname={pathname}
          badges={queueBadges}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="mb-4 flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            {userRole?.charAt(0).toUpperCase()}
          </div>
          <div className="text-xs">
            <p className="font-medium capitalize text-gray-900">{userRole?.replace('_', ' ')}</p>
            <p className="text-gray-500">Active</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-all hover:bg-red-50"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </>
  )

  return (
    <CountryFilterProvider>
      <CommandPalette items={commandPaletteItems} />
      <div className="flex h-screen bg-gray-50">
        <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white md:flex">{sidebarBody}</aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close overlay"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl">
              {sidebarBody}
            </aside>
          </div>
        ) : null}

        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader
            currentNav={currentNav}
            onOpenMobile={() => setMobileOpen(true)}
          />
          <main className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </CountryFilterProvider>
  )
}

function DashboardHeader({
  currentNav,
  onOpenMobile,
}: {
  currentNav: AdminNavItem | undefined
  onOpenMobile: () => void
}) {
  const { countryCode, setCountryCode } = useCountryFilter()
  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
          onClick={onOpenMobile}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="truncate text-lg font-semibold text-gray-800">
          {currentNav?.name || 'Dashboard'}
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-sm font-medium text-gray-500 sm:inline">Country</span>
        <Globe className="h-4 w-4 text-gray-400" />
        <select
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          className="max-w-[140px] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:max-w-none sm:px-3"
        >
          {SUPPORTED_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
      </div>
    </header>
  )
}
