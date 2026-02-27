import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

const adminEmail = process.env.ADMIN_TEST_EMAIL
const adminPassword = process.env.ADMIN_TEST_PASSWORD

test.describe('finance/support/moderation smoke flows', () => {
  test.beforeEach(async ({ context, page }) => {
    test.skip(!adminEmail || !adminPassword, 'ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD must be set')
    await loginAsAdmin(page, context, { email: adminEmail, password: adminPassword })
  })

  test('finance page loads and shows watchtower tab', async ({ page }) => {
    await page.goto('/dashboard/finance')
    await expect(page.getByText('Finance Center')).toBeVisible()
    await expect(page.getByText('Withdrawal Watchtower')).toBeVisible()
  })

  test('support page loads ticket workspace', async ({ page }) => {
    await page.goto('/dashboard/support')
    await expect(page.getByText('Support Desk')).toBeVisible()
    await expect(page.getByText('Order Diagnostics')).toBeVisible()
  })

  test('moderation page loads pending requests table', async ({ page }) => {
    await page.goto('/dashboard/moderator')
    await expect(page.getByText('Moderation Hub')).toBeVisible()
    await expect(page.getByText('Pending Requests')).toBeVisible()
  })

  test('audit page loads and shows filters + export', async ({ page }) => {
    await page.goto('/dashboard/audit')
    await expect(page.getByText('Audit Log')).toBeVisible()
    await expect(page.getByText('Export CSV')).toBeVisible()
  })

  test('observability page loads and shows level filter', async ({ page }) => {
    await page.goto('/dashboard/observability')
    await expect(page.getByText('Observability')).toBeVisible()
    await expect(page.getByText('Filter by level')).toBeVisible()
  })

  test('content page loads with broadcasts and banners', async ({ page }) => {
    await page.goto('/dashboard/content')
    await expect(page.getByText('Content Studio')).toBeVisible()
    await expect(page.getByText('Broadcasts')).toBeVisible()
    await expect(page.getByText('Banners')).toBeVisible()
  })

  test('settings page loads and shows system configuration', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await expect(page.getByText('System Configuration')).toBeVisible()
    await expect(page.getByText('Maintenance mode')).toBeVisible()
  })
})
