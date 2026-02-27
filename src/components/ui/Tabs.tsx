'use client'

import { type HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

export function TabsRoot({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge('flex gap-1 border-b border-[var(--border)]', className)} {...props} />
}

export function Tab({
  active,
  className,
  ...props
}: HTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={twMerge(
        'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
        active
          ? 'border-[var(--primary)] text-[var(--primary)]'
          : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]',
        className
      )}
      {...props}
    />
  )
}
