import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Pin Turbopack root to this app so middleware/routes resolve consistently in monorepo layouts.
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
