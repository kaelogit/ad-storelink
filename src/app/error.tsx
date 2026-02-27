'use client'

import { useEffect } from 'react'
import { logObservabilityEvent } from '../utils/observability'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Admin runtime error:', error)
    void logObservabilityEvent('admin_runtime_error', {
      message: error.message,
      digest: error.digest ?? null,
      stack: error.stack ?? null,
    })
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Runtime failure</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Something broke in admin.</h1>
        <p className="mt-3 text-sm text-gray-600">
          The error has been logged locally. Retry this view, or reload if it persists.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          Try again
        </button>
      </section>
    </main>
  )
}
