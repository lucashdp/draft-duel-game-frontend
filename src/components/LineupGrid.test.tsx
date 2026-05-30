import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LineupGrid } from '@/components/LineupGrid'
import type { MatchLineupsDto } from '@/lib/contracts/catalog'

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

describe('LineupGrid', () => {
  it('shows the not-available message when confirmedAt is null', () => {
    render(<LineupGrid lineups={makeLineups(false)} homeTeam={sampleTeam} awayTeam={sampleTeam} />)
    expect(screen.getByText(/nenhum jogador disponível/i)).toBeInTheDocument()
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

  it('renders all available players including those with isStarter=false', () => {
    const lineups = makeLineups(true)
    const awayTeam = { ...sampleTeam, id: '00000000-0000-4000-8000-000000000021', abbreviation: 'BBB' }
    lineups.home.push({
      athlete: {
        id: '00000000-0000-4000-8000-0000000000a9',
        name: 'Sub Player', shortName: 'SUB', position: 'ATA', jerseyNumber: 99,
        team: sampleTeam,
      },
      isStarter: false,
      jerseyNumber: 99,
    })

    render(<LineupGrid lineups={lineups} homeTeam={sampleTeam} awayTeam={awayTeam} />)

    expect(screen.getByText('GK1')).toBeInTheDocument()
    expect(screen.getByText('SUB')).toBeInTheDocument()
  })
})
