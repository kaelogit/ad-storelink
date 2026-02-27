'use client'

import { useEffect, useState } from 'react'
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
  Activity
} from 'lucide-react'
import { createClient } from '../../utils/supabase/client'
import type { AdminRole } from '../../types/admin'
import { CommandPalette } from '../../components/admin/CommandPalette'

// 1. Define the Menu with Permissions (analyst = read-only access where listed)
const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard, allowedRoles: ['super_admin', 'moderator', 'finance', 'support', 'content', 'analyst'] },
  { name: 'Super Admin', href: '/dashboard/super-admin', icon: UserCog, allowedRoles: ['super_admin'] },
  { name: 'System Settings', href: '/dashboard/settings', icon: Settings, allowedRoles: ['super_admin'] },
  { name: 'Users', href: '/dashboard/users', icon: Users, allowedRoles: ['super_admin', 'moderator', 'analyst'] },
  { name: 'Moderation', href: '/dashboard/moderator', icon: ShieldAlert, allowedRoles: ['super_admin', 'moderator', 'analyst'] },
  { name: 'Finance', href: '/dashboard/finance', icon: Wallet, allowedRoles: ['super_admin', 'finance', 'analyst'] },
  { name: 'Support', href: '/dashboard/support', icon: Headphones, allowedRoles: ['super_admin', 'support', 'moderator', 'analyst'] },
  { name: 'Content', href: '/dashboard/content', icon: PenTool, allowedRoles: ['super_admin', 'content', 'analyst'] },
  { name: 'Audit Log', href: '/dashboard/audit', icon: History, allowedRoles: ['super_admin', 'analyst'] },
  { name: 'Observability', href: '/dashboard/observability', icon: Activity, allowedRoles: ['super_admin', 'analyst'] },
]

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  moderator: 'Moderator',
  finance: 'Finance',
  support: 'Support',
  content: 'Content',
  analyst: 'Analyst',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  
  // State to store the user's role
  const [userRole, setUserRole] = useState<AdminRole | null>(null)
  const [loading, setLoading] = useState(true)

  // 2. Fetch User Role on Load
  useEffect(() => {
    const getUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
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
    getUserRole()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // 3. Loading State (Prevent flickering)
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // 4. Split navigation into allowed vs locked for better operator clarity.
  const visibleNavigation = navigation.filter((item) => userRole && item.allowedRoles.includes(userRole))
  const lockedNavigation = navigation.filter((item) => !userRole || !item.allowedRoles.includes(userRole))

  const isActiveRoute = (href: string) => {
    if (href === '/dashboard') return pathname === href
    return pathname.startsWith(href)
  }

  const currentNav = navigation.find((item) => isActiveRoute(item.href))
  const commandPaletteItems = visibleNavigation.map((item) => ({ name: item.name, href: item.href }))

  return (
    <>
      <CommandPalette items={commandPaletteItems} />
      <div className="flex h-screen bg-gray-50">
      {/* SIDEBAR */}
      <div className="hidden w-64 flex-col bg-white border-r border-gray-200 md:flex">
        
        {/* Logo Area */}
        <div className="flex h-16 items-center px-6 border-b border-gray-100">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            StoreLink <span className="text-blue-600">Admin</span>
          </h1>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {visibleNavigation.map((item) => {
            const isActive = isActiveRoute(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.name}
              </Link>
            )
          })}

          {lockedNavigation.length > 0 && (
            <div className="pt-4">
              <p className="px-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Restricted</p>
              <div className="mt-2 space-y-1">
                {lockedNavigation.map((item) => (
                  <div
                    key={`locked-${item.name}`}
                    className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 text-sm text-gray-400"
                    title={`Requires role: ${item.allowedRoles.map((role) => ROLE_LABELS[role as AdminRole]).join(', ')}`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 text-gray-300" />
                      <span>{item.name}</span>
                    </div>
                    <Lock className="h-4 w-4 text-gray-300" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile / Logout Area */}
        <div className="border-t border-gray-200 p-4">
          <div className="mb-4 flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
               {/* Show first letter of Role as avatar */}
               {userRole?.charAt(0).toUpperCase()}
            </div>
            <div className="text-xs">
                <p className="font-medium text-gray-900 capitalize">{userRole?.replace('_', ' ')}</p>
                <p className="text-gray-500">Active</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
            <h2 className="text-lg font-semibold text-gray-800">
                {currentNav?.name || 'Dashboard'}
            </h2>
        </header>

        {/* The Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
    </>
  )
}