export type QaRunbook = {
  id: string
  title: string
  description: string
  repoPath: string
  highlights: string[]
  adminLinks?: { href: string; label: string }[]
}

export const QA_RUNBOOKS: QaRunbook[] = [
  {
    id: 'staging',
    title: 'Staging Runtime QA',
    description: 'Pre-release checklist across auth, users, orders, finance, support, and content.',
    repoPath: 'admin-storelink/docs/STAGING_QA_RUNBOOK.md',
    highlights: [
      'Role matrix — no unauthorized module access',
      'Order lookup + force complete/cancel with audit',
      'Dispute verdict + payout approve/reject',
      'Support ticket reply + resolve',
    ],
    adminLinks: [
      { href: '/dashboard/moderator', label: 'Moderation' },
      { href: '/dashboard/finance', label: 'Finance' },
      { href: '/dashboard/orders', label: 'Transaction Ops' },
      { href: '/dashboard/support', label: 'Support' },
    ],
  },
  {
    id: 'volunteer-e2e',
    title: 'Volunteer E2E Plan v2',
    description: '15-tester coordinated mobile, web, and admin scenarios before major launches.',
    repoPath: 'store-link-mobile/docs/VOLUNTEER_E2E_TEST_PLAN_V2.md',
    highlights: [
      'Buyer + seller onboarding from scratch',
      'Cart, chat commerce, disputes, and admin observability',
      'Web buyer + deep links + regression cross-checks',
    ],
    adminLinks: [
      { href: '/dashboard/users', label: 'User dossiers' },
      { href: '/dashboard/bookings', label: 'Bookings' },
      { href: '/dashboard/observability', label: 'Observability' },
      { href: '/dashboard/experiments', label: 'Experiments' },
    ],
  },
  {
    id: 'quality-rollout',
    title: 'Quality & Rollout Gates',
    description: 'Lint, contract tests, admin e2e, and controlled breaking-change rollout order.',
    repoPath: 'admin-storelink/docs/QUALITY_AND_ROLLOUT.md',
    highlights: [
      'npm run lint + test:contracts + test:e2e in admin-storelink',
      'Deploy admin → mobile/web compatibility patch',
      'Monitor observability stream post-deploy',
    ],
    adminLinks: [
      { href: '/dashboard/safety-tests', label: 'CI safety results' },
      { href: '/dashboard/observability', label: 'Observability' },
      { href: '/dashboard/settings', label: 'Settings' },
    ],
  },
  {
    id: 'burnin',
    title: '48h Burn-in Monitoring',
    description: 'Post-release watch window for payment, escrow, and moderation regressions.',
    repoPath: 'admin-storelink/docs/BURNIN_MONITORING_48H.md',
    highlights: [
      'Paystack webhook error rate',
      'Stuck AWAITING_PAYMENT orders',
      'Open disputes and payout queue depth',
    ],
    adminLinks: [
      { href: '/dashboard/payment-incidents', label: 'Payment incidents' },
      { href: '/dashboard/finance', label: 'Finance center' },
      { href: '/dashboard/content-reports', label: 'Report inbox' },
    ],
  },
]

export const STAGING_SMOKE_CHECKLIST = [
  { label: 'Auth login → dashboard → logout', href: '/dashboard' },
  { label: 'User search + dossier suspend/reactivate', href: '/dashboard/users' },
  { label: 'Order lookup + intervention', href: '/dashboard/orders' },
  { label: 'Dispute verdict + payout action', href: '/dashboard/finance' },
  { label: 'Service booking dispute timeline', href: '/dashboard/bookings' },
  { label: 'Support ticket reply + resolve', href: '/dashboard/support' },
  { label: 'Content report triage', href: '/dashboard/content-reports' },
  { label: 'Paystack incident desk', href: '/dashboard/payment-incidents' },
]
