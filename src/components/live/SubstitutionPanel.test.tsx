import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SubstitutionPanel } from './SubstitutionPanel'
import type { LiveSubPoolEntry } from '@/lib/contracts/live'
import type { AthleteRefDto } from '@/lib/contracts/draft'
import type { Position } from '@/lib/contracts/catalog'

const athlete = (id: string, pos: Position, name: string): AthleteRefDto => ({
  id,
  name,
  shortName: name,
  position: pos,
  jerseyNumber: 9,
  teamId: '00000000-0000-4000-8000-000000000020',
})

const poolEntry = (
  ath: AthleteRefDto,
  teamSide: 'home' | 'away',
  pointsSoFar: number,
): LiveSubPoolEntry => ({ athlete: ath, teamSide, pointsSoFar })

describe('SubstitutionPanel', () => {
  it('filters pool by position of selectedToRemove', () => {
    const selected = athlete('a-out', 'ATA', 'Pedro')
    const pool = [
      poolEntry(athlete('p1', 'ATA', 'Vini'), 'home', 5),
      poolEntry(athlete('p2', 'ZAG', 'Marquinhos'), 'away', 8),
    ]
    render(<SubstitutionPanel selectedToRemove={selected} pool={pool} onPick={() => {}} />)
    expect(screen.getByText('Vini')).toBeInTheDocument()
    expect(screen.queryByText('Marquinhos')).not.toBeInTheDocument()
  })

  it('shows pointsSoFar next to each candidate', () => {
    const selected = athlete('a-out', 'ATA', 'Pedro')
    const pool = [poolEntry(athlete('p1', 'ATA', 'Vini'), 'home', 5.5)]
    render(<SubstitutionPanel selectedToRemove={selected} pool={pool} onPick={() => {}} />)
    expect(screen.getByText('5.5')).toBeInTheDocument()
  })

  it('calls onPick with athleteId', () => {
    const selected = athlete('a-out', 'ATA', 'Pedro')
    const pool = [poolEntry(athlete('p1', 'ATA', 'Vini'), 'home', 0)]
    const fn = vi.fn()
    render(<SubstitutionPanel selectedToRemove={selected} pool={pool} onPick={fn} />)
    fireEvent.click(screen.getByTestId('sub-candidate-p1'))
    expect(fn).toHaveBeenCalledWith('p1')
  })
})
