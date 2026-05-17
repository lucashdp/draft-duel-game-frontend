import { expect, test } from '@playwright/test'

const CHAMPIONSHIP = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'brasileirao',
  name: 'Brasileirão',
  kind: 'league',
}
const TEAM_A = {
  id: '00000000-0000-4000-8000-000000000020',
  name: 'Time A', shortName: 'Time A', abbreviation: 'AAA',
  crestUrl: null, primaryColor: '#FF0000', secondaryColor: '#FFFFFF',
}
const TEAM_B = {
  id: '00000000-0000-4000-8000-000000000021',
  name: 'Time B', shortName: 'Time B', abbreviation: 'BBB',
  crestUrl: null, primaryColor: '#0000FF', secondaryColor: '#FFFFFF',
}
const MATCH_ID = '00000000-0000-4000-8000-000000000010'

test('catalog browse: home → round → match', async ({ page }) => {
  await page.route('**/championships', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([CHAMPIONSHIP]),
    })
  })

  await page.route('**/championships/brasileirao/current-round', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        championship: CHAMPIONSHIP,
        round: {
          id: '00000000-0000-4000-8000-000000000002',
          number: 1, name: 'Rodada 1', startsAt: null, endsAt: null,
        },
        matches: [
          {
            id: MATCH_ID,
            championshipId: CHAMPIONSHIP.id,
            kickoffAt: '2026-05-20T18:00:00.000Z',
            status: 'scheduled',
            homeScore: null, awayScore: null, currentMinute: null, lineupsConfirmedAt: null,
            homeTeam: TEAM_A,
            awayTeam: TEAM_B,
          },
        ],
      }),
    })
  })

  await page.route(`**/matches/${MATCH_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: MATCH_ID,
        championshipId: CHAMPIONSHIP.id,
        kickoffAt: '2026-05-20T18:00:00.000Z',
        status: 'scheduled',
        homeScore: null, awayScore: null, currentMinute: null, lineupsConfirmedAt: null,
        homeTeam: TEAM_A,
        awayTeam: TEAM_B,
      }),
    })
  })

  await page.route(`**/matches/${MATCH_ID}/lineups`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        matchId: MATCH_ID,
        confirmedAt: null,
        home: [],
        away: [],
      }),
    })
  })

  // /me is queried by Providers in some routes — return 401 (logged-out) consistently
  await page.route('**/me', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  })

  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: /draft duel/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /brasileirão/i })).toBeVisible()

  await page.getByRole('link', { name: /brasileirão/i }).click()

  await expect(page).toHaveURL(/\/championships\/brasileirao$/)
  await expect(page.getByRole('heading', { name: 'Brasileirão' })).toBeVisible()
  await expect(page.getByText('Rodada 1')).toBeVisible()
  await expect(page.getByText('AAA')).toBeVisible()
  await expect(page.getByText('BBB')).toBeVisible()

  await page.getByRole('link').filter({ hasText: 'AAA' }).first().click()

  await expect(page).toHaveURL(new RegExp(`/matches/${MATCH_ID}$`))
  await expect(page.getByText(/escalações/i)).toBeVisible()
  await expect(page.getByText(/ainda não confirmadas/i)).toBeVisible()
})
