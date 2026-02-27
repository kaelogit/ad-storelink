'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type NavItem = { name: string; href: string }

export function CommandPalette({ items }: { items: NavItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(q.toLowerCase())
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        setQ('')
      }
      if (e.key === 'Escape') setOpen(false)
    },
    []
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--border)] px-4 py-2">
          <input
            type="text"
            placeholder="Go to..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full bg-transparent text-[var(--foreground)] placeholder-[var(--muted)] outline-none"
            autoFocus
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--muted)]">No matches</p>
          ) : (
            filtered.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-4 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--background)]"
                onClick={() => setOpen(false)}
              >
                {item.name}
              </Link>
            ))
          )}
        </div>
        <p className="border-t border-[var(--border)] px-4 py-1.5 text-[10px] text-[var(--muted)]">
          Ctrl+K or Cmd+K to toggle · Esc to close
        </p>
      </div>
    </div>
  )
}
