import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LineupGrid } from '@/components/LineupGrid'
import type { LineupEntryDto, MatchLineupsDto } from '@/lib/contracts/catalog'

const sampleTeam = {
  id: '00000000-0000-4000-8000-000000000020',
  name: 'A', shortName: 'A', abbreviation: 'AAA',
  imageUrl: null, primaryColor: '#000000', secondaryColor: '#FFFFFF',
}

function makeLineups(confirmed: boolean): MatchLineupsDto {
  return {
    matchId: '00000000-0000-4000-8000-000000000010',
    confirmedAt: confirmed ? '2026-05-20T17:00:00.000Z' : null,
    home: confirmed
      ? [
          {
            athlete: {
              id: '00000000-0000-4000-8000-0000000000a1',
              name: 'Home GK', shortName: 'GK1', position: 'GOL', jerseyNumber: 1,
              team: sampleTeam,
            },
            isStarter: true,
            jerseyNumber: 1,
          },
        ]
      : [],
    away: confirmed
      ? [
          {
            athlete: {
              id: '00000000-0000-4000-8000-0000000000b1',
              name: 'Away ATA', shortName: 'AT1', position: 'ATA', jerseyNumber: 9,
              team: { ...sampleTeam, id: '00000000-0000-4000-8000-000000000021', abbreviation: 'BBB' },
            },
            isStarter: true,
            jerseyNumber: 9,
          },
        ]
      : [],
  }
}

function makeSubstituteEntry(id: string, team: typeof sampleTeam): LineupEntryDto {
  return {
    athlete: {
      id,
      name: 'Sub Player', shortName: 'SUB', position: 'ATA', jerseyNumber: 99,
      team,
    },
    isStarter: false,
    jerseyNumber: 99,
  }
}

describe('LineupGrid', () => {
  it('does not render substitute (isStarter=false) entries', () => {
    const lineups = makeLineups(true)
    const awayTeam = { ...sampleTeam, id: '00000000-0000-4000-8000-000000000021', abbreviation: 'BBB' }
    // Inject one substitute into each team
    lineups.home.push(makeSubstituteEntry('00000000-0000-4000-8000-0000000000a9', sampleTeam))
    lineups.away.push(makeSubstituteEntry('00000000-0000-4000-8000-0000000000b9', awayTeam))

    render(<LineupGrid lineups={lineups} homeTeam={sampleTeam} awayTeam={awayTeam} />)

    // Each team has 1 starter + 1 sub → should only show 1 player each, not 2
    expect(screen.getAllByText('GK1')).toHaveLength(1)
    expect(screen.getAllByText('AT1')).toHaveLength(1)
    expect(screen.queryAllByText('SUB')).toHaveLength(0)
  })

  it('shows the not-confirmed message when confirmedAt is null', () => {
    render(<LineupGrid lineups={makeLineups(false)} homeTeam={sampleTeam} awayTeam={sampleTeam} />)
    expect(screen.getByText(/ainda não confirmadas/i)).toBeInTheDocument()
  })

  it('renders home and away players when lineups are confirmed', () => {
    const lineups = makeLineups(true)
    render(
      <LineupGrid
        lineups={lineups}
        homeTeam={sampleTeam}
        awayTeam={{ ...sampleTeam, id: '00000000-0000-4000-8000-000000000021', abbreviation: 'BBB' }}
      />,
    )
    expect(screen.getByText('GK1')).toBeInTheDocument()
    expect(screen.getByText('AT1')).toBeInTheDocument()
    expect(screen.getByText('AAA')).toBeInTheDocument()
    expect(screen.getByText('BBB')).toBeInTheDocument()
  })

  it('shows pending placeholders and X/11 counter when lineup is incomplete', () => {
    const lineups = makeLineups(true) // 1 player per team
    render(
      <LineupGrid
        lineups={lineups}
        homeTeam={sampleTeam}
        awayTeam={{ ...sampleTeam, id: '00000000-0000-4000-8000-000000000021', abbreviation: 'BBB' }}
      />,
    )
    // 1 confirmed player → 10 pending slots per team → 20 "A confirmar" total
    expect(screen.getAllByText('A confirmar')).toHaveLength(20)
    // Both team headers show "1/11"
    expect(screen.getAllByText('1/11')).toHaveLength(2)
  })
})
