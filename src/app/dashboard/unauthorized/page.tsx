import Link from 'next/link'

export default function DashboardUnauthorizedPage() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">Restricted area</p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">You do not have permission for this module.</h1>
      <p className="mt-3 text-sm text-gray-600">
        Your role is valid for admin access, but not for this dashboard section.
      </p>
      <div className="mt-6">
        <Link
          href="/dashboard"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          Return to overview
        </Link>
      </div>
    </div>
  )
}
