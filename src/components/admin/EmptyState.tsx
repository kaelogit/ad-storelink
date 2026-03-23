import type { LucideIcon } from 'lucide-react'
import { Search } from 'lucide-react'

type EmptyStateProps = {
  icon?: LucideIcon
  title?: string
  message: string
}

export function EmptyState({ icon: Icon = Search, title, message }: EmptyStateProps) {
  return (
    <div
      className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--background)',
        color: 'var(--muted)',
      }}
    >
      <Icon size={36} className="mb-3 opacity-40" />
      {title ? (
        <p
          className="mb-1 text-sm font-semibold"
          style={{ color: 'var(--foreground)' }}
        >
          {title}
        </p>
      ) : null}
      <p className="text-sm">{message}</p>
    </div>
  )
}
