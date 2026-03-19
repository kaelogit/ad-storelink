export type AdminRole = 'super_admin' | 'moderator' | 'finance' | 'support' | 'content' | 'analyst'

export type AccountStatus = 'active' | 'suspended' | 'banned' | 'pending_appeal'

export type OrderStatus =
  | 'PENDING'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTE_OPEN'

export type TicketStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED'

export type AdminUser = {
  id: string
  email: string
  full_name: string | null
  role: AdminRole
  is_active: boolean
  created_at?: string | null
  last_login?: string | null
  last_login_ip?: string | null
}

export type AdminAuditLog = {
  id: string
  admin_id: string | null
  admin_email: string | null
  action_type: string
  // admin_audit_logs.details is jsonb in DB; can be object or string depending on how it was inserted.
  details: unknown | null
  target_id: string | null
  created_at: string
}
