import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatchCard } from '@/components/MatchCard'
import type { MatchSummaryDto, MatchTeamSummaryDto } from '@/lib/contracts/catalog'

const baseTeam: MatchTeamSummaryDto = {
  id: '00000000-0000-4000-8000-000000000020',
  name: 'A', shortName: 'A', abbreviation: 'AAA',
  imageUrl: null, primaryColor: '#000000', secondaryColor: '#FFFFFF',
  position: 1, form: ['V', 'E', 'D', 'V', 'V'],
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
    venue: null,
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

  it('shows the score and "Encerrado" when a played match is reported as scheduled (score present)', () => {
    // The backend can roll a finished match back to "scheduled" on a later calendar
    // sync (Cartola drops periodo_tr) while keeping its final score. The card must
    // surface the result rather than hiding it behind the kickoff time.
    render(
      <MatchCard match={makeMatch({ status: 'scheduled', homeScore: 2, awayScore: 1 })} />,
    )
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText(/encerrad/i)).toBeInTheDocument()
  })

  it('labels postponed matches', () => {
    render(<MatchCard match={makeMatch({ status: 'postponed' })} />)
    expect(screen.getByText(/adiado/i)).toBeInTheDocument()
  })

  it('labels canceled matches', () => {
    render(<MatchCard match={makeMatch({ status: 'canceled' })} />)
    expect(screen.getByText(/cancelado/i)).toBeInTheDocument()
  })

  it('shows each team table position', () => {
    render(
      <MatchCard
        match={makeMatch({
          homeTeam: { ...baseTeam, abbreviation: 'AAA', position: 1 },
          awayTeam: { ...baseTeam, abbreviation: 'BBB', position: 3 },
        })}
      />,
    )
    expect(screen.getByText(/1º lugar/)).toBeInTheDocument()
    expect(screen.getByText(/3º lugar/)).toBeInTheDocument()
  })

  it('hides the position line when position is null', () => {
    render(
      <MatchCard
        match={makeMatch({
          homeTeam: { ...baseTeam, abbreviation: 'AAA', position: null },
          awayTeam: { ...baseTeam, abbreviation: 'BBB', position: null },
        })}
      />,
    )
    expect(screen.queryByText(/lugar/)).not.toBeInTheDocument()
  })

  it('renders a form badge per recent result, oldest to newest', () => {
    render(
      <MatchCard
        match={makeMatch({
          homeTeam: { ...baseTeam, abbreviation: 'AAA', form: ['V', 'E', 'D', 'V', 'V'] },
          awayTeam: { ...baseTeam, abbreviation: 'BBB', form: [] },
        })}
      />,
    )
    const badges = screen.getAllByTestId('form-badge')
    expect(badges).toHaveLength(5)
    expect(badges.map((b) => b.textContent)).toEqual(['V', 'E', 'D', 'V', 'V'])
  })

  it('renders no form badges when form is empty', () => {
    render(
      <MatchCard
        match={makeMatch({
          homeTeam: { ...baseTeam, abbreviation: 'AAA', form: [] },
          awayTeam: { ...baseTeam, abbreviation: 'BBB', form: [] },
        })}
      />,
    )
    expect(screen.queryAllByTestId('form-badge')).toHaveLength(0)
  })

  it('shows the venue when present', () => {
    render(<MatchCard match={makeMatch({ venue: 'Maracanã' })} />)
    expect(screen.getByText('Maracanã')).toBeInTheDocument()
  })

  it('hides the venue when null', () => {
    render(<MatchCard match={makeMatch({ venue: null })} />)
    expect(screen.queryByText('Maracanã')).not.toBeInTheDocument()
  })
})

describe('MatchCard ao vivo', () => {
  it('mostra um indicador de ao vivo com o minuto em destaque', () => {
    render(
      <MatchCard
        match={makeMatch({ status: 'live', homeScore: 1, awayScore: 0, currentMinute: 73 })}
      />,
    )
    const live = screen.getByTestId('live-indicator')
    expect(live).toHaveTextContent("73'")
  })
})
