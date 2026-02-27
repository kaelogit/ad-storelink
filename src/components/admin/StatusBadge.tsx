type StatusBadgeProps = {
  label: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}

const toneStyles = {
  neutral: 'bg-gray-50 text-gray-700 border-gray-200',
  success: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-orange-50 text-orange-700 border-orange-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
}

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${toneStyles[tone]}`}
    >
      {label}
    </span>
  )
}
