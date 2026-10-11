import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type Body = {
  appealId?: string
  userId?: string
  decision?: 'approve' | 'reject'
  adminNotes?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const appealId = body.appealId?.trim()
  const userId = body.userId?.trim()
  const decision = body.decision
  const adminNotes = body.adminNotes?.trim() ?? ''

  if (!appealId || !userId || !decision) {
    return NextResponse.json(
      { error: 'appealId, userId and decision are required' },
      { status: 400 },
    )
  }

  if (decision === 'reject' && adminNotes.length < 10) {
    return NextResponse.json(
      { error: 'Rejection requires admin notes (min 10 characters)' },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()

  const { error: appealError } = await auth.supabase
    .from('suspension_appeals')
    .update({
      status: decision === 'approve' ? 'approved' : 'rejected',
      admin_notes: adminNotes || null,
      updated_at: now,
    })
    .eq('id', appealId)
    .eq('user_id', userId)

  if (appealError) {
    return NextResponse.json({ error: appealError.message }, { status: 400 })
  }

  if (decision === 'approve') {
    const { error: profileError } = await auth.supabase
      .from('profiles')
      .update({
        account_status: 'active',
        suspension_reason: null,
        suspension_end_date: null,
        updated_at: now,
      })
      .eq('id', userId)
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    try {
      await auth.supabase.from('notifications').insert({
        user_id: userId,
        title: 'Appeal approved',
        message: 'Your suspension appeal was approved. Your StoreLink account is active again.',
        type: 'system',
        data: {
          event: 'suspension_appeal_approved',
          appealId,
          deeplink: '/(tabs)',
        },
      })
    } catch {
      // Non-fatal
    }
  } else {
    // Reject: keep the user locked. pending_appeal must return to suspended.
    const { data: profile } = await auth.supabase
      .from('profiles')
      .select('suspension_reason')
      .eq('id', userId)
      .maybeSingle()

    const { error: profileError } = await auth.supabase
      .from('profiles')
      .update({
        account_status: 'suspended',
        suspension_reason:
          profile?.suspension_reason ||
          'Your appeal was reviewed and the suspension remains in place.',
        updated_at: now,
      })
      .eq('id', userId)
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    try {
      await auth.supabase.from('notifications').insert({
        user_id: userId,
        title: 'Appeal rejected',
        message: `Your suspension appeal was not approved. ${adminNotes}`,
        type: 'system',
        data: {
          event: 'suspension_appeal_rejected',
          appealId,
          adminNotes,
          deeplink: '/auth/suspended',
        },
      })
    } catch {
      // Non-fatal
    }
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'APPEAL_DECISION',
    target_id: userId,
    details: {
      message: `Appeal ${decision === 'approve' ? 'Approved' : 'Rejected'}.`,
      appealId,
      userId,
      decision,
      adminNotes: adminNotes || null,
      resultingStatus: decision === 'approve' ? 'active' : 'suspended',
    },
  })

  return NextResponse.json({ ok: true })
}
