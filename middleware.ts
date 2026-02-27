import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Initialize the Response
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // 2. Check Authentication (Are they logged in?)
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Case A: Not logged in -> Kick to Login
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Already logged in users should not see login page.
  if (user && path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Case B: Logged in -> Check their Rank
  if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
    
    // Fetch the specific Admin User data to get their Role
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    // 3. Security Check: Are they actually an Admin?
    // If query fails or returns null, they are just a regular user trying to hack in.
    if (error || !adminUser) {
      // Redirect to a "Not Allowed" page or just back to the main site
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    if (!adminUser.is_active) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    const role = adminUser.role;

    // 4. Role-Based Access Control (RBAC) - The "VIP Areas"
    // We strictly define who is allowed where.

    // 👑 Super Admin Area (Staff Management)
    // Only the CTO/CEO can enter here.
    if (path.startsWith('/dashboard/super-admin') && role !== 'super_admin') {
      return NextResponse.redirect(new URL('/dashboard/unauthorized', request.url));
    }

    // 💸 Finance Area (Money & Disputes)
    // Only Finance Team OR Super Admin
    if (path.startsWith('/dashboard/finance') && !['super_admin', 'finance', 'analyst'].includes(role)) {
       return NextResponse.redirect(new URL('/dashboard/unauthorized', request.url));
    }

    // 🛡️ Moderator Area (KYC, Reports, Users)
    // Only Moderators OR Super Admin
    if (path.startsWith('/dashboard/moderator') && !['super_admin', 'moderator', 'analyst'].includes(role)) {
       return NextResponse.redirect(new URL('/dashboard/unauthorized', request.url));
    }

    // 🎧 Support Area (Tickets, Order Lookup)
    // Support Team, Moderators, OR Super Admin
    if (path.startsWith('/dashboard/support') && !['super_admin', 'support', 'moderator', 'analyst'].includes(role)) {
       return NextResponse.redirect(new URL('/dashboard/unauthorized', request.url));
    }

    // 🎨 Content Area (Blogs, Broadcasts)
    if (path.startsWith('/dashboard/content') && !['super_admin', 'content', 'analyst'].includes(role)) {
       return NextResponse.redirect(new URL('/dashboard/unauthorized', request.url));
    }

    // 👥 Users (list + dossier)
    if (path.startsWith('/dashboard/users') && !['super_admin', 'moderator', 'analyst'].includes(role)) {
       return NextResponse.redirect(new URL('/dashboard/unauthorized', request.url));
    }

    // 📊 Audit Log & Observability
    if ((path.startsWith('/dashboard/audit') || path.startsWith('/dashboard/observability')) && !['super_admin', 'analyst'].includes(role)) {
       return NextResponse.redirect(new URL('/dashboard/unauthorized', request.url));
    }
  }

  return response
}

export const config = {
  // Apply this middleware to the dashboard and login routes
  matcher: ['/dashboard/:path*', '/login'],
}