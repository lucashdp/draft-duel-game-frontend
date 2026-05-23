import { describe, expect, it } from 'vitest'
import {
  athleteRefSchema,
  draftPickSchema,
  draftPoolEntrySchema,
  draftStateSchema,
  draftPickMadePayloadSchema,
  draftCurrentPickPayloadSchema,
  matchStartedPayloadSchema,
} from './draft'

const validAthlete = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Pedro',
  shortName: 'Pedro',
  position: 'ATA',
  jerseyNumber: 9,
  teamId: '00000000-0000-4000-8000-000000000002',
}

describe('athleteRefSchema', () => {
  it('accepts valid athlete', () => {
    expect(athleteRefSchema.parse(validAthlete)).toEqual(validAthlete)
  })
  it('accepts null jerseyNumber', () => {
    expect(athleteRefSchema.parse({ ...validAthlete, jerseyNumber: null }).jerseyNumber).toBeNull()
  })
  it('rejects invalid position', () => {
    expect(() => athleteRefSchema.parse({ ...validAthlete, position: 'WTF' })).toThrow()
  })
})

describe('draftPickSchema', () => {
  it('accepts valid pick', () => {
    const pick = {
      pickNumber: 0,
      role: 'host',
      athlete: validAthlete,
      madeAt: '2026-06-11T19:00:00.000Z',
    }
    expect(draftPickSchema.parse(pick)).toEqual(pick)
  })
  it('rejects pickNumber out of range', () => {
    expect(() =>
      draftPickSchema.parse({ pickNumber: 10, role: 'host', athlete: validAthlete, madeAt: '2026-06-11T19:00:00.000Z' }),
    ).toThrow()
  })
})

describe('draftPoolEntrySchema', () => {
  it('accepts entry with null pickedByRole', () => {
    expect(
      draftPoolEntrySchema.parse({ athlete: validAthlete, teamSide: 'home', pickedByRole: null }),
    ).toBeTruthy()
  })
  it('rejects invalid teamSide', () => {
    expect(() =>
      draftPoolEntrySchema.parse({ athlete: validAthlete, teamSide: 'middle', pickedByRole: null }),
    ).toThrow()
  })
})

describe('draftStateSchema', () => {
  it('accepts an empty pre-draft state', () => {
    expect(
      draftStateSchema.parse({
        currentPickNumber: 0,
        currentRole: 'host',
        lineupReady: true,
        picks: [],
        pool: [],
      }),
    ).toBeTruthy()
  })
  it('accepts a finished state with currentRole=null and currentPickNumber=10', () => {
    expect(
      draftStateSchema.parse({
        currentPickNumber: 10,
        currentRole: null,
        lineupReady: true,
        picks: [],
        pool: [],
      }),
    ).toBeTruthy()
  })
})

describe('ws payloads', () => {
  const pick = {
    pickNumber: 0,
    role: 'host' as const,
    athlete: validAthlete,
    madeAt: '2026-06-11T19:00:00.000Z',
  }
  it('draft:pick_made with nextPickNumber', () => {
    expect(
      draftPickMadePayloadSchema.parse({ pick, nextPickNumber: 1, currentRole: 'guest' }),
    ).toBeTruthy()
  })
  it('draft:pick_made on final pick has nulls', () => {
    expect(
      draftPickMadePayloadSchema.parse({ pick, nextPickNumber: null, currentRole: null }),
    ).toBeTruthy()
  })
  it('draft:current_pick', () => {
    expect(
      draftCurrentPickPayloadSchema.parse({ pickNumber: 3, role: 'host' }),
    ).toBeTruthy()
  })
  it('match:started with both lineups', () => {
    expect(
      matchStartedPayloadSchema.parse({
        startedAt: '2026-06-11T19:30:00.000Z',
        hostLineup: [validAthlete],
        guestLineup: [validAthlete],
      }),
    ).toBeTruthy()
  })
})
