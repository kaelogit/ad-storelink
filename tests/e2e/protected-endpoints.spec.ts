import { expect, test } from '@playwright/test'

const endpoints: Array<{ method: 'post' | 'delete'; path: string; body: Record<string, unknown> }> = [
  {
    method: 'post',
    path: '/api/admin/orders/force-status',
    body: { orderId: 'test', newStatus: 'CANCELLED', reasonCategory: 'other', reason: 'test reason 1234' },
  },
  {
    method: 'post',
    path: '/api/admin/disputes/verdict',
    body: {
      disputeId: 'test',
      orderId: 'test',
      verdict: 'refunded_buyer',
      reasonCategory: 'other',
      reason: 'test reason 1234',
    },
  },
  {
    method: 'post',
    path: '/api/admin/payouts/decision',
    body: { payoutId: 'test', action: 'reject', reasonCategory: 'other', reason: 'test reason 1234' },
  },
  {
    method: 'post',
    path: '/api/admin/support/reply',
    body: { ticketId: 'test', message: 'hello' },
  },
  {
    method: 'post',
    path: '/api/admin/support/resolve',
    body: { ticketId: 'test' },
  },
  {
    method: 'post',
    path: '/api/admin/users/account-status',
    body: { userId: 'test', accountStatus: 'suspended', reason: 'test reason 1234' },
  },
  {
    method: 'post',
    path: '/api/admin/staff/invite',
    body: { email: 'user@example.com', fullName: 'User Example', role: 'support' },
  },
  {
    method: 'post',
    path: '/api/admin/staff/status',
    body: { staffId: 'test', isActive: false },
  },
  {
    method: 'post',
    path: '/api/admin/staff/sessions',
    body: { sessionId: 'test' },
  },
  {
    method: 'post',
    path: '/api/admin/moderation/verification',
    body: { requestId: 'test', profileId: 'test', decision: 'verified' },
  },
  {
    method: 'post',
    path: '/api/admin/settings',
    body: {
      maintenance_mode: false,
      min_version_ios: '1.0.0',
      min_version_android: '1.0.0',
      support_phone: '',
    },
  },
  {
    method: 'post',
    path: '/api/admin/content/banners',
    body: { imageUrl: 'https://example.com/img.png', title: 'test banner' },
  },
  {
    method: 'post',
    path: '/api/admin/content/broadcast',
    body: { title: 'test', message: 'test message', segment: 'ALL' },
  },
  {
    method: 'delete',
    path: '/api/admin/content/banners',
    body: { bannerId: 'test' },
  },
]

for (const endpoint of endpoints) {
  test(`unauthenticated access is blocked: ${endpoint.method.toUpperCase()} ${endpoint.path}`, async ({
    request,
  }) => {
    const response =
      endpoint.method === 'post'
        ? await request.post(endpoint.path, { data: endpoint.body })
        : await request.delete(endpoint.path, { data: endpoint.body })
    expect([401, 403]).toContain(response.status())
  })
}
