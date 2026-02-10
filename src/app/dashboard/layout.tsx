'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  Users, 
  ShieldAlert, 
  Wallet, 
  Headphones, 
  PenTool, 
  LogOut,
  Loader2
} from 'lucide-react'
import { createClient } from '../../utils/supabase/client'

// 1. Define the Menu with Permissions
const navigation = [
  { 
    name: 'Overview', 
    href: '/dashboard', 
    icon: LayoutDashboard, 
    allowedRoles: ['super_admin', 'moderator', 'finance', 'support', 'content'] 
  },
  { 
    name: 'Super Admin', 
    href: '/dashboard/super-admin', 
    icon: Users, 
    allowedRoles: ['super_admin'] 
  },
  { 
    name: 'Moderation', 
    href: '/dashboard/moderator', 
    icon: ShieldAlert, 
    allowedRoles: ['super_admin', 'moderator'] 
  },
  { 
    name: 'Finance', 
    href: '/dashboard/finance', 
    icon: Wallet, 
    allowedRoles: ['super_admin', 'finance'] 
  },
  { 
    name: 'Support', 
    href: '/dashboard/support', 
    icon: Headphones, 
    allowedRoles: ['super_admin', 'support', 'moderator'] 
  },
  { 
    name: 'Content', 
    href: '/dashboard/content', 
    icon: PenTool, 
    allowedRoles: ['super_admin', 'content'] 
  },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  
  // State to store the user's role
  const [userRole, setUserRole] = useState<string | null>(null)
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
          setUserRole(adminUser.role)
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

  // 4. Filter the Menu based on Role
  const visibleNavigation = navigation.filter(item => 
    userRole && item.allowedRoles.includes(userRole)
  )

  return (
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
            const isActive = pathname === item.href
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
                {navigation.find(n => n.href === pathname)?.name || 'Dashboard'}
            </h2>
        </header>

        {/* The Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}