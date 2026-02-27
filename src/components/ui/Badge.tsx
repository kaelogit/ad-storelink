'use client'

import { type HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

type Tone = 'success' | 'danger' | 'warning' | 'neutral'

const toneClasses: Record<Tone, string> = {
  success: 'bg-[var(--success-bg)] text-[var(--success)] border-emerald-200',
  danger: 'bg-[var(--danger-bg)] text-[var(--danger)] border-red-200',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning)] border-amber-200',
  neutral: 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export function Badge(props: BadgeProps) {
  const { className, tone = 'neutral', ...rest } = props
  return (
    <span
      className={twMerge(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
        toneClasses[tone],
        className
      )}
      {...rest}
    />
  )
}
