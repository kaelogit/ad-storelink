'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]',
  secondary: 'bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]',
  danger: 'bg-[var(--danger)] text-white',
  ghost: 'bg-transparent text-[var(--muted)] hover:bg-[var(--surface)]',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Btn(
  { className, variant = 'primary', size = 'md', loading, disabled, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={twMerge(
        'inline-flex items-center justify-center gap-2 font-semibold rounded-[var(--radius)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {loading ? 'Processing...' : children}
    </button>
  )
})
