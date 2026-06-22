import Link from 'next/link'

type DeskLink = {
  href: string
  label: string
}

export function DeskLinkPills({ links }: { links: DeskLink[] }) {
  if (!links.length) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((link) => (
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
