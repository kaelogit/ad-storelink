import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type AccountStatus = 'active' | 'suspended' | 'disabled' | 'banned'

type AccountStatusPayload = {
  userId?: string
  accountStatus?: AccountStatus
  reason?: string
  reasonCategory?: string
}

function categoryLabel(category?: string) {
  const c = (category || '').trim().toLowerCase()
  if (c === 'abuse') return 'Abuse / harassment'
  if (c === 'fraud') return 'Fraud / scam'
  if (c === 'policy') return 'Policy violation'
  if (c === 'request') return 'User request'
  if (c === 'other') return 'Other'
  return c || 'Policy violation'
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as AccountStatusPayload
  const userId = body.userId?.trim()
  const accountStatus = body.accountStatus
  const reason = body.reason?.trim()
  const reasonCategory = body.reasonCategory?.trim()

  if (!userId || !accountStatus || !reason) {
    return NextResponse.json(
      { error: 'userId, accountStatus and reason are required' },
      { status: 400 },
    )
  }

  if (!['active', 'suspended', 'disabled', 'banned'].includes(accountStatus)) {
    return NextResponse.json({ error: 'Invalid accountStatus' }, { status: 400 })
  }

  if (reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }

  const { data: current, error: currentError } = await auth.supabase
    .from('profiles')
    .select('account_status, suspension_reason')
    .eq('id', userId)
    .maybeSingle()

  if (currentError || !current) {
    return NextResponse.json({ error: currentError?.message || 'User not found' }, { status: 404 })
  }

  const currentStatus = String(current.account_status || 'active').toLowerCase()

  // Ladder: freeze → disable → ban
  if (accountStatus === 'disabled' && !['suspended', 'pending_appeal'].includes(currentStatus)) {
    return NextResponse.json(
      {
        error:
          'Disable requires an existing suspension. Freeze the account first, then escalate to disabled.',
      },
      { status: 400 },
    )
  }

  if (accountStatus === 'banned' && currentStatus !== 'disabled') {
    return NextResponse.json(
      {
        error: 'Ban requires a disabled account. Disable first, then escalate to ban.',
      },
      { status: 400 },
    )
  }

  if (accountStatus === 'suspended' && ['disabled', 'banned'].includes(currentStatus)) {
    return NextResponse.json(
      { error: 'Reactivate the account before applying a new suspension.' },
      { status: 400 },
    )
  }

  if (accountStatus === 'disabled' && currentStatus === 'banned') {
    return NextResponse.json(
      { error: 'Reactivate the account before applying a new disable.' },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()
  const publicReason =
    accountStatus === 'active'
      ? null
      : `${categoryLabel(reasonCategory)}: ${reason}`

  const clearLockFields = {
    disabled_at: null as string | null,
    disabled_by: null as string | null,
    scheduled_deletion_at: null as string | null,
    banned_at: null as string | null,
  }

  const profilePatch =
    accountStatus === 'suspended'
      ? {
          account_status: 'suspended' as const,
          suspension_reason: publicReason,
          suspension_end_date: null,
          ...clearLockFields,
          updated_at: now,
        }
      : accountStatus === 'disabled'
        ? {
            account_status: 'disabled' as const,
            suspension_reason: publicReason || current.suspension_reason,
            suspension_end_date: null,
            disabled_at: now,
            disabled_by: 'admin' as const,
            scheduled_deletion_at: null,
            banned_at: null,
            updated_at: now,
          }
        : accountStatus === 'banned'
          ? {
              account_status: 'banned' as const,
              suspension_reason: publicReason || current.suspension_reason,
              suspension_end_date: null,
              disabled_at: null,
              disabled_by: null,
              scheduled_deletion_at: null,
              banned_at: now,
              updated_at: now,
            }
          : {
              account_status: 'active' as const,
              suspension_reason: null,
              suspension_end_date: null,
              ...clearLockFields,
              updated_at: now,
            }

  const { error } = await auth.supabase.from('profiles').update(profilePatch).eq('id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Close open appeals on activate / disable / ban.
  if (accountStatus === 'active' || accountStatus === 'disabled' || accountStatus === 'banned') {
    const appealNote =
      accountStatus === 'active'
        ? reason
        : accountStatus === 'banned'
          ? `Account banned. ${reason}`
          : `Account disabled. ${reason}`

    await auth.supabase
      .from('suspension_appeals')
      .update({
        status: accountStatus === 'active' ? 'approved' : 'rejected',
        admin_notes: appealNote,
        updated_at: now,
      })
      .eq('user_id', userId)
      .eq('status', 'pending')
  }

  const notifyTitle =
    accountStatus === 'suspended'
      ? 'Account suspended'
      : accountStatus === 'disabled'
        ? 'Account disabled'
        : accountStatus === 'banned'
          ? 'Account banned'
          : 'Account reinstated'

  const notifyMessage =
    accountStatus === 'suspended'
      ? `Your StoreLink account has been suspended. Reason: ${publicReason}`
      : accountStatus === 'disabled'
        ? `Your StoreLink account has been disabled. Reason: ${publicReason}`
        : accountStatus === 'banned'
          ? `Your StoreLink account has been permanently banned. Reason: ${publicReason}`
          : 'Your StoreLink account has been reinstated. You can use the app again.'

  const deeplink =
    accountStatus === 'suspended'
      ? '/auth/suspended'
      : accountStatus === 'disabled'
        ? '/auth/disabled'
        : accountStatus === 'banned'
          ? '/auth/banned'
          : '/(tabs)'

  try {
    await auth.supabase.from('notifications').insert({
      user_id: userId,
      title: notifyTitle,
      message: notifyMessage,
      type: 'system',
      data: {
        event:
          accountStatus === 'suspended'
            ? 'account_suspended'
            : accountStatus === 'disabled'
              ? 'account_disabled'
              : accountStatus === 'banned'
                ? 'account_banned'
                : 'account_activated',
        reason: publicReason,
        deeplink,
      },
    })
  } catch {
    // Non-fatal
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'USER_STATUS_CHANGE',
    target_id: userId,
    details: {
      message: 'Changed account status.',
      userId,
      previousStatus: currentStatus,
      accountStatus,
      reason,
      reasonCategory: reasonCategory || null,
      suspensionReason: publicReason,
    },
  })

  return NextResponse.json({ ok: true })
}
