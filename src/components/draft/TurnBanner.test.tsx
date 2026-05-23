import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TurnBanner } from './TurnBanner'

describe('TurnBanner', () => {
  it('shows "Aguardando escalação" when lineupReady is false', () => {
    render(<TurnBanner lineupReady={false} currentRole="host" myRole="host" currentPickNumber={0} opponentNickname="X" />)
    expect(screen.getByText(/aguardando escala/i)).toBeInTheDocument()
  })
  it('shows "Sua vez" when currentRole === myRole', () => {
    render(<TurnBanner lineupReady={true} currentRole="host" myRole="host" currentPickNumber={2} opponentNickname="X" />)
    expect(screen.getByText(/sua vez/i)).toBeInTheDocument()
  })
  it('shows "Vez de @opponentNickname" when opposite', () => {
    render(<TurnBanner lineupReady={true} currentRole="host" myRole="guest" currentPickNumber={2} opponentNickname="caio" />)
    expect(screen.getByText(/vez de.*caio/i)).toBeInTheDocument()
  })
  it('shows neutral text when currentRole is null (draft done)', () => {
    render(<TurnBanner lineupReady={true} currentRole={null} myRole="host" currentPickNumber={10} opponentNickname="X" />)
    expect(screen.getByText(/draft conclu/i)).toBeInTheDocument()
  })
})
