import type { Page } from '@playwright/test'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

/**
 * Performs a real-API magic-link login flow for a Playwright page:
 *  1. POSTs to /auth/magic-link to request the magic link for `email`.
 *  2. Reads the issued token from the API stub endpoint GET /_test/last-token?email=...
 *  3. Navigates to /verify?token=... and waits for the authenticated redirect.
 *
 * Requires the API to be running on `NEXT_PUBLIC_API_URL` (default :3001)
 * with a stub email provider that exposes `/_test/last-token`.
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  // 1. Request the magic link
  await page.request.post(`${API}/auth/magic-link`, {
    data: { email },
    headers: { 'Content-Type': 'application/json' },
  })

  // 2. Retrieve the token from the test stub endpoint
  const tokenRes = await page.request.get(`${API}/_test/last-token`, {
    params: { email },
  })
  const { token } = await tokenRes.json() as { token: string }

  // 3. Navigate to the verify route — the app consumes the token and redirects
  //    to an authenticated page (e.g. /me or the original ?from= destination)
  await page.goto(`/verify?token=${encodeURIComponent(token)}`)

  // Wait until the browser has left /verify, confirming a successful login
  await page.waitForURL((url) => !url.pathname.startsWith('/verify'), { timeout: 10_000 })
}
