import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-600">Access denied</p>
        <h1 className="text-2xl font-bold text-gray-900">You are not authorized to use admin tools.</h1>
        <p className="mt-3 text-sm text-gray-600">
          Your account is signed in but does not have an active admin role.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Back to login
          </Link>
        </div>
      </section>
    </main>
  )
}
