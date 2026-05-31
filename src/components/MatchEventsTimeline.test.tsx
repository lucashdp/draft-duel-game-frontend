import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MatchEventsTimeline } from './MatchEventsTimeline'
import type { MatchEventEntryDto } from '@/lib/contracts/matchEvents'

const ev = (id: string, action: MatchEventEntryDto['action'], minute: number): MatchEventEntryDto => ({
  id, action, minute, occurredAt: '2026-05-31T20:10:00.000Z',
  athlete: { id: 'a' + id, name: 'Fulano', shortName: 'Fulano', position: 'ATA', jerseyNumber: 9, teamId: 't1' },
})

describe('MatchEventsTimeline', () => {
  it('mostra estado vazio sem eventos', () => {
    render(<MatchEventsTimeline events={[]} />)
    expect(screen.getByText(/sem eventos/i)).toBeInTheDocument()
  })
  it('lista eventos com minuto, nome e rótulo', () => {
    render(<MatchEventsTimeline events={[ev('1', 'GOAL', 10)]} />)
    expect(screen.getByText("10'")).toBeInTheDocument()
    expect(screen.getByText('Fulano')).toBeInTheDocument()
    expect(screen.getByText('Gol')).toBeInTheDocument()
  })
})
