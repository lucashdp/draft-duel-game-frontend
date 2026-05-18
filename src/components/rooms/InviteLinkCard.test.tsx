import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InviteLinkCard } from './InviteLinkCard'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { toast } from 'sonner'

describe('InviteLinkCard', () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  it('renders the invite URL built from the code', () => {
    render(<InviteLinkCard code="K7M2QH" />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toContain('/rooms/join/K7M2QH')
    expect(input.readOnly).toBe(true)
  })

  it('copies to clipboard on click', async () => {
    // userEvent.setup() installs a clipboard stub on navigator; spy after setup
    const user = userEvent.setup()
    const writeSpy = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined)
    render(<InviteLinkCard code="K7M2QH" />)
    await user.click(screen.getByRole('button', { name: /copiar/i }))
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('/rooms/join/K7M2QH'))
    writeSpy.mockRestore()
  })
})
