import { describe, expect, it } from 'vitest'
import { sortDraftPool } from './sortDraftPool'
import type { DraftPoolEntryDto } from '@/lib/contracts/draft'

function entry(position: DraftPoolEntryDto['athlete']['position'], jersey: number): DraftPoolEntryDto {
  return {
    athlete: {
      id: `a-${position}-${jersey}`,
      name: `${position} ${jersey}`,
      shortName: `${position}${jersey}`,
      position,
      jerseyNumber: jersey,
      teamId: 't-1',
    },
    teamSide: 'home',
    pickedByRole: null,
  } as DraftPoolEntryDto
}

describe('sortDraftPool', () => {
  it('orders entries by position: GOL, ZAG, LAT, MEI, ATA', () => {
    const unsorted = [entry('ATA', 9), entry('GOL', 1), entry('LAT', 2), entry('ZAG', 4), entry('MEI', 8)]
    const result = sortDraftPool(unsorted).map((e) => e.athlete.position)
    expect(result).toEqual(['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'])
  })

  it('breaks ties within a position by jersey number', () => {
    const result = sortDraftPool([entry('ZAG', 13), entry('ZAG', 3)]).map((e) => e.athlete.jerseyNumber)
    expect(result).toEqual([3, 13])
  })

  it('sorts athletes with no jersey number last within a position', () => {
    const noJersey = { ...entry('ZAG', 5), athlete: { ...entry('ZAG', 5).athlete, jerseyNumber: null } } as DraftPoolEntryDto
    const result = sortDraftPool([noJersey, entry('ZAG', 7)]).map((e) => e.athlete.jerseyNumber)
    expect(result).toEqual([7, null])
  })

  it('does not mutate the input array', () => {
    const input = [entry('ATA', 9), entry('GOL', 1)]
    sortDraftPool(input)
    expect(input.map((e) => e.athlete.position)).toEqual(['ATA', 'GOL'])
  })
})
