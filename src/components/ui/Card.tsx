'use client'

import { type HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]',
        className
      )}
      {...rest}
    />
  )
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge('border-b border-[var(--border)] px-6 py-4', className)} {...rest} />
}

export function CardContent({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge('p-6', className)} {...rest} />
}
