export type ServiceDisputeReasonCode =
  | 'no_show_buyer'
  | 'no_show_seller'
  | 'quality_issue'
  | 'different_from_advertised'
  | 'other'

const LABELS: Record<ServiceDisputeReasonCode, string> = {
  no_show_buyer: 'Buyer no-show',
  no_show_seller: 'Provider no-show',
  quality_issue: 'Quality problem',
  different_from_advertised: 'Work not as described',
  other: 'Other',
}

export function formatServiceDisputeReason(code: string | null | undefined): string {
  if (!code) return ''
  const trimmed = code.trim()
  if (trimmed in LABELS) return LABELS[trimmed as ServiceDisputeReasonCode]
  return trimmed.replace(/_/g, ' ')
}
