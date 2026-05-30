import { describe, expect, it } from 'vitest'
import { formatDayLabel, groupMatchesByDay } from './matchGroups'
import type { MatchSummaryDto, MatchTeamSummaryDto } from '@/lib/contracts/catalog'

const team: MatchTeamSummaryDto = {
  id: '00000000-0000-4000-8000-000000000020',
  name: 'A', shortName: 'A', abbreviation: 'AAA',
  imageUrl: null, primaryColor: '#000000', secondaryColor: '#FFFFFF',
  position: 1, form: [],
}

function match(id: string, kickoffAt: string): MatchSummaryDto {
  return {
    id,
    championshipId: '00000000-0000-4000-8000-000000000001',
    kickoffAt,
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    currentMinute: null,
    lineupsConfirmedAt: null,
    venue: null,
    homeTeam: { ...team },
    awayTeam: { ...team, id: '00000000-0000-4000-8000-000000000021' },
  }
}

describe('groupMatchesByDay', () => {
  it('groups by calendar day, days ascending and matches ascending within a day', () => {
    const groups = groupMatchesByDay([
      match('m-late-31', '2026-05-31T15:00:00.000Z'),
      match('m-day-30', '2026-05-30T15:00:00.000Z'),
      match('m-early-31', '2026-05-31T09:00:00.000Z'),
    ])

    expect(groups.map((g) => g.key)).toEqual(['2026-05-30', '2026-05-31'])
    expect(groups[0].matches.map((m) => m.id)).toEqual(['m-day-30'])
    expect(groups[1].matches.map((m) => m.id)).toEqual(['m-early-31', 'm-late-31'])
  })

  it('returns an empty array for no matches', () => {
    expect(groupMatchesByDay([])).toEqual([])
  })
})

describe('formatDayLabel', () => {
  it('formats a capitalized weekday with day and month in full', () => {
    const label = formatDayLabel('2026-05-31T15:00:00.000Z')
    expect(label).toMatch(/^[A-ZÀ-Ý]/)
    expect(label).toMatch(/, 31 de maio$/)
  })
})
