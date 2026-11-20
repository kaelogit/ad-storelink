'use client'

import Link from 'next/link'
import { BookOpen, ExternalLink } from 'lucide-react'
import { QA_RUNBOOKS } from '../../constants/qaRunbooks'
import { roleCanOpenPath } from '../../constants/adminNavigation'
import { useAdminRole } from '../../hooks/useAdminRole'

export function QaRunbookCards() {
  const { role } = useAdminRole()
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {QA_RUNBOOKS.map((runbook) => {
        const links = (runbook.adminLinks ?? []).filter((link) => roleCanOpenPath(role, link.href))
        return (
          <div
            key={runbook.id}
            id={runbook.id}
            className="rounded-xl border border-zinc-200 bg-white p-4"
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-md border border-zinc-200 bg-zinc-50 p-1.5">
                <BookOpen className="h-3.5 w-3.5 text-zinc-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900">{runbook.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{runbook.description}</p>
                <ul className="mt-2 space-y-1">
                  {runbook.highlights.slice(0, 3).map((item) => (
                    <li key={item} className="flex gap-2 text-[11px] text-zinc-600">
                      <span className="text-zinc-300">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 truncate font-mono text-[10px] text-zinc-400">{runbook.repoPath}</p>
                {links.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100"
                      >
                        {link.label}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
