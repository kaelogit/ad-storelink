'use client'

import { createContext, useContext, useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ALL_COUNTRIES_CODE, DEFAULT_COUNTRY_CODE, SUPPORTED_COUNTRIES } from '../constants/SupportedCountries'

const COUNTRY_PARAM = 'country'

/** True when viewing all countries - financial metrics (GMV, revenue) must be hidden to avoid mixed-currency trap */
export function isGlobalView(countryCode: string): boolean {
  return countryCode === ALL_COUNTRIES_CODE
}

type CountryFilterContextValue = {
  countryCode: string
  setCountryCode: (code: string) => void
  rpcCountryCode: string | null
  isGlobalView: boolean
}

const CountryFilterContext = createContext<CountryFilterContextValue | null>(null)

export function CountryFilterProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const countryCode = useMemo(() => {
    const param = searchParams.get(COUNTRY_PARAM)
    return param && SUPPORTED_COUNTRIES.some((c) => c.code === param)
      ? param
      : DEFAULT_COUNTRY_CODE
  }, [searchParams])

  /** Pass to RPCs: null when "All Countries" (avoids mixed-currency sums), else the code */
  const rpcCountryCode = countryCode === ALL_COUNTRIES_CODE ? null : countryCode

  const setCountryCode = useCallback(
    (code: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (code === DEFAULT_COUNTRY_CODE) {
        params.delete(COUNTRY_PARAM)
      } else {
        params.set(COUNTRY_PARAM, code)
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const value = useMemo(
    () => ({ countryCode, setCountryCode, rpcCountryCode, isGlobalView: countryCode === ALL_COUNTRIES_CODE }),
    [countryCode, setCountryCode, rpcCountryCode]
  )

  return (
    <CountryFilterContext.Provider value={value}>
      {children}
    </CountryFilterContext.Provider>
  )
}

export function useCountryFilter() {
  const ctx = useContext(CountryFilterContext)
  if (!ctx) {
    throw new Error('useCountryFilter must be used within CountryFilterProvider')
  }
  return ctx
}

export function useCountryFilterOptional() {
  return useContext(CountryFilterContext)
}
