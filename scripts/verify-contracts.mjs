import { readFile } from 'node:fs/promises'
import path from 'node:path'

const checks = []

async function mustContain(filePath, content) {
  const source = await readFile(filePath, 'utf8')
  if (!source.includes(content)) {
    throw new Error(`Missing "${content}" in ${filePath}`)
  }
  checks.push(`ok: ${path.basename(filePath)} contains ${content}`)
}

async function run() {
  const repoRoot = path.resolve(process.cwd(), '..')
  const adminRoot = process.cwd()

  await mustContain(
    path.join(adminRoot, 'src', 'app', 'dashboard', 'layout.tsx'),
    "allowedRoles: ['super_admin', 'moderator', 'finance', 'support', 'content']"
  )

  await mustContain(
    path.join(adminRoot, 'middleware.ts'),
    ".select('role, is_active')"
  )

  await mustContain(
    path.join(repoRoot, 'storelink-web', 'src', 'app', 'sitemap.ts'),
    ".select('slug, updated_at')"
  )

  await mustContain(
    path.join(adminRoot, 'docs', 'CONTRACT_MATRIX.md'),
    'Controlled-Breaking-Change Rule'
  )

  console.log(checks.join('\n'))
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
