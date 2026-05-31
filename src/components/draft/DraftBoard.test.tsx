import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DraftBoard } from './DraftBoard'
import type { DraftPickDto } from '@/lib/contracts/draft'
import type { TeamRefDto } from '@/lib/contracts/rooms'

const home: TeamRefDto = {
  id: 'th', name: 'Home', shortName: 'Home', abbreviation: 'HOM',
  imageUrl: null, primaryColor: '#FF0000', secondaryColor: '#FFFFFF',
}
const away: TeamRefDto = {
  id: 'ta', name: 'Away', shortName: 'Away', abbreviation: 'AWY',
  imageUrl: null, primaryColor: '#0000FF', secondaryColor: '#FFFFFF',
}

function makePick(overrides: { pickNumber: number; role: 'host'|'guest'; teamId: string; position?: 'GOL'|'LAT'|'ZAG'|'MEI'|'ATA' }): DraftPickDto {
  return {
    pickNumber: overrides.pickNumber,
    role: overrides.role,
    athlete: {
      id: `a-${overrides.pickNumber}`,
      name: `Atleta ${overrides.pickNumber}`,
      shortName: `A${overrides.pickNumber}`,
      position: overrides.position ?? 'GOL',
      jerseyNumber: overrides.pickNumber + 1,
      teamId: overrides.teamId,
    },
    madeAt: '2026-06-11T19:00:00.000Z',
  }
}

describe('DraftBoard', () => {
  it('renders 10 slots (5 per role) when picks is empty', () => {
    render(<DraftBoard picks={[]} currentPickNumber={0} homeTeam={home} awayTeam={away} hostNickname="alice" guestNickname="bob" />)
    expect(screen.getAllByTestId(/^draft-slot/)).toHaveLength(10)
    expect(screen.getAllByTestId('draft-slot-empty')).toHaveLength(9)
    expect(screen.getByTestId('draft-slot-current')).toBeInTheDocument()
  })

  it('renders picked athletes for filled slots', () => {
    const picks: DraftPickDto[] = [
      makePick({ pickNumber: 0, role: 'host', teamId: 'th' }),
      makePick({ pickNumber: 1, role: 'guest', teamId: 'ta' }),
    ]
    render(<DraftBoard picks={picks} currentPickNumber={2} homeTeam={home} awayTeam={away} hostNickname="alice" guestNickname="bob" />)
    expect(screen.getByText('A0')).toBeInTheDocument()
    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getAllByTestId('draft-slot-empty')).toHaveLength(7)
  })

  it('marks the current pick slot with data-current', () => {
    render(<DraftBoard picks={[]} currentPickNumber={3} homeTeam={home} awayTeam={away} hostNickname="alice" guestNickname="bob" />)
    const current = screen.getByTestId('draft-slot-current')
    expect(current).toHaveAttribute('data-pick-number', '3')
  })
})
