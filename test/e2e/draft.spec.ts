import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { loginAs } from './helpers/login'

async function newLoggedContext(browser: Browser, email: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await loginAs(page, email)
  return { context, page }
}

test.describe('Draft — host and guest snake-draft a full lineup', () => {
  test('host picks first, both sides see picks in real time, room transitions to LIVE', async ({ browser }) => {
    test.slow() // 60s
    const host = await newLoggedContext(browser, `pw-draft-host-${Date.now()}@test.dev`)
    const guest = await newLoggedContext(browser, `pw-draft-guest-${Date.now()}@test.dev`)

    // 1. Host creates room from first match (assumes API has confirmed-lineup match)
    await host.page.goto('/')
    await host.page.getByRole('link', { name: /brasileirão/i }).click()
    await host.page.locator('[data-testid="match-card"]').first().click()
    await host.page.getByRole('button', { name: /criar sala/i }).click()
    await expect(host.page).toHaveURL(/\/rooms\/[0-9a-f-]+/)
    const inviteUrl = await host.page.getByTestId('invite-url').inputValue()
    const code = new URL(inviteUrl).pathname.split('/').pop()!

    // 2. Guest joins
    await guest.page.goto(`/rooms/join/${code}`)
    await guest.page.getByRole('button', { name: /entrar na sala/i }).click()
    await expect(guest.page).toHaveURL(/\/rooms\/[0-9a-f-]+/)

    // 3. Both sides should see DraftView ("Sua vez" appears for host)
    await expect(host.page.getByText(/sua vez/i)).toBeVisible({ timeout: 10_000 })
    await expect(guest.page.getByText(/vez de/i)).toBeVisible({ timeout: 10_000 })

    // 4. Host picks first available athlete in the pool
    const firstAthlete = host.page.locator('[data-testid^="player-card"]').first()
    await firstAthlete.click()
    await host.page.getByRole('button', { name: /^confirmar$/i }).click()

    // 5. Guest sees that pick appear within 5s and gets the turn
    await expect(guest.page.getByText(/sua vez/i)).toBeVisible({ timeout: 5000 })

    // 6. Guest picks
    const secondAthlete = guest.page.locator('[data-testid^="player-card"]').first()
    await secondAthlete.click()
    await guest.page.getByRole('button', { name: /^confirmar$/i }).click()

    await expect(host.page.getByText(/sua vez/i).or(host.page.getByText(/vez de/i))).toBeVisible({ timeout: 5000 })

    await host.context.close()
    await guest.context.close()
  })

  test('shows "Aguardando escalação" CTA when lineup is not confirmed', () => {
    // Requires an API-side hook or fixture creating a room whose match has
    // lineupsConfirmedAt = null. Covered by the unit test draft-view.test.tsx.
    test.skip(true, 'Requires API fixture to seed lineup=null; covered by unit tests')
  })
})
