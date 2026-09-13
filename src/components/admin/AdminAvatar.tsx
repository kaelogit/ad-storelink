'use client'

type AdminAvatarProps = {
  src?: string | null
  name?: string | null
  size?: 'sm' | 'md'
  className?: string
}

export function AdminAvatar({ src, name, size = 'sm', className = '' }: AdminAvatarProps) {
  const dim = size === 'md' ? 'h-10 w-10' : 'h-8 w-8'
  const label = String(name || 'U').trim() || 'U'
  const url =
    String(src || '').trim() ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=e2e8f0&color=1e293b`

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={`${dim} shrink-0 rounded-full object-cover bg-slate-100 ${className}`}
      onError={(e) => {
        const el = e.currentTarget
        el.onerror = null
        el.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=e2e8f0&color=1e293b`
      }}
    />
  )
}
