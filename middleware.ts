import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { allowedRolesForPath } from './src/constants/adminNavigation'
import type { AdminRole } from './src/types/admin'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
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
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  if (!user && path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (user && path.startsWith('/dashboard')) {
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (error || !adminUser) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    if (!adminUser.is_active) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    // Always allow the in-dashboard unauthorized page.
    if (path.startsWith('/dashboard/unauthorized')) {
      return response
    }

    // Legacy alias → super-admin
    if (path.startsWith('/dashboard/staff')) {
      if (adminUser.role !== 'super_admin') {
        return NextResponse.redirect(new URL('/dashboard/unauthorized', request.url))
      }
      return response
    }

    const role = adminUser.role as AdminRole
    const allowed = allowedRolesForPath(path)

    if (allowed && !allowed.includes(role)) {
      return NextResponse.redirect(new URL('/dashboard/unauthorized', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
