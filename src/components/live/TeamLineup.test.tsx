import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TeamLineup } from './TeamLineup'
import type { LineupSlot } from '@/lib/contracts/live'
import type { Position } from '@/lib/contracts/catalog'

const slot = (id: string, pos: Position, name: string, points = 0): LineupSlot => ({
  athlete: {
    id,
    name,
    shortName: name,
    position: pos,
    jerseyNumber: 9,
    teamId: '00000000-0000-4000-8000-000000000020',
  },
  cumulativePoints: points,
})

describe('TeamLineup', () => {
  it('renders 5 slots ordered by POSITION_ORDER', () => {
    const lineup = [
      slot('a-ata', 'ATA', 'Atac'),
      slot('a-gol', 'GOL', 'Gol'),
      slot('a-zag', 'ZAG', 'Zag'),
      slot('a-mei', 'MEI', 'Mei'),
      slot('a-lat', 'LAT', 'Lat'),
    ]
    render(<TeamLineup title="Time" lineup={lineup} />)
    const slots = screen.getAllByTestId(/lineup-slot-/)
    expect(slots[0]).toHaveTextContent('Gol')
    expect(slots[1]).toHaveTextContent('Lat')
    expect(slots[2]).toHaveTextContent('Zag')
    expect(slots[3]).toHaveTextContent('Mei')
    expect(slots[4]).toHaveTextContent('Atac')
  })

  it('calls onSelectRemove only when in subMode', () => {
    const lineup = [slot('a-1', 'ATA', 'Pedro', 8)]
    const fn = vi.fn()
    const { rerender } = render(
      <TeamLineup title="Time" lineup={lineup} subMode={false} onSelectRemove={fn} />,
    )
    fireEvent.click(screen.getByTestId('lineup-slot-a-1'))
    expect(fn).not.toHaveBeenCalled()

    rerender(<TeamLineup title="Time" lineup={lineup} subMode={true} onSelectRemove={fn} />)
    fireEvent.click(screen.getByTestId('lineup-slot-a-1'))
    expect(fn).toHaveBeenCalledWith(lineup[0].athlete)
  })
})
