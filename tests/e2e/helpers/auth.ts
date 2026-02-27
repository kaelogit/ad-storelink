import { expect, type BrowserContext, type Page } from '@playwright/test'

function hasSupabaseAuthCookie(cookies: Awaited<ReturnType<BrowserContext['cookies']>>) {
  return cookies.some((cookie) => cookie.name.includes('sb-') && cookie.name.includes('auth-token'))
}

export async function loginAsAdmin(
  page: Page,
  context: BrowserContext,
  creds: { email?: string; password?: string }
) {
  const { email, password } = creds

  if (!email || !password) {
    throw new Error('Missing ADMIN_TEST_EMAIL or ADMIN_TEST_PASSWORD for authenticated E2E flow.')
  }

  await context.clearCookies()
  await page.goto('/login')
  await page.getByLabel('Email Address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()

  await page.waitForLoadState('networkidle')

  if (page.url().includes('/dashboard')) {
    await expect(page).toHaveURL(/\/dashboard/)
    return
  }

  const cookies = await context.cookies()
  const authCookieFound = hasSupabaseAuthCookie(cookies)
  const visibleAuthError = await page.locator('text=/invalid|error|failed|incorrect|not allowed|unauthorized/i').first().textContent()

  throw new Error(
    [
      'Admin login failed.',
      `URL: ${page.url()}`,
      `Supabase auth cookie present: ${authCookieFound}`,
      `Visible auth error: ${(visibleAuthError ?? 'none').trim()}`,
    ].join(' ')
  )
}
