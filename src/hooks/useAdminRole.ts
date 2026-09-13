'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import type { AdminRole } from '../types/admin'

/** Analyst is read-only for write desks; APIs already 403. */
export function adminRoleCanWrite(role: AdminRole | null | undefined): boolean {
  return !!role && role !== 'analyst'
}

export function useAdminRole() {
  const [role, setRole] = useState<AdminRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) {
          setRole(null)
          setLoading(false)
        }
        return
      }
      const { data } = await supabase.from('admin_users').select('role').eq('id', user.id).single()
      if (!cancelled) {
        setRole((data?.role as AdminRole) || null)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    role,
    loading,
    canWrite: adminRoleCanWrite(role),
  }
}
