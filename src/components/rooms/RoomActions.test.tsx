import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoomActions } from './RoomActions'
import { useAbandonRoom } from '@/hooks/useAbandonRoom'
import { useRouter } from 'next/navigation'

vi.mock('@/hooks/useAbandonRoom', () => ({ useAbandonRoom: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }))

const ROOM_ID = '00000000-0000-4000-8000-000000000001'

type AbandonReturn = ReturnType<typeof useAbandonRoom>

function setHook(overrides: { mutate: unknown; isPending?: boolean }) {
  vi.mocked(useAbandonRoom).mockReturnValue({
    mutate: overrides.mutate,
    isPending: overrides.isPending ?? false,
  } as unknown as AbandonReturn)
}

describe('RoomActions', () => {
  const mutate = vi.fn()
  const push = vi.fn()

  beforeEach(() => {
    mutate.mockReset()
    push.mockReset()
    setHook({ mutate, isPending: false })
    vi.mocked(useRouter).mockReturnValue({
      push,
    } as unknown as ReturnType<typeof useRouter>)
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

    expect(
      screen.queryByRole('heading', { name: /abandonar essa sala/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /abandonar sala/i }))

    expect(
      screen.getByRole('heading', { name: /abandonar essa sala/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()

    // Two buttons share the "Abandonar sala" label now (trigger + Dialog footer);
    // the destructive confirm is the last one.
    const confirmButtons = screen.getAllByRole('button', { name: /abandonar sala/i })
    await user.click(confirmButtons[confirmButtons.length - 1])

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0][0]).toEqual({ roomId: ROOM_ID })
  })

  it('closes the Dialog without calling mutate when Cancelar is clicked', async () => {
    const user = userEvent.setup()
    render(<RoomActions roomId={ROOM_ID} showAbandon />)

    await user.click(screen.getByRole('button', { name: /abandonar sala/i }))
    expect(
      screen.getByRole('heading', { name: /abandonar essa sala/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(
      screen.queryByRole('heading', { name: /abandonar essa sala/i }),
    ).not.toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('navigates to /me and closes the Dialog on successful abandon', async () => {
    mutate.mockImplementation((_input, opts?: { onSuccess?: () => void }) => {
      opts?.onSuccess?.()
    })
    const user = userEvent.setup()
    render(<RoomActions roomId={ROOM_ID} showAbandon />)

    await user.click(screen.getByRole('button', { name: /abandonar sala/i }))
    const confirmButtons = screen.getAllByRole('button', { name: /abandonar sala/i })
    await user.click(confirmButtons[confirmButtons.length - 1])

    expect(push).toHaveBeenCalledWith('/me')
    expect(
      screen.queryByRole('heading', { name: /abandonar essa sala/i }),
    ).not.toBeInTheDocument()
  })

  it('disables both buttons and shows "Abandonando…" while the mutation is pending', async () => {
    setHook({ mutate, isPending: true })
    const user = userEvent.setup()
    render(<RoomActions roomId={ROOM_ID} showAbandon />)

    await user.click(screen.getByRole('button', { name: /abandonar sala/i }))

    expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled()
    const pending = screen.getByRole('button', { name: /abandonando…/i })
    expect(pending).toBeDisabled()
  })
})
