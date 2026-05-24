import { test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { loginAs } from './helpers/login'

async function newLoggedContext(
  browser: Browser,
  email: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await loginAs(page, email)
  return { context, page }
}

test.describe('Live match — host and guest watch a live match and substitute', () => {
  test('flows from DRAFTING → LIVE → events → sub → cancellation → FINISHED', async () => {
    // Requires API debug endpoints to drive the stub simulator (accelerate
    // ticks, force events, trigger cancellations, fast-forward to finish).
    // Plan §14 calls these out as a prerequisite. Until they ship, the
    // happy-path frontend behavior is covered by:
    //   - src/app/(app)/rooms/[id]/live-match-view.test.tsx (dispatcher + props)
    //   - src/hooks/useLiveSocket.test.tsx (WS → cache patches)
    //   - src/components/live/*.test.tsx (per-component coverage)
    test.skip(
      true,
      'Requires API simulator debug endpoints; covered by unit + integration tests',
    )

    test.slow() // 60s+
    const host = await newLoggedContext(browser, `pw-live-host-${Date.now()}@test.dev`)
    const guest = await newLoggedContext(browser, `pw-live-guest-${Date.now()}@test.dev`)

    // 1. Host creates a room from a live-eligible match (simulator-backed),
    //    guest joins via invite code.
    // 2. Both drafts 10 picks → dispatcher transitions to LiveMatchView.
    // 3. Simulator-trigger forces a goal event → both pages see the event
    //    appear in MatchTimeline within 3s.
    // 4. Host clicks "Substituir" → selects a slot → picks a substitute from
    //    the filtered pool → confirms in ConfirmSubDialog.
    // 5. Both pages see the lineup update within 2s.
    // 6. Simulator-trigger cancels the earlier event → both pages see the
    //    timeline entry flagged "ANULADO".
    // 7. Simulator-trigger fast-forwards to finished → FinishedBanner
    //    appears within 2s; host sees "Você venceu!" or "Empate" depending
    //    on the simulator-driven score.

    await host.context.close()
    await guest.context.close()
  })

  test('lineup:confirmed broadcasts to a DRAFTING room', () => {
    // Requires the API LineupSyncWorker to be triggerable for an unconfirmed
    // match. Frontend behavior (DraftView reacts to lineup:confirmed) is
    // covered by useDraftSocket.test.tsx.
    test.skip(true, 'Requires API lineup sync trigger; covered by unit tests')
  })

  test('draw winner renders Empate banner', () => {
    // Requires simulator to drive a tied final score. FinishedBanner
    // handles `winner='draw'` — covered by FinishedBanner.test.tsx.
    test.skip(true, 'Requires API simulator with tied-score fixture; covered by unit tests')
  })

  test('abandoned winner renders Sala abandonada banner', () => {
    // Requires simulator to drive postponed/canceled match status.
    // FinishedBanner handles `winner='abandoned'` — covered by FinishedBanner.test.tsx.
    test.skip(true, 'Requires API simulator with postponed fixture; covered by unit tests')
  })
})
