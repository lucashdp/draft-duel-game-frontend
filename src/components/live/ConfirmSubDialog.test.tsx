import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmSubDialog } from './ConfirmSubDialog'

const removed = { id: 'r', shortName: 'Pedro', position: 'ATA' }
const added = { id: 'a', shortName: 'Vini', position: 'ATA' }

describe('ConfirmSubDialog', () => {
  it('shows both athletes in confirmation text', () => {
    render(
      <ConfirmSubDialog
        open
        removedAthlete={removed}
        addedAthlete={added}
        onConfirm={() => {}}
        onCancel={() => {}}
        loading={false}
      />,
    )
    expect(screen.getByText(/Pedro/)).toBeInTheDocument()
    expect(screen.getByText(/Vini/)).toBeInTheDocument()
  })

  it('confirm button calls onConfirm', () => {
    const fn = vi.fn()
    render(
      <ConfirmSubDialog
        open
        removedAthlete={removed}
        addedAthlete={added}
        onConfirm={fn}
        onCancel={() => {}}
        loading={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(fn).toHaveBeenCalled()
  })

  it('disabled while loading', () => {
    render(
      <ConfirmSubDialog
        open
        removedAthlete={removed}
        addedAthlete={added}
        onConfirm={() => {}}
        onCancel={() => {}}
        loading={true}
      />,
    )
    expect(screen.getByRole('button', { name: /confirmando/i })).toBeDisabled()
  })
})
