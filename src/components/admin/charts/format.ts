export function formatNaira(amount: number | null | undefined) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))
}

export function formatNairaCompact(amount: number | null | undefined) {
  const n = Number(amount || 0)
  if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `₦${(n / 1_000).toFixed(1)}k`
  return `₦${Math.round(n)}`
}

export function formatCount(n: number | null | undefined) {
  return new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(Number(n || 0))
}

export function formatPct(n: number | null | undefined, digits = 1) {
  if (n == null || Number.isNaN(Number(n))) return '—'
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
