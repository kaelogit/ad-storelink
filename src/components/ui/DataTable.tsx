'use client'

import { type HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

export function DataTable({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
      <table className={twMerge('w-full text-sm', className)} {...rest} />
    </div>
  )
}

export function DataTableHeader({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={twMerge('border-b border-[var(--border)] bg-[var(--background)]', className)} {...rest} />
}

export function DataTableBody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={twMerge('divide-y divide-[var(--border)]', className)} {...rest} />
}

export function DataTableRow({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={twMerge('transition-colors hover:bg-[var(--background)]/50', className)}
      {...rest}
    />
  )
}

export function DataTableHead({ className, ...rest }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={twMerge('px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]', className)}
      {...rest}
    />
  )
}

export function DataTableCell({ className, ...rest }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={twMerge('px-6 py-4 text-[var(--foreground)]', className)} {...rest} />
}
