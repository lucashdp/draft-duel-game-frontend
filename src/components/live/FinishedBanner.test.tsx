import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FinishedBanner } from './FinishedBanner'

describe('FinishedBanner', () => {
  it('shows victory message when myRole won', () => {
    render(<FinishedBanner winner="host" myRole="host" />)
    expect(screen.getByText(/Você venceu/i)).toBeInTheDocument()
  })

  it('shows defeat message when opponent won', () => {
    render(<FinishedBanner winner="host" myRole="guest" />)
    expect(screen.getByText(/venceu/i)).toBeInTheDocument()
    expect(screen.queryByText(/Você venceu/i)).not.toBeInTheDocument()
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
