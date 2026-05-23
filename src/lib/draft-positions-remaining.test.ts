import { describe, expect, it } from 'vitest'
import { computePositionsRemaining } from './draft-positions-remaining'
import type { DraftPickDto } from '@/lib/contracts/draft'

function makePick(overrides: { role: 'host' | 'guest'; position: 'GOL'|'LAT'|'ZAG'|'MEI'|'ATA' }): DraftPickDto {
  return {
    pickNumber: 0,
    role: overrides.role,
    athlete: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'X', shortName: 'X', position: overrides.position,
      jerseyNumber: 1, teamId: '00000000-0000-0000-0000-000000000002',
    },
    madeAt: '2026-06-11T19:00:00.000Z',
  }
}

describe('computePositionsRemaining', () => {
  it('returns all 5 positions when picks is empty', () => {
    expect(computePositionsRemaining([], 'host')).toEqual(['GOL', 'LAT', 'ZAG', 'MEI', 'ATA'])
  })
  it('subtracts only positions for the asked role', () => {
    const picks = [
      makePick({ role: 'host', position: 'GOL' }),
      makePick({ role: 'host', position: 'LAT' }),
      makePick({ role: 'guest', position: 'ATA' }),
    ]
    expect(computePositionsRemaining(picks, 'host')).toEqual(['ZAG', 'MEI', 'ATA'])
    expect(computePositionsRemaining(picks, 'guest')).toEqual(['GOL', 'LAT', 'ZAG', 'MEI'])
  })
  it('returns empty when role has filled all 5', () => {
    const picks = (['GOL','LAT','ZAG','MEI','ATA'] as const).map((p) =>
      makePick({ role: 'host', position: p }),
    )
    expect(computePositionsRemaining(picks, 'host')).toEqual([])
  })
})
