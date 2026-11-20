const CURRENCY_LOCALE: Record<string, string> = {
  NGN: 'en-NG',
  GHS: 'en-GH',
  ZAR: 'en-ZA',
  KES: 'en-KE',
  XOF: 'fr-CI',
  EGP: 'en-EG',
  RWF: 'en-RW',
}

function currencySymbol(currency: string) {
  const code = (currency || 'NGN').toUpperCase()
  try {
    const parts = new Intl.NumberFormat(CURRENCY_LOCALE[code] || 'en', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).formatToParts(0)
    return parts.find((p) => p.type === 'currency')?.value ?? code
  } catch {
    return code
  }
}

export function formatMoney(amount: number | null | undefined, currency = 'NGN') {
  const code = (currency || 'NGN').toUpperCase()
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[code] || 'en', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(Number(amount || 0))
  } catch {
    return `${code} ${Math.round(Number(amount || 0)).toLocaleString('en')}`
  }
}

export function formatMoneyCompact(amount: number | null | undefined, currency = 'NGN') {
  const n = Number(amount || 0)
  const code = (currency || 'NGN').toUpperCase()
  const sym = currencySymbol(code)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sym}${(n / 1_000).toFixed(1)}k`
  return `${sym}${Math.round(n)}`
}

/** @deprecated Prefer formatMoney(amount, currency) */
export function formatNaira(amount: number | null | undefined) {
  return formatMoney(amount, 'NGN')
}

/** @deprecated Prefer formatMoneyCompact(amount, currency) */
export function formatNairaCompact(amount: number | null | undefined) {
  return formatMoneyCompact(amount, 'NGN')
}

export function formatCount(n: number | null | undefined) {
  return new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(Number(n || 0))
}

export function formatPct(n: number | null | undefined, digits = 1) {
  if (n == null || Number.isNaN(Number(n))) return '-'
  return `${Number(n).toFixed(digits)}%`
}

export function shortDay(label: string) {
  if (!label) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(label)) {
    const d = new Date(`${label.slice(0, 10)}T12:00:00`)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
    }
  }
  return label
}

export type ChartAccent = 'emerald' | 'slate' | 'amber' | 'sky' | 'rose' | 'orange'

export const ACCENT: Record<
  ChartAccent,
  { stroke: string; fill: string; soft: string; text: string; chip: string }
> = {
  emerald: {
    stroke: '#059669',
    fill: '#10b981',
    soft: '#d1fae5',
    text: 'text-emerald-700',
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-100',
  },
  slate: {
    stroke: '#334155',
    fill: '#64748b',
    soft: '#e2e8f0',
    text: 'text-slate-700',
    chip: 'bg-slate-50 text-slate-700 border-slate-200',
  },
  amber: {
    stroke: '#d97706',
    fill: '#f59e0b',
    soft: '#fef3c7',
    text: 'text-amber-800',
    chip: 'bg-amber-50 text-amber-800 border-amber-100',
  },
  sky: {
    stroke: '#0284c7',
    fill: '#0ea5e9',
    soft: '#e0f2fe',
    text: 'text-sky-800',
    chip: 'bg-sky-50 text-sky-800 border-sky-100',
  },
  rose: {
    stroke: '#e11d48',
    fill: '#f43f5e',
    soft: '#ffe4e6',
    text: 'text-rose-700',
    chip: 'bg-rose-50 text-rose-800 border-rose-100',
  },
  orange: {
    stroke: '#ea580c',
    fill: '#f97316',
    soft: '#ffedd5',
    text: 'text-orange-800',
    chip: 'bg-orange-50 text-orange-800 border-orange-100',
  },
}
