import { test, expect } from '@playwright/test'

test('home page loads with championship heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /campeonato/i })).toBeVisible()
})

test('login page renders', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /entrar/i })).toBeVisible()
})
