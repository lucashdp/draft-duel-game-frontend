import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SubstitutionModal } from './SubstitutionModal'
import type { Position } from '@/lib/contracts/catalog'

const palettes = { home: { primary: '#a00', secondary: '#fff' }, away: { primary: '#00a', secondary: '#fff' } }
const athlete = (id: string, pos: Position = 'ZAG') => ({ id, name: id, shortName: id, position: pos, jerseyNumber: 1, teamId: 't1' })

const lineup = [{ athlete: athlete('Leo'), cumulativePoints: 8 }]
const pool = [{ athlete: athlete('Murilo'), teamSide: 'home' as const, pointsSoFar: 5 }]

describe('SubstitutionModal', () => {
  it('caminha do passo 1 ao 3 e confirma', () => {
    const onConfirm = vi.fn()
    render(
      <SubstitutionModal open lineup={lineup} pool={pool} palettes={palettes} homeTeamId="t1"
        loading={false} onClose={() => {}} onConfirm={onConfirm} />,
    )
    fireEvent.click(screen.getByText('Leo'))
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }))
    fireEvent.click(screen.getByText('Murilo'))
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(onConfirm).toHaveBeenCalledWith('Leo', 'Murilo')
  })
})
