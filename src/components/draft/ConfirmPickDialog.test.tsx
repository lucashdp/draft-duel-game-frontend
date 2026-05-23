import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmPickDialog } from './ConfirmPickDialog'

const ATH = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'Pedro', shortName: 'Pedro',
  position: 'ATA' as const, jerseyNumber: 9,
  teamId: '00000000-0000-4000-8000-000000000020',
}

describe('ConfirmPickDialog', () => {
  it('renders nothing when athlete is null', () => {
    render(
      <ConfirmPickDialog
        athlete={null} teamName="Flamengo" onConfirm={vi.fn()} onCancel={vi.fn()} isPending={false}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders athlete info when present', () => {
    render(
      <ConfirmPickDialog
        athlete={ATH} teamName="Flamengo" onConfirm={vi.fn()} onCancel={vi.fn()} isPending={false}
      />,
    )
    expect(screen.getByText(/pedro/i)).toBeInTheDocument()
    expect(screen.getByText(/ata/i)).toBeInTheDocument()
    expect(screen.getByText(/flamengo/i)).toBeInTheDocument()
  })

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmPickDialog
        athlete={ATH} teamName="Flamengo" onConfirm={onConfirm} onCancel={onCancel} isPending={false}
      />,
    )
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('shows a spinner and disables buttons when isPending=true', () => {
    render(
      <ConfirmPickDialog
        athlete={ATH} teamName="Flamengo" onConfirm={vi.fn()} onCancel={vi.fn()} isPending={true}
      />,
    )
    const confirmBtn = screen.getByRole('button', { name: /draftando/i })
    expect(confirmBtn).toBeDisabled()
  })
})
