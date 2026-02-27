'use client'

import { type SelectHTMLAttributes, forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={twMerge(
          'w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-50',
          className
        )}
        {...props}
      />
    )
  }
)
