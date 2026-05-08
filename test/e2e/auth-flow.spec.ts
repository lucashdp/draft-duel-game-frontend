import { expect, test } from '@playwright/test'

const TOKEN = 'a'.repeat(43)
const USER = { id: 'u1', email: 'user@example.com', nickname: 'user' }
const API = 'http://localhost:3001'

test('login → verify → me happy path', async ({ page }) => {
  let meCalls = 0
  let magicLinkBody: unknown

  await page.route(`${API}/auth/magic-link`, async (route) => {
    magicLinkBody = JSON.parse(route.request().postData() ?? '{}')
    await route.fulfill({ status: 204, body: '' })
  })

  await page.route(`${API}/auth/verify`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: USER }),
    })
  })

  await page.route(`${API}/me`, async (route) => {
    meCalls++
    if (meCalls === 1) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(USER),
    })
  })

  await page.route(`${API}/auth/refresh`, async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  })

  // Hit a guarded route → guard redirects to /login?from=/me
  await page.goto('/me')
  await expect(page).toHaveURL(/\/login\?from=%2Fme$/)

  // Submit the email
  await page.getByLabel(/email/i).fill('user@example.com')
  await page.getByRole('button', { name: /enviar/i }).click()
  await expect(page.getByText(/confira seu email/i)).toBeVisible()
  expect(magicLinkBody).toEqual({ email: 'user@example.com' })

  // Simulate clicking the email link
  await page.goto(`/verify?token=${TOKEN}`)

  // Verify redirects to /me and the page renders user info
  await expect(page).toHaveURL('/me')
  await expect(page.getByText('user@example.com')).toBeVisible()
})
