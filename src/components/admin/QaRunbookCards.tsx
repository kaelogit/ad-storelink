import Link from 'next/link'
import { BookOpen, ExternalLink } from 'lucide-react'
import { QA_RUNBOOKS } from '../../constants/qaRunbooks'
import { Card, CardContent, CardHeader } from '../ui'

export function QaRunbookCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {QA_RUNBOOKS.map((runbook) => (
        <Card key={runbook.id} id={runbook.id}>
          <CardHeader>
            <div className="flex items-start gap-2">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <p className="font-semibold text-[var(--foreground)]">{runbook.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{runbook.description}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm text-gray-700">
              {runbook.highlights.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-gray-400">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-[var(--muted)]">
              Repo doc:{' '}
              <code className="rounded bg-black/5 px-1.5 py-0.5">{runbook.repoPath}</code>
            </p>
            {runbook.adminLinks?.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {runbook.adminLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                  >
                    {link.label}
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
