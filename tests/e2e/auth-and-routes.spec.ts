import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies()
  await page.goto('/login')
})

test('login page renders', async ({ page }) => {
  await expect(page.getByText('StoreLink Admin')).toBeVisible()
})

test('dashboard redirects when not authenticated', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})
