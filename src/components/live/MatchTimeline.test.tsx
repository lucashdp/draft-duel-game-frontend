import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatchTimeline } from './MatchTimeline'
import type { MatchEvent } from '@/lib/contracts/live'

const event = (overrides: Partial<MatchEvent> = {}): MatchEvent => ({
  id: '00000000-0000-4000-8000-0000000000e1',
  athlete: {
    id: '00000000-0000-4000-8000-0000000000a1',
    name: 'Pedro',
    shortName: 'Pedro',
    position: 'ATA',
    jerseyNumber: 9,
    teamId: '00000000-0000-4000-8000-000000000020',
  },
  action: 'GOAL',
  minute: 30,
  points: 8,
  affectedRole: 'host',
  canceled: false,
  ...overrides,
})

describe('MatchTimeline', () => {
  it('renders events with name, action, points', () => {
    render(<MatchTimeline events={[event({})]} />)
    expect(screen.getByText('Pedro')).toBeInTheDocument()
    expect(screen.getByText(/Gol/i)).toBeInTheDocument()
    expect(screen.getByText('+8.0')).toBeInTheDocument()
  })

  it('marks canceled events with ANULADO and negative points', () => {
    render(<MatchTimeline events={[event({ canceled: true, points: -8 })]} />)
    expect(screen.getByText(/ANULADO/i)).toBeInTheDocument()
    expect(screen.getByText(/-8\.0/)).toBeInTheDocument()
  })

  it('shows empty placeholder when no events', () => {
    render(<MatchTimeline events={[]} />)
    expect(screen.getByText(/Aguardando eventos/i)).toBeInTheDocument()
  })
})
