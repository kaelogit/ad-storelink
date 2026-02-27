'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const PAGE_SIZE_DEFAULT = 20

export type TableState = {
  page: number
  q: string
  sort: string
  order: 'asc' | 'desc'
  status: string
}

const defaultState: TableState = {
  page: 1,
  q: '',
  sort: 'created_at',
  order: 'desc',
  status: '',
}

function parseNumber(value: string | null, fallback: number): number {
  if (value == null) return fallback
  const n = parseInt(value, 10)
  return Number.isFinite(n) && n >= 1 ? n : fallback
}

export function useTableStateFromUrl(overrides: Partial<TableState> = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const state = useMemo((): TableState => {
    const page = parseNumber(searchParams.get('page'), overrides.page ?? defaultState.page)
    const q = searchParams.get('q') ?? overrides.q ?? defaultState.q
    const sort = searchParams.get('sort') ?? overrides.sort ?? defaultState.sort
    const rawOrder = searchParams.get('order') ?? overrides.order ?? defaultState.order
    const order = rawOrder === 'asc' ? 'asc' : 'desc'
    const status = searchParams.get('status') ?? overrides.status ?? defaultState.status
    return { page, q, sort, order, status }
  }, [searchParams, overrides.page, overrides.q, overrides.sort, overrides.order, overrides.status])

  const update = useCallback(
    (partial: Partial<TableState>) => {
      const next = { ...state, ...partial }
      if (next.page === 1) delete (next as Record<string, unknown>).page
      const params = new URLSearchParams()
      if (next.page > 1) params.set('page', String(next.page))
      if (next.q) params.set('q', next.q)
      if (next.sort && next.sort !== defaultState.sort) params.set('sort', next.sort)
      if (next.order && next.order !== defaultState.order) params.set('order', next.order)
      if (next.status) params.set('status', next.status)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, state]
  )

  const setPage = useCallback((page: number) => update({ page }), [update])
  const setQ = useCallback((q: string) => update({ q, page: 1 }), [update])
  const setSort = useCallback((sort: string) => update({ sort }), [update])
  const setOrder = useCallback((order: 'asc' | 'desc') => update({ order }), [update])
  const setStatus = useCallback((status: string) => update({ status, page: 1 }), [update])

  return {
    ...state,
    setPage,
    setQ,
    setSort,
    setOrder,
    setStatus,
    update,
    pageSize: PAGE_SIZE_DEFAULT,
  }
}
