import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

const adminEmail = process.env.ADMIN_TEST_EMAIL
const adminPassword = process.env.ADMIN_TEST_PASSWORD

test.describe('admin new flows smoke', () => {
  test.beforeEach(async ({ context, page }) => {
    test.skip(!adminEmail || !adminPassword, 'ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD must be set')
    await loginAsAdmin(page, context, { email: adminEmail, password: adminPassword })
  })

  test('sessions tab loads and can open revoke dialog', async ({ page }) => {
    await page.goto('/dashboard/super-admin')
    await page.getByRole('button', { name: /sessions/i }).click()
    await expect(page.getByText('Live view of active admin sessions')).toBeVisible()
    // If there is at least one session row, open the revoke modal.
    const revokeButton = page.getByRole('button', { name: /revoke/i }).first()
    if (await revokeButton.isVisible().catch(() => false)) {
      await revokeButton.click()
      await expect(page.getByText(/Revoke session\?/i)).toBeVisible()
      await page.getByRole('button', { name: /cancel/i }).click()
    }
  })

  test('content page renders broadcast and banners sections', async ({ page }) => {
    await page.goto('/dashboard/content')
    await expect(page.getByText('Content Studio')).toBeVisible()
    await expect(page.getByText('New campaign')).toBeVisible()
    await page.getByRole('button', { name: /Banners/i }).click()
    await expect(page.getByText(/Add billboard/i)).toBeVisible()
  })

  test('settings page renders maintenance and force update cards', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await expect(page.getByText('System Configuration')).toBeVisible()
    await expect(page.getByText(/Maintenance mode/i)).toBeVisible()
    await expect(page.getByText(/Force update/i)).toBeVisible()
  })

  test('audit page loads and CSV export button is visible', async ({ page }) => {
    await page.goto('/dashboard/audit')
    await expect(page.getByText(/Audit Log/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible()
  })

  test('observability page loads', async ({ page }) => {
    await page.goto('/dashboard/observability')
    await expect(page.getByText(/Observability/i)).toBeVisible()
  })

  test('appeals section renders on moderation page', async ({ page }) => {
    await page.goto('/dashboard/moderator')
    await expect(page.getByText('Moderation Hub')).toBeVisible()
    await expect(page.getByText(/Suspension Appeals/i)).toBeVisible()
  })
})

