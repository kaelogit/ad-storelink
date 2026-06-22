/**
 * Activity feed aggregation (parity with store-link-mobile/app/activity.tsx).
 */

export type ActivitySender = {
  id?: string
  slug?: string | null
  logo_url?: string | null
  subscription_plan?: string | null
}

export type RawActivity = {
  id: string
  type:
    | 'LIKE'
    | 'COMMENT'
    | 'ORDER'
    | 'FOLLOW'
    | 'COIN'
    | 'CHAT'
    | 'COMMENT_LIKE'
    | 'REPLY'
    | 'CART_ADD'
    | 'WISHLIST_ADD'
    | 'SERVICE_BOOKING'
    | 'SUPPORT'
    | 'DISPUTE'
    | 'VERIFICATION'
    | 'PAYOUT'
    | 'SPOTLIGHT'
    | 'SYSTEM'
    | 'SECTION'
  created_at: string
  sender?: ActivitySender
  user_id?: string
  amount?: number
  product_id?: string
  comment_id?: string
  chat_id?: string
  transaction_type?: string
  comment_text?: string
  reference?: string
  products?: { id: string; name: string; slug?: string | null; image_urls?: string[] }
  service_order_id?: string
  booking_event?: string
  booking_role?: 'buyer' | 'seller'
  ticket_id?: string
  dispute_id?: string
  payout_id?: string
  spotlight_post_id?: string
  meta?: unknown
  message?: string
  sectionLabel?: string
}

export type GroupedActivity = RawActivity & {
  count: number
  senders: ActivitySender[]
}

export function aggregateFeed(rawFeed: RawActivity[]): GroupedActivity[] {
  const groups: Record<string, GroupedActivity> = {}
  const groupedItems: GroupedActivity[] = []

  rawFeed.forEach((item) => {
    if (item.type === 'SECTION') return
    let key = item.id

    if (item.type === 'LIKE') key = `LIKE_${item.product_id}`
    else if (item.type === 'FOLLOW') key = `FOLLOW_${item.sender?.id}`
    else if (item.type === 'CHAT') key = `CHAT_${item.chat_id}`
    else if (item.type === 'COIN') key = `COIN_${item.id}`
    else if (item.type === 'ORDER') key = `ORDER_${item.id}`

    if (!groups[key]) {
      groups[key] = {
        ...item,
        count: 1,
        senders: item.sender ? [item.sender] : [],
      }
      groupedItems.push(groups[key])
    } else {
      const group = groups[key]
      group.count += 1
      if (item.sender && !group.senders.some((s) => s.id === item.sender?.id)) {
        group.senders.push(item.sender)
      }
      if (new Date(item.created_at) > new Date(group.created_at)) {
        group.created_at = item.created_at
      }
    }
  })

  const sorted = groupedItems.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfWeek.getDate() - 7)

  const withSections: GroupedActivity[] = []
  let hasToday = false
  let hasWeek = false
  let hasEarlier = false

  sorted.forEach((item) => {
    const created = new Date(item.created_at)
    let bucket: 'TODAY' | 'WEEK' | 'EARLIER'
    if (created >= startOfToday) bucket = 'TODAY'
    else if (created >= startOfWeek) bucket = 'WEEK'
    else bucket = 'EARLIER'

    if (bucket === 'TODAY' && !hasToday) {
      withSections.push({
        id: 'section_today',
        type: 'SECTION',
        created_at: now.toISOString(),
        sectionLabel: 'Today',
        count: 0,
        senders: [],
      })
      hasToday = true
    } else if (bucket === 'WEEK' && !hasWeek) {
      withSections.push({
        id: 'section_week',
        type: 'SECTION',
        created_at: now.toISOString(),
        sectionLabel: 'This week',
        count: 0,
        senders: [],
      })
      hasWeek = true
    } else if (bucket === 'EARLIER' && !hasEarlier) {
      withSections.push({
        id: 'section_earlier',
        type: 'SECTION',
        created_at: now.toISOString(),
        sectionLabel: 'Earlier',
        count: 0,
        senders: [],
      })
      hasEarlier = true
    }

    withSections.push(item)
  })

  return withSections
}

type ActivitySourcesPayload = {
  today_views?: number
  social?: { likes?: unknown[]; comments?: unknown[]; follows?: unknown[] }
  comment_likes?: unknown[]
  orders?: unknown[]
  coin_transactions?: unknown[]
  unread_messages?: unknown[]
  cart_add_notifications?: unknown[]
  wishlist_add_notifications?: unknown[]
  booking_notifications?: unknown[]
  extra_notifications?: unknown[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asSender(value: unknown): ActivitySender | undefined {
  const row = asRecord(value)
  if (!row.id) return undefined
  return {
    id: String(row.id),
    slug: row.slug != null ? String(row.slug) : null,
    logo_url: row.logo_url != null ? String(row.logo_url) : null,
    subscription_plan: row.subscription_plan != null ? String(row.subscription_plan) : null,
  }
}

function asProducts(value: unknown) {
  const row = asRecord(value)
  if (!row.id) return undefined
  return {
    id: String(row.id),
    name: String(row.name || 'Item'),
    slug: row.slug != null ? String(row.slug) : null,
    image_urls: Array.isArray(row.image_urls) ? row.image_urls.map(String) : [],
  }
}

export function buildRawActivityFeed(sources: ActivitySourcesPayload, userId: string): RawActivity[] {
  const social = sources.social || {}

  const cartAddActivities: RawActivity[] = (sources.cart_add_notifications || []).map((n) => {
    const row = asRecord(n)
    const data = asRecord(row.data)
    const buyerId = data.buyer_id ? String(data.buyer_id) : undefined
    const buyerProfile = asSender(row.buyer_profile)
    return {
      id: String(row.id),
      type: 'CART_ADD',
      created_at: String(row.created_at || new Date().toISOString()),
      product_id: data.product_id ? String(data.product_id) : undefined,
      sender: buyerProfile || (buyerId ? { id: buyerId } : undefined),
    }
  })

  const wishlistAddActivities: RawActivity[] = (sources.wishlist_add_notifications || []).map((n) => {
    const row = asRecord(n)
    const data = asRecord(row.data)
    const buyerId = data.buyer_id ? String(data.buyer_id) : undefined
    const buyerProfile = asSender(row.buyer_profile)
    return {
      id: String(row.id),
      type: 'WISHLIST_ADD',
      created_at: String(row.created_at || new Date().toISOString()),
      product_id: data.product_id ? String(data.product_id) : undefined,
      sender: buyerProfile || (buyerId ? { id: buyerId } : undefined),
    }
  })

  const bookingActivities: RawActivity[] = (sources.booking_notifications || []).map((n) => {
    const row = asRecord(n)
    const data = asRecord(row.data)
    return {
      id: String(row.id),
      type: 'SERVICE_BOOKING',
      created_at: String(row.created_at || new Date().toISOString()),
      service_order_id: data.service_order_id ? String(data.service_order_id) : undefined,
      booking_event: data.event ? String(data.event) : undefined,
      booking_role: data.role === 'buyer' || data.role === 'seller' ? data.role : undefined,
    }
  })

  const extraActivities: RawActivity[] = (sources.extra_notifications || []).map((n) => {
    const row = asRecord(n)
    const data = asRecord(row.data)
    const t = String(row.type || '').toLowerCase()
    const base = {
      id: String(row.id),
      created_at: String(row.created_at || new Date().toISOString()),
      message: row.message != null ? String(row.message) : undefined,
      meta: data,
    }
    if (t === 'support') {
      return { ...base, type: 'SUPPORT' as const, ticket_id: data.ticket_id ? String(data.ticket_id) : undefined }
    }
    if (t === 'dispute') {
      return {
        ...base,
        type: 'DISPUTE' as const,
        dispute_id: data.dispute_id ? String(data.dispute_id) : undefined,
        service_order_id: data.service_order_id ? String(data.service_order_id) : undefined,
      }
    }
    if (t === 'verification') return { ...base, type: 'VERIFICATION' as const }
    if (t === 'payout') {
      return { ...base, type: 'PAYOUT' as const, payout_id: data.payout_id ? String(data.payout_id) : undefined }
    }
    if (t === 'spotlight_tag') {
      return {
        ...base,
        type: 'SPOTLIGHT' as const,
        spotlight_post_id: data.spotlight_post_id ? String(data.spotlight_post_id) : undefined,
      }
    }
    return { ...base, type: 'SYSTEM' as const }
  })

  const raw: RawActivity[] = [
    ...(social.likes || []).map((l) => {
      const row = asRecord(l)
      const products = asProducts(row.products)
      return {
        ...row,
        id: String(row.id),
        type: 'LIKE' as const,
        created_at: String(row.created_at || new Date().toISOString()),
        product_id: products?.id,
        products,
        sender: asSender(row.sender),
      } as RawActivity
    }),
    ...(social.comments || []).map((c) => {
      const row = asRecord(c)
      const products = asProducts(row.products)
      return {
        ...row,
        id: String(row.id),
        type: (row.parent_id ? 'REPLY' : 'COMMENT') as 'REPLY' | 'COMMENT',
        created_at: String(row.created_at || new Date().toISOString()),
        product_id: products?.id,
        comment_id: String(row.id),
        comment_text: row.text != null ? String(row.text) : undefined,
        products,
        sender: asSender(row.sender),
      } as RawActivity
    }),
    ...(social.follows || []).map((f) => {
      const row = asRecord(f)
      return {
        ...row,
        id: String(row.id),
        type: 'FOLLOW' as const,
        created_at: String(row.created_at || new Date().toISOString()),
        sender: asSender(row.sender),
      } as RawActivity
    }),
    ...(sources.comment_likes || []).map((cl) => {
      const row = asRecord(cl)
      const comment = asRecord(row.comment)
      return {
        ...row,
        id: String(row.id),
        type: 'COMMENT_LIKE' as const,
        created_at: String(row.created_at || new Date().toISOString()),
        comment_id: row.comment_id ? String(row.comment_id) : undefined,
        product_id: comment.product_id ? String(comment.product_id) : undefined,
        products: asProducts(comment.products),
        sender: asSender(row.sender),
      } as RawActivity
    }),
    ...(sources.orders || []).map((o) => {
      const row = asRecord(o)
      return {
        ...row,
        id: String(row.id),
        type: 'ORDER' as const,
        user_id: row.user_id ? String(row.user_id) : undefined,
        created_at: String(row.updated_at || row.created_at || new Date().toISOString()),
        sender: asSender(row.sender),
      } as RawActivity
    }),
    ...(sources.coin_transactions || []).map((m) => {
      const row = asRecord(m)
      return {
        ...row,
        id: String(row.id),
        type: 'COIN' as const,
        user_id: userId,
        created_at: String(row.created_at || new Date().toISOString()),
        transaction_type: row.type ? String(row.type) : undefined,
        amount: row.amount != null ? Number(row.amount) : undefined,
        reference: row.reference ? String(row.reference) : undefined,
      } as RawActivity
    }),
    ...(sources.unread_messages || []).map((c) => {
      const row = asRecord(c)
      return {
        ...row,
        id: String(row.id),
        type: 'CHAT' as const,
        created_at: String(row.created_at || new Date().toISOString()),
        chat_id: row.conversation_id ? String(row.conversation_id) : undefined,
        sender: asSender(row.sender),
      } as RawActivity
    }),
    ...cartAddActivities,
    ...wishlistAddActivities,
    ...bookingActivities,
    ...extraActivities,
  ]

  return raw
}

const TYPE_LABELS: Record<Exclude<RawActivity['type'], 'SECTION'>, string> = {
  LIKE: 'Like',
  COMMENT: 'Comment',
  REPLY: 'Reply',
  FOLLOW: 'Follow',
  ORDER: 'Order',
  COIN: 'Coins',
  CHAT: 'Chat',
  COMMENT_LIKE: 'Comment like',
  CART_ADD: 'Cart add',
  WISHLIST_ADD: 'Wishlist save',
  SERVICE_BOOKING: 'Booking',
  SUPPORT: 'Support',
  DISPUTE: 'Dispute',
  VERIFICATION: 'Verification',
  PAYOUT: 'Payout',
  SPOTLIGHT: 'Spotlight',
  SYSTEM: 'System',
}

export function activityTypeLabel(type: RawActivity['type']) {
  if (type === 'SECTION') return 'Section'
  return TYPE_LABELS[type] || type
}

export function activitySummary(item: GroupedActivity, profileUserId: string): string {
  const sender = item.senders[0]
  const actor = sender?.slug ? `@${sender.slug}` : 'StoreLink user'
  const others =
    item.count > 1 && item.senders.length > 1 ? ` +${Math.max(item.count - 1, item.senders.length - 1)} others` : ''

  switch (item.type) {
    case 'LIKE':
      return `${actor}${others} liked an item`
    case 'COMMENT':
      return `${actor} commented: "${item.comment_text || '…'}"`
    case 'REPLY':
      return `${actor} replied to a comment`
    case 'FOLLOW':
      return `${actor}${others} started following`
    case 'ORDER':
      return item.user_id === profileUserId
        ? `Order update · #${item.id.slice(0, 8).toUpperCase()}`
        : `New order received · #${item.id.slice(0, 8).toUpperCase()}`
    case 'SERVICE_BOOKING': {
      const ev = (item.booking_event || '').toLowerCase()
      if (ev === 'requested') return 'New booking request'
      if (ev === 'confirmed') return 'Booking confirmed'
      if (ev === 'paid') return 'Booking paid – in escrow'
      if (ev === 'in_progress') return 'Booking in progress'
      if (ev === 'completed') return 'Booking completed'
      return 'Booking update'
    }
    case 'CHAT':
      return `${actor} sent a new message`
    case 'CART_ADD':
      return `${actor} added an item to cart`
    case 'WISHLIST_ADD':
      return `${actor} saved an item to wishlist`
    case 'COMMENT_LIKE':
      return `${actor} liked a comment`
    case 'COIN':
      return `Store coins · ${item.transaction_type || 'update'}`
    case 'SUPPORT':
      return item.message || 'Support notification'
    case 'DISPUTE':
      return item.message || 'Dispute notification'
    case 'VERIFICATION':
      return item.message || 'Verification update'
    case 'PAYOUT':
      return item.message || 'Payout update'
    case 'SPOTLIGHT':
      return item.message || 'Spotlight tag notification'
    case 'SYSTEM':
      return item.message || 'System notification'
    default:
      return activityTypeLabel(item.type)
  }
}

export function activityTargetUrl(item: GroupedActivity): string | null {
  if (item.type === 'ORDER') return `https://storelink.ng/orders/${item.id}`
  if (item.type === 'SPOTLIGHT' && item.spotlight_post_id) {
    return `https://storelink.ng/sp/${encodeURIComponent(item.spotlight_post_id)}`
  }
  if (item.product_id) {
    const slug = item.products?.slug || item.product_id
    return `https://storelink.ng/p/${encodeURIComponent(slug)}`
  }
  if (item.chat_id) return null
  return null
}

export type ActivityFeedMirrorResult = {
  todayViews: number
  feed: GroupedActivity[]
}

export function mirrorActivityFeed(sources: ActivitySourcesPayload, userId: string): ActivityFeedMirrorResult {
  const raw = buildRawActivityFeed(sources, userId)
  return {
    todayViews: Number(sources.today_views || 0),
    feed: aggregateFeed(raw),
  }
}
