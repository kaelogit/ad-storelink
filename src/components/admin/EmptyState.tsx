import type { LucideIcon } from 'lucide-react'

type EmptyStateProps = {
  icon: LucideIcon
  message: string
}

export function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center text-gray-400">
      <Icon size={36} className="mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
