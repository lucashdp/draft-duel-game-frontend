import { test, expect, Browser, BrowserContext, Page } from '@playwright/test'
import { loginAs } from './helpers/login' // adjust path if you lifted differently

async function newLoggedContext(browser: Browser, email: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await loginAs(page, email)
  return { context, page }
}

test.describe('Rooms — host creates, guest joins, host sees update live', () => {
  test('happy path with two contexts', async ({ browser }) => {
    const host = await newLoggedContext(browser, 'pw-host@test.dev')
    const guest = await newLoggedContext(browser, 'pw-guest@test.dev')

    // 1. Host navigates to a scheduled match in the catalog.
    await host.page.goto('/')
    await host.page.getByRole('link', { name: /brasileirão/i }).click()
    // First match link in the round listing.
    await host.page.locator('[data-testid="match-card"]').first().click()

    // 2. Host clicks "Criar sala" and is taken to /rooms/<id>.
    await host.page.getByRole('button', { name: /criar sala/i }).click()
    await expect(host.page).toHaveURL(/\/rooms\/[0-9a-f-]+/)

    // 3. Host sees the invite link with the room code, and the OpponentSlot is waiting.
    const inviteInput = host.page.getByRole('textbox')
    await expect(inviteInput).toHaveValue(/\/rooms\/join\//)
    const inviteUrl = await inviteInput.inputValue()
    const code = inviteUrl.split('/').pop()!
    await expect(host.page.getByText(/aguardando oponente/i)).toBeVisible()

    // 4. Guest opens the same invite URL in a separate context.
    await guest.page.goto(`/rooms/join/${code}`)
    await expect(guest.page.getByRole('button', { name: /entrar na sala/i })).toBeVisible()
    await guest.page.getByRole('button', { name: /entrar na sala/i }).click()
    await expect(guest.page).toHaveURL(/\/rooms\/[0-9a-f-]+/)

    // 5. Host's lobby updates within 5s — the OpponentSlot now shows guest nickname.
    await expect(host.page.getByText(/aguardando oponente/i)).not.toBeVisible({ timeout: 5000 })

    await host.context.close()
    await guest.context.close()
  })

  test('host clicks own invite link → sees IS_HOST message', async ({ browser }) => {
    const host = await newLoggedContext(browser, 'pw-selfjoin@test.dev')
    // create the room
    await host.page.goto('/')
    await host.page.getByRole('link', { name: /brasileirão/i }).click()
    await host.page.locator('[data-testid="match-card"]').first().click()
    await host.page.getByRole('button', { name: /criar sala/i }).click()
    const inviteUrl = await host.page.getByRole('textbox').inputValue()
    const code = inviteUrl.split('/').pop()!

    // open invite in same context
    await host.page.goto(`/rooms/join/${code}`)
    await host.page.getByRole('button', { name: /entrar na sala/i }).click()
    await expect(host.page.getByText(/você é o anfitrião/i)).toBeVisible({ timeout: 5000 })

    await host.context.close()
  })
})
