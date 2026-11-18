'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../utils/supabase/client'
import { ExternalLink, Loader2, Calendar, Ticket, Users } from 'lucide-react'

type SiblingTicket = {
  id: string
  subject: string | null
  status: string | null
  user_id: string | null
  category: string | null
  created_at?: string | null
}

type BookingSummary = {
  id: string
  status?: string | null
  dispute_reason?: string | null
  dispute_note?: string | null
  dispute_state?: string | null
  amount_minor?: number | null
  currency_code?: string | null
  buyer?: { id?: string; display_name?: string | null; email?: string | null } | null
  seller?: { id?: string; display_name?: string | null; email?: string | null } | null
  listing?: { title?: string | null } | null
  dispute_resolution?: {
    outcome_label?: string | null
    note?: string | null
    resolved_at?: string | null
  } | null
}

function money(minor: number | null | undefined, currency: string | null | undefined) {
  const c = currency || 'NGN'
  return `${c} ${(Number(minor || 0) / 100).toLocaleString()}`
}

export function BookingDisputeCasePanel({
  referenceId,
  activeTicketId,
  onOpenTicket,
}: {
  referenceId: string
  activeTicketId: string
  onOpenTicket: (ticketId: string) => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [siblings, setSiblings] = useState<SiblingTicket[]>([])
  const [booking, setBooking] = useState<BookingSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      const [{ data: ticketRows, error: ticketErr }, { data: bookingData, error: bookingErr }] =
        await Promise.all([
          supabase
            .from('support_tickets')
            .select('id, subject, status, user_id, category, created_at')
            .eq('reference_id', referenceId)
            .ilike('category', 'BOOKING_DISPUTE')
            .order('created_at', { ascending: true }),
          supabase.rpc('get_service_order_details_for_admin', { p_query: referenceId }),
        ])

      if (cancelled) return
      if (ticketErr) setError(ticketErr.message)
      setSiblings((ticketRows as SiblingTicket[]) || [])
      if (!bookingErr && bookingData) setBooking(bookingData as BookingSummary)
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [referenceId, supabase])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50/60 px-3 py-2.5 text-xs text-orange-900">
        <Loader2 size={14} className="animate-spin" /> Loading dispute case…
      </div>
    )
  }

  if (error && siblings.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
        Could not load case: {error}
      </div>
    )
  }

  const buyerId = booking?.buyer?.id
  const sellerId = booking?.seller?.id
  const buyerTicket = siblings.find((t) => t.user_id && buyerId && t.user_id === buyerId) || siblings[0]
  const sellerTicket =
    siblings.find((t) => t.user_id && sellerId && t.user_id === sellerId) ||
    siblings.find((t) => t.id !== buyerTicket?.id)

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-900/70 flex items-center gap-1">
            <Users size={11} /> Booking dispute case
          </p>
          <p className="mt-1 text-sm font-bold text-orange-950">
            {booking?.listing?.title || 'Service booking'}
          </p>
          <p className="text-[11px] text-orange-900/80 font-mono break-all">{referenceId}</p>
        </div>
        <Link
          href={`/dashboard/bookings?q=${encodeURIComponent(referenceId)}`}
          className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-orange-900 hover:bg-orange-50"
        >
          <Calendar size={12} /> Open booking <ExternalLink size={11} />
        </Link>
      </div>

      {booking ? (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg bg-white/80 border border-orange-100 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase text-orange-900/50">Status</p>
            <p className="font-semibold text-orange-950 mt-0.5">{booking.status || '—'}</p>
          </div>
          <div className="rounded-lg bg-white/80 border border-orange-100 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase text-orange-900/50">Amount</p>
            <p className="font-semibold text-orange-950 mt-0.5 font-mono">
              {money(booking.amount_minor, booking.currency_code)}
            </p>
          </div>
          <div className="rounded-lg bg-white/80 border border-orange-100 px-2.5 py-2 col-span-2">
            <p className="text-[10px] font-bold uppercase text-orange-900/50">Parties</p>
            <p className="mt-0.5 text-orange-950">
              Buyer: <span className="font-semibold">{booking.buyer?.display_name || '—'}</span>
              {booking.buyer?.email ? ` · ${booking.buyer.email}` : ''}
            </p>
            <p className="text-orange-950">
              Seller: <span className="font-semibold">{booking.seller?.display_name || '—'}</span>
              {booking.seller?.email ? ` · ${booking.seller.email}` : ''}
            </p>
          </div>
          {booking.dispute_reason || booking.dispute_note ? (
            <div className="rounded-lg bg-white/80 border border-orange-100 px-2.5 py-2 col-span-2">
              <p className="text-[10px] font-bold uppercase text-orange-900/50">Claim</p>
              {booking.dispute_reason ? (
                <p className="mt-0.5 font-semibold text-orange-950">{booking.dispute_reason}</p>
              ) : null}
              {booking.dispute_note ? (
                <p className="mt-1 text-orange-900/90 whitespace-pre-wrap">{booking.dispute_note}</p>
              ) : null}
            </div>
          ) : null}
          {booking.dispute_resolution?.outcome_label ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 col-span-2">
              <p className="text-[10px] font-bold uppercase text-emerald-800/70">Resolution</p>
              <p className="mt-0.5 font-semibold text-emerald-950">
                {booking.dispute_resolution.outcome_label}
              </p>
              {booking.dispute_resolution.note ? (
                <p className="mt-1 text-emerald-900/90 whitespace-pre-wrap">
                  {booking.dispute_resolution.note}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-900/70 flex items-center gap-1">
          <Ticket size={11} /> Linked threads
        </p>
        <div className="flex flex-col gap-1.5">
          {[buyerTicket, sellerTicket]
            .filter(Boolean)
            .filter((t, i, arr) => arr.findIndex((x) => x?.id === t?.id) === i)
            .map((ticket) => {
              if (!ticket) return null
              const isActive = ticket.id === activeTicketId
              const role =
                buyerId && ticket.user_id === buyerId
                  ? 'Buyer'
                  : sellerId && ticket.user_id === sellerId
                    ? 'Seller'
                    : 'Party'
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => {
                    if (!isActive) onOpenTicket(ticket.id)
                  }}
                  className={`w-full text-left rounded-lg border px-2.5 py-2 text-[11px] transition ${
                    isActive
                      ? 'border-orange-400 bg-white ring-1 ring-orange-300'
                      : 'border-orange-100 bg-white/70 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-orange-950">
                      {role} ticket · {ticket.status || 'open'}
                    </span>
                    {isActive ? (
                      <span className="text-[10px] font-bold text-orange-700">Viewing</span>
                    ) : (
                      <span className="text-[10px] font-bold text-blue-600">Switch</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-orange-900/80 truncate">{ticket.subject}</p>
                </button>
              )
            })}
        </div>
      </div>
    </div>
  )
}
