import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoomActions } from './RoomActions'

const mutate = vi.fn()
const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/hooks/useAbandonRoom', () => ({
  useAbandonRoom: () => ({ mutate, isPending: false }),
}))

const ROOM_ID = '00000000-0000-4000-8000-000000000001'

describe('RoomActions', () => {
  beforeEach(() => {
    mutate.mockReset()
    push.mockReset()
  })

  it('renders nothing when showAbandon is false', () => {
    render(<RoomActions roomId={ROOM_ID} showAbandon={false} />)
    expect(
      screen.queryByRole('button', { name: /abandonar sala/i }),
    ).not.toBeInTheDocument()
  })

  it('opens the Dialog and triggers abandon.mutate when confirmed', async () => {
    const user = userEvent.setup()
    render(<RoomActions roomId={ROOM_ID} showAbandon />)

    // Trigger button is rendered; Dialog confirm button is not yet visible.
    expect(screen.queryByRole('heading', { name: /abandonar essa sala/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /abandonar sala/i }))

    // Dialog is now open — confirmation copy + both buttons are reachable.
    expect(screen.getByRole('heading', { name: /abandonar essa sala/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()

    // Click the destructive "Abandonar sala" inside the Dialog footer (there are now
    // two buttons with that label — trigger + confirm — so pick the last one).
    const confirmButtons = screen.getAllByRole('button', { name: /abandonar sala/i })
    await user.click(confirmButtons[confirmButtons.length - 1])

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0][0]).toEqual({ roomId: ROOM_ID })
  })
})
