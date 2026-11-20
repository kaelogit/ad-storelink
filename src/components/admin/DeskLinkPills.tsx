'use client'

import Link from 'next/link'
import { useAdminRole } from '../../hooks/useAdminRole'
import { roleCanOpenPath } from '../../constants/adminNavigation'

type DeskLink = {
  href: string
  label: string
}

/** Cross-desk shortcuts; links the current role cannot open (per nav RBAC) are hidden. */
export function DeskLinkPills({ links }: { links: DeskLink[] }) {
  const { role } = useAdminRole()
  const visible = links.filter((link) => roleCanOpenPath(role, link.href))
  if (!visible.length) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition"
        >
          {link.label}
        </Link>
      ))}
    </div>
  )
}
