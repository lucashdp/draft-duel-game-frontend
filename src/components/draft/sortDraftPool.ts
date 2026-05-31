import { POSITION_ORDER } from '@/types/domain'
import type { DraftPoolEntryDto } from '@/lib/contracts/draft'

/**
 * Sorts draft-pool entries by tactical position order (GOL, ZAG, LAT, MEI, ATA),
 * then by jersey number for a stable, readable list. Returns a new array.
 */
export function sortDraftPool(entries: DraftPoolEntryDto[]): DraftPoolEntryDto[] {
  return [...entries].sort((a, b) => {
    const posDiff =
      POSITION_ORDER.indexOf(a.athlete.position) - POSITION_ORDER.indexOf(b.athlete.position)
    if (posDiff !== 0) return posDiff
    return (a.athlete.jerseyNumber ?? 99) - (b.athlete.jerseyNumber ?? 99)
  })
}
