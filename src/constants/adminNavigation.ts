import type { AdminRole } from '../types/admin'

export type AdminNavItem = {
  name: string
  href: string
  /** lucide icon name key resolved in layout */
  icon:
    | 'LayoutDashboard'
    | 'UserCog'
    | 'Settings'
    | 'Users'
    | 'Gift'
    | 'BarChart3'
    | 'TrendingUp'
    | 'Globe'
    | 'FileText'
    | 'ShieldAlert'
    | 'Inbox'
    | 'Shield'
    | 'Wallet'
    | 'CreditCard'
    | 'Package'
    | 'CalendarCheck'
    | 'HandCoins'
    | 'List'
    | 'ShoppingBag'
    | 'Zap'
    | 'Sparkles'
    | 'Clapperboard'
    | 'CircleDot'
    | 'MessageSquare'
    | 'MessagesSquare'
    | 'UsersRound'
    | 'Headphones'
    | 'PenTool'
    | 'Megaphone'
    | 'CircleDollarSign'
    | 'LayoutGrid'
    | 'Coins'
    | 'History'
    | 'Flag'
    | 'FlaskConical'
    | 'BrainCircuit'
    | 'Activity'
    | 'ShieldCheck'
  allowedRoles: AdminRole[]
  group: AdminNavGroupId
  /** Optional sidebar badge sourced from /api/admin/queue-counts */
  badgeKey?: 'kyc' | 'ads' | 'disputes' | 'reports'
}

export type AdminNavGroupId =
  | 'overview'
  | 'trust'
  | 'money'
  | 'catalog'
  | 'social'
  | 'ads'
  | 'growth'
  | 'platform'

export const ADMIN_NAV_GROUPS: { id: AdminNavGroupId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'trust', label: 'Trust & safety' },
  { id: 'money', label: 'Money' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'social', label: 'Social' },
  { id: 'ads', label: 'Ads' },
  { id: 'growth', label: 'Growth' },
  { id: 'platform', label: 'Platform' },
]

/** Single source of truth for sidebar + middleware RBAC. */
export const ADMIN_NAVIGATION: AdminNavItem[] = [
  { name: 'Overview', href: '/dashboard', icon: 'LayoutDashboard', allowedRoles: ['super_admin', 'moderator', 'finance', 'support', 'content', 'analyst'], group: 'overview' },
  { name: 'Super Admin', href: '/dashboard/super-admin', icon: 'UserCog', allowedRoles: ['super_admin'], group: 'platform' },
  { name: 'System Settings', href: '/dashboard/settings', icon: 'Settings', allowedRoles: ['super_admin'], group: 'platform' },
  { name: 'Users', href: '/dashboard/users', icon: 'Users', allowedRoles: ['super_admin', 'moderator', 'analyst'], group: 'trust' },
  { name: 'Moderation', href: '/dashboard/moderator', icon: 'ShieldAlert', allowedRoles: ['super_admin', 'moderator', 'analyst'], group: 'trust', badgeKey: 'kyc' },
  { name: 'Report Inbox', href: '/dashboard/content-reports', icon: 'Inbox', allowedRoles: ['super_admin', 'moderator', 'support', 'analyst', 'content'], group: 'trust', badgeKey: 'reports' },
  { name: 'Listing Integrity', href: '/dashboard/listing-integrity', icon: 'Shield', allowedRoles: ['super_admin', 'moderator', 'support', 'analyst', 'content'], group: 'trust' },
  { name: 'Finance', href: '/dashboard/finance', icon: 'Wallet', allowedRoles: ['super_admin', 'finance', 'analyst'], group: 'money', badgeKey: 'disputes' },
  { name: 'Payment Incidents', href: '/dashboard/payment-incidents', icon: 'CreditCard', allowedRoles: ['super_admin', 'finance', 'support', 'analyst'], group: 'money' },
  { name: 'Transaction Ops', href: '/dashboard/orders', icon: 'Package', allowedRoles: ['super_admin', 'finance', 'support'], group: 'money' },
  { name: 'Bookings', href: '/dashboard/bookings', icon: 'CalendarCheck', allowedRoles: ['super_admin', 'finance', 'support'], group: 'money' },
  { name: 'Clawback Debts', href: '/dashboard/clawback-debts', icon: 'HandCoins', allowedRoles: ['super_admin', 'finance', 'support', 'analyst'], group: 'money' },
  { name: 'Service Listings', href: '/dashboard/service-listings', icon: 'List', allowedRoles: ['super_admin', 'finance', 'support', 'analyst'], group: 'catalog' },
  { name: 'Products', href: '/dashboard/products', icon: 'ShoppingBag', allowedRoles: ['super_admin', 'finance', 'support', 'analyst', 'moderator'], group: 'catalog' },
  { name: 'Flash Drops', href: '/dashboard/flash-drops', icon: 'Zap', allowedRoles: ['super_admin', 'finance', 'support', 'analyst', 'moderator'], group: 'catalog' },
  { name: 'Spotlight', href: '/dashboard/spotlight', icon: 'Sparkles', allowedRoles: ['super_admin', 'moderator', 'support', 'analyst'], group: 'social' },
  { name: 'Reels', href: '/dashboard/reels', icon: 'Clapperboard', allowedRoles: ['super_admin', 'moderator', 'support', 'analyst'], group: 'social' },
  { name: 'Stories', href: '/dashboard/stories', icon: 'CircleDot', allowedRoles: ['super_admin', 'moderator', 'support', 'analyst', 'content'], group: 'social' },
  { name: 'Comments', href: '/dashboard/comments', icon: 'MessageSquare', allowedRoles: ['super_admin', 'moderator', 'support', 'analyst', 'content'], group: 'social' },
  { name: 'P2P Chats', href: '/dashboard/chats', icon: 'MessagesSquare', allowedRoles: ['super_admin', 'moderator', 'support', 'analyst'], group: 'social' },
  { name: 'Communities', href: '/dashboard/groups', icon: 'UsersRound', allowedRoles: ['super_admin', 'moderator', 'support', 'analyst'], group: 'social' },
  { name: 'Support', href: '/dashboard/support', icon: 'Headphones', allowedRoles: ['super_admin', 'support', 'moderator', 'analyst'], group: 'trust' },
  { name: 'Content', href: '/dashboard/content', icon: 'PenTool', allowedRoles: ['super_admin', 'content', 'analyst'], group: 'growth' },
  { name: 'House Ads', href: '/dashboard/house-ads', icon: 'Megaphone', allowedRoles: ['super_admin', 'content', 'analyst'], group: 'ads' },
  { name: 'Ad Campaigns', href: '/dashboard/ads', icon: 'CircleDollarSign', allowedRoles: ['super_admin', 'moderator', 'content', 'support', 'analyst'], group: 'ads', badgeKey: 'ads' },
  { name: 'Ads Reporting', href: '/dashboard/ads/reporting', icon: 'TrendingUp', allowedRoles: ['super_admin', 'analyst', 'finance'], group: 'ads' },
  { name: 'Curations', href: '/dashboard/curations', icon: 'LayoutGrid', allowedRoles: ['super_admin', 'moderator', 'content', 'analyst'], group: 'growth' },
  { name: 'Loyalty', href: '/dashboard/loyalty', icon: 'Coins', allowedRoles: ['super_admin', 'finance', 'support', 'analyst', 'content'], group: 'growth' },
  { name: 'Referrals', href: '/dashboard/referrals', icon: 'Gift', allowedRoles: ['super_admin', 'finance', 'support', 'analyst'], group: 'growth' },
  { name: 'Onboarding', href: '/dashboard/onboarding', icon: 'BarChart3', allowedRoles: ['super_admin', 'analyst'], group: 'growth' },
  { name: 'Analytics', href: '/dashboard/analytics', icon: 'TrendingUp', allowedRoles: ['super_admin', 'analyst'], group: 'growth' },
  { name: 'Geo Policy', href: '/dashboard/geo-policy', icon: 'Globe', allowedRoles: ['super_admin', 'analyst'], group: 'platform' },
  { name: 'Legal & Policy', href: '/dashboard/legal-policy', icon: 'FileText', allowedRoles: ['super_admin', 'content', 'analyst'], group: 'platform' },
  { name: 'Audit Log', href: '/dashboard/audit', icon: 'History', allowedRoles: ['super_admin', 'analyst'], group: 'platform' },
  { name: 'Feature Flags', href: '/dashboard/feature-flags', icon: 'Flag', allowedRoles: ['super_admin', 'analyst'], group: 'platform' },
  { name: 'Experiments', href: '/dashboard/experiments', icon: 'FlaskConical', allowedRoles: ['super_admin', 'analyst'], group: 'platform' },
  { name: 'Search AI', href: '/dashboard/search-embeddings', icon: 'BrainCircuit', allowedRoles: ['super_admin'], group: 'platform' },
  { name: 'Observability', href: '/dashboard/observability', icon: 'Activity', allowedRoles: ['super_admin', 'analyst'], group: 'platform' },
  { name: 'QA Hub', href: '/dashboard/safety-tests', icon: 'ShieldCheck', allowedRoles: ['super_admin', 'analyst'], group: 'platform' },
]

/** Longest-prefix match for a dashboard path → allowed roles. */
export function allowedRolesForPath(pathname: string): AdminRole[] | null {
  if (!pathname.startsWith('/dashboard')) return null
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return ADMIN_NAVIGATION.find((i) => i.href === '/dashboard')?.allowedRoles ?? null
  }
  const matches = ADMIN_NAVIGATION
    .filter((i) => i.href !== '/dashboard' && pathname.startsWith(i.href))
    .sort((a, b) => b.href.length - a.href.length)
  return matches[0]?.allowedRoles ?? null
}

export function profileAvatarUrl(opts: {
  logoUrl?: string | null
  displayName?: string | null
  userId?: string | null
}): string {
  const logo = String(opts.logoUrl || '').trim()
  if (logo) return logo
  const name = String(opts.displayName || opts.userId || 'User').trim() || 'User'
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e2e8f0&color=1e293b`
}
