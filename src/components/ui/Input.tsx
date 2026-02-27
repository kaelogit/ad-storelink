'use client'

import { type InputHTMLAttributes, forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={twMerge(
          'w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)] placeholder-[var(--muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-50',
          className
        )}
        {...props}
      />
    )
  }
)
