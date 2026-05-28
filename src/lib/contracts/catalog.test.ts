import { describe, expect, it } from 'vitest'
import {
  championshipSchema,
  currentRoundSchema,
  matchLineupsSchema,
  matchSummarySchema,
  teamSchema,
} from './catalog'

const validTeam = {
  id: '00000000-0000-4000-8000-000000000020',
  name: 'A',
  shortName: 'A',
  abbreviation: 'AAA',
  imageUrl: null,
  primaryColor: '#000000',
  secondaryColor: '#FFFFFF',
}

describe('catalog contracts', () => {
  it('parses a championship', () => {
    const parsed = championshipSchema.parse({
      id: '00000000-0000-4000-8000-000000000001',
      slug: 'brasileirao',
      name: 'Brasileirão',
      kind: 'league',
    })
    expect(parsed.slug).toBe('brasileirao')
  })

  it('parses a match summary with both teams', () => {
    const parsed = matchSummarySchema.parse({
      id: '00000000-0000-4000-8000-000000000010',
      championshipId: '00000000-0000-4000-8000-000000000001',
      kickoffAt: '2026-05-20T18:00:00.000Z',
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      currentMinute: null,
      lineupsConfirmedAt: null,
      homeTeam: {
        id: '00000000-0000-4000-8000-000000000020',
        name: 'A', shortName: 'A', abbreviation: 'AAA',
        imageUrl: null, primaryColor: '#000000', secondaryColor: '#FFFFFF',
      },
      awayTeam: {
        id: '00000000-0000-4000-8000-000000000021',
        name: 'B', shortName: 'B', abbreviation: 'BBB',
        imageUrl: null, primaryColor: '#FF0000', secondaryColor: '#FFFFFF',
      },
    })
    expect(parsed.status).toBe('scheduled')
  })

  it('parses a current round response with championship, round, and matches', () => {
    const parsed = currentRoundSchema.parse({
      championship: {
        id: '00000000-0000-4000-8000-000000000001',
        slug: 'brasileirao',
        name: 'Brasileirão',
        kind: 'league',
      },
      round: {
        id: '00000000-0000-4000-8000-000000000002',
        number: 1,
        name: 'Rodada 1',
        startsAt: null,
        endsAt: null,
      },
      matches: [],
    })
    expect(parsed.round.number).toBe(1)
  })

  it('parses an empty lineups response', () => {
    const parsed = matchLineupsSchema.parse({
      matchId: '00000000-0000-4000-8000-000000000010',
      confirmedAt: null,
      home: [],
      away: [],
    })
    expect(parsed.home).toEqual([])
  })

  it('parses lineup entries with null jerseyNumber without throwing', () => {
    const team = validTeam
    const parsed = matchLineupsSchema.parse({
      matchId: '00000000-0000-4000-8000-000000000010',
      confirmedAt: '2026-05-20T17:00:00.000Z',
      home: [
        {
          athlete: {
            id: '00000000-0000-4000-8000-0000000000a1',
            name: 'Player A', shortName: 'PA', position: 'GOL',
            jerseyNumber: null, team,
          },
          isStarter: true,
          jerseyNumber: null,
        },
      ],
      away: [],
    })
    expect(parsed.home).toHaveLength(1)
    expect(parsed.home[0].jerseyNumber).toBeNull()
  })

  it('rejects a championship with bad kind', () => {
    expect(() =>
      championshipSchema.parse({
        id: '00000000-0000-4000-8000-000000000001',
        slug: 'x', name: 'X', kind: 'tournament',
      }),
    ).toThrow()
  })

  it('rejects team colors not in #RRGGBB form', () => {
    expect(() => teamSchema.parse({ ...validTeam, primaryColor: '#FFF' })).toThrow()
    expect(() => teamSchema.parse({ ...validTeam, secondaryColor: 'rgb(0,0,0)' })).toThrow()
    expect(() => teamSchema.parse({ ...validTeam, primaryColor: 'red' })).toThrow()
  })
})
