import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatchCard } from '@/components/MatchCard'
import type { MatchSummaryDto } from '@/lib/contracts/catalog'

const baseTeam = {
  id: '00000000-0000-4000-8000-000000000020',
  name: 'A', shortName: 'A', abbreviation: 'AAA',
  crestUrl: null, primaryColor: '#000000', secondaryColor: '#FFFFFF',
}

function makeMatch(overrides: Partial<MatchSummaryDto> = {}): MatchSummaryDto {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    championshipId: '00000000-0000-4000-8000-000000000001',
    kickoffAt: '2026-05-20T18:00:00.000Z',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    currentMinute: null,
    lineupsConfirmedAt: null,
    homeTeam: { ...baseTeam, abbreviation: 'AAA' },
    awayTeam: { ...baseTeam, id: '00000000-0000-4000-8000-000000000021', abbreviation: 'BBB' },
    ...overrides,
  }
}

describe('MatchCard', () => {
  it('renders both team abbreviations and links to /matches/<id>', () => {
    render(<MatchCard match={makeMatch()} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/matches/00000000-0000-4000-8000-000000000010')
    expect(screen.getByText('AAA')).toBeInTheDocument()
    expect(screen.getByText('BBB')).toBeInTheDocument()
  })

  it('shows the kickoff time for scheduled matches', () => {
    render(<MatchCard match={makeMatch({ kickoffAt: '2026-05-20T18:00:00.000Z' })} />)
    expect(screen.getByText(/18:00|15:00/)).toBeInTheDocument()
  })

  it('shows the score when match is live', () => {
    render(
      <MatchCard
        match={makeMatch({ status: 'live', homeScore: 1, awayScore: 2, currentMinute: 42 })}
      />,
    )
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText(/42'/)).toBeInTheDocument()
  })

  it('shows the final score when match is finished', () => {
    render(
      <MatchCard match={makeMatch({ status: 'finished', homeScore: 3, awayScore: 0 })} />,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText(/encerrad/i)).toBeInTheDocument()
  })

  it('labels postponed matches', () => {
    render(<MatchCard match={makeMatch({ status: 'postponed' })} />)
    expect(screen.getByText(/adiado/i)).toBeInTheDocument()
  })
})
