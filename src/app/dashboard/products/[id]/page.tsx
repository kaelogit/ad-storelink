'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/client'
import { PageHeader } from '../../../../components/admin/PageHeader'
import { Button } from '../../../../components/ui'
import { ArrowLeft, ExternalLink, Loader2, MapPin, User } from 'lucide-react'

const STORE_APP_BASE = process.env.NEXT_PUBLIC_STORELINK_APP_URL || 'https://storelink.ng'

type AdminProductPayload = {
  product: Record<string, unknown>
  seller: {
    id: string
    display_name: string | null
    email: string | null
    slug: string | null
    location_country_code: string | null
  }
}

export default function AdminProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params?.id === 'string' ? params.id : ''
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<AdminProductPayload | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      const { data, error: rpcError } = await supabase.rpc('get_admin_product_detail', {
        p_id: id,
      })
      if (cancelled) return
      if (rpcError) {
        setError(rpcError.message)
        setPayload(null)
      } else if (data && typeof data === 'object' && data !== null && 'product' in data) {
        setPayload(data as AdminProductPayload)
      } else {
        setError('Product not found.')
        setPayload(null)
      }
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [id])

  const product = payload?.product
  const seller = payload?.seller
  const slug = typeof product?.slug === 'string' ? product.slug : ''
  const publicUrl = slug ? `${STORE_APP_BASE.replace(/\/$/, '')}/product/${slug}` : id ? `${STORE_APP_BASE.replace(/\/$/, '')}/product/${id}` : ''

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/products')} className="gap-2">
          <ArrowLeft size={18} />
          Back to products
        </Button>
        {publicUrl ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"
          >
            <ExternalLink size={16} />
            Open in StoreLink app (live)
          </a>
        ) : null}
      </div>

      <PageHeader
        title={typeof product?.name === 'string' ? product.name : 'Product'}
        subtitle="Full record as stored in the database (admin view)."
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 text-sm font-medium">{error}</div>
      ) : product && seller ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">Product</h3>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <Detail label="ID" value={String(product.id ?? '')} mono />
                <Detail label="Slug" value={String(product.slug ?? '—')} mono />
                <Detail label="Active" value={product.is_active ? 'Yes' : 'No'} />
                <Detail label="Price" value={String(product.price ?? '—')} />
                <Detail label="Currency" value={String(product.currency_code ?? '—')} />
                <Detail label="Stock" value={String(product.stock_quantity ?? '—')} />
                <Detail label="Location country" value={String(product.location_country ?? '—')} />
                <Detail label="Created" value={formatDate(product.created_at)} />
              </dl>
              {typeof product.description === 'string' && product.description.trim() ? (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <p className="text-xs font-bold uppercase text-gray-500 mb-2">Description</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{product.description}</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Images</h3>
              {Array.isArray(product.image_urls) && product.image_urls.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {(product.image_urls as string[]).slice(0, 8).map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-24 h-24 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 shrink-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No images</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4 flex items-center gap-2">
                <User size={14} /> Seller
              </h3>
              <p className="font-semibold text-gray-900">{seller.display_name ?? '—'}</p>
              <p className="text-sm text-gray-600 mt-1">{seller.email ?? '—'}</p>
              <p className="text-sm text-gray-500 mt-2">@{seller.slug ?? '—'}</p>
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <MapPin size={14} />
                {seller.location_country_code ?? '—'}
              </div>
              <Link href="/dashboard/users" className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline">
                Open Users directory →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase text-gray-400">{label}</dt>
      <dd className={`mt-0.5 text-gray-900 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</dd>
    </div>
  )
}

function formatDate(v: unknown) {
  if (v == null || typeof v !== 'string') return '—'
  try {
    return new Date(v).toLocaleString()
  } catch {
    return String(v)
  }
}
