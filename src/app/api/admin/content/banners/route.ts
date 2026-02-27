import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type CreateBannerPayload = {
  imageUrl?: string
  title?: string
}

type DeleteBannerPayload = {
  bannerId?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as CreateBannerPayload
  const imageUrl = body.imageUrl?.trim()
  const title = body.title?.trim()

  if (!imageUrl || !title) {
    return NextResponse.json({ error: 'imageUrl and title are required' }, { status: 400 })
  }

  const { error } = await auth.supabase.from('banners').insert({
    image_url: imageUrl,
    title,
    is_active: true,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'BANNER_CREATE',
    details: `Created banner: ${title}`,
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as DeleteBannerPayload
  const bannerId = body.bannerId?.trim()

  if (!bannerId) {
    return NextResponse.json({ error: 'bannerId is required' }, { status: 400 })
  }

  const { error } = await auth.supabase.from('banners').delete().eq('id', bannerId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'BANNER_DELETE',
    target_id: bannerId,
    details: 'Deleted banner.',
  })

  return NextResponse.json({ ok: true })
}
