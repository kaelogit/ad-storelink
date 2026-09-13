export type DisasterRunbook = {
  id: string
  title: string
  severity: 'SEV-1' | 'SEV-2' | 'SEV-3'
  summary: string
  steps: string[]
  primaryHref: string
  primaryLabel: string
  secondaryLinks?: { href: string; label: string }[]
  repoPath: string
}

/** Overview + ops: Paystack / webhook / payout disasters (#106). */
export const DISASTER_RUNBOOKS: DisasterRunbook[] = [
  {
    id: 'paystack-callback',
    title: 'Customer paid, order stuck',
    severity: 'SEV-3',
    summary: 'Paystack charge succeeded but order still AWAITING_PAYMENT.',
    steps: [
      'Open Transaction Ops → search order UUID or Paystack reference',
      'Confirm status is AWAITING_PAYMENT',
      'Mark as paid with the exact Paystack reference',
      'Verify chat notice + PAID status',
    ],
    primaryHref: '/dashboard/orders',
    primaryLabel: 'Transaction Ops',
    secondaryLinks: [
      { href: '/dashboard/payment-incidents', label: 'Payment incidents' },
      { href: '/dashboard/support', label: 'Support' },
    ],
    repoPath: 'store-link-mobile/docs/PAYSTACK_CALLBACK_FAILURE.md',
  },
  {
    id: 'webhook-down',
    title: 'Webhook down / error spike',
    severity: 'SEV-1',
    summary: 'paystack-webhook 5xx or Payment Incidents threshold breached.',
    steps: [
      'Open Payment incidents for volume vs threshold',
      'Observability → filter paystack-webhook errors',
      'Check Edge Function logs + Paystack webhook URL/secret',
      'Reconcile critical stuck orders in Transaction Ops while fixing',
    ],
    primaryHref: '/dashboard/payment-incidents',
    primaryLabel: 'Payment incidents',
    secondaryLinks: [
      { href: '/dashboard/orders', label: 'Transaction Ops' },
      { href: '/dashboard/observability', label: 'Observability' },
    ],
    repoPath: 'docs/DISASTER_RECOVERY_RUNBOOK.md',
  },
  {
    id: 'mass-payout-stuck',
    title: 'Mass payout stuck',
    severity: 'SEV-2',
    summary: 'Seller payouts not leaving pending / retry_queued.',
    steps: [
      'Open Finance → inspect pending / failed / retry queues',
      'Confirm payout-processor cron + service_role JWT (OPS_DEPLOY_AND_CRON)',
      'Check Paystack Transfer balance for insufficient-funds retries',
      'Service money: verify service_order_payouts legs, not only product orders',
    ],
    primaryHref: '/dashboard/finance',
    primaryLabel: 'Finance',
    secondaryLinks: [
      { href: '/dashboard/orders', label: 'Transaction Ops' },
      { href: '/dashboard/bookings', label: 'Bookings' },
      { href: '/dashboard/observability', label: 'Observability' },
    ],
    repoPath: 'docs/DISASTER_RECOVERY_RUNBOOK.md',
  },
]
