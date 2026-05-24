import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FinishedBanner } from './FinishedBanner'

describe('FinishedBanner', () => {
  it('shows victory message when myRole won', () => {
    render(<FinishedBanner winner="host" myRole="host" opponentNickname="bob" />)
    expect(screen.getByText(/Você venceu/i)).toBeInTheDocument()
  })

  it('shows opponent nickname (not the role label) when opponent won', () => {
    render(<FinishedBanner winner="host" myRole="guest" opponentNickname="alice" />)
    expect(screen.getByText(/alice venceu/i)).toBeInTheDocument()
    expect(screen.queryByText(/Host venceu/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Você venceu/i)).not.toBeInTheDocument()
  })

  it('falls back to "Oponente" when nickname is missing', () => {
    render(<FinishedBanner winner="host" myRole="guest" />)
    expect(screen.getByText(/Oponente venceu/i)).toBeInTheDocument()
  })

  it('shows draw message', () => {
    render(<FinishedBanner winner="draw" myRole="host" />)
    expect(screen.getByText(/Empate/i)).toBeInTheDocument()
  })

  it('shows abandoned message', () => {
    render(<FinishedBanner winner="abandoned" myRole="host" />)
    expect(screen.getByText(/abandonada|encerrada/i)).toBeInTheDocument()
  })
})
