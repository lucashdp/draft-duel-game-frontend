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

  it('limpa quem entra ao trocar a posição de quem sai (evita par incompatível)', () => {
    const lineup2 = [
      { athlete: athlete('Leo', 'ZAG'), cumulativePoints: 8 },
      { athlete: athlete('Alisson', 'GOL'), cumulativePoints: 6 },
    ]
    const pool2 = [
      { athlete: athlete('Murilo', 'ZAG'), teamSide: 'home' as const, pointsSoFar: 5 },
      { athlete: athlete('Weverton', 'GOL'), teamSide: 'home' as const, pointsSoFar: 4 },
    ]
    render(
      <SubstitutionModal open lineup={lineup2} pool={pool2} palettes={palettes} homeTeamId="t1"
        loading={false} onClose={() => {}} onConfirm={() => {}} />,
    )
    // passo 1: escolhe Leo (ZAG) → passo 2: escolhe Murilo (ZAG) → passo 3
    fireEvent.click(screen.getByText('Leo'))
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }))
    fireEvent.click(screen.getByText('Murilo'))
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }))
    // volta ao passo 1 e troca pra Alisson (GOL)
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }))
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }))
    fireEvent.click(screen.getByText('Alisson'))
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }))
    // passo 2: "Próximo" desabilitado pois quem-entra foi limpo ao trocar a posição
    expect(screen.getByRole('button', { name: /próximo/i })).toBeDisabled()
  })

  it('mostra empty-state quando não há candidato para a posição de quem sai', () => {
    const lineup2 = [{ athlete: athlete('Alisson', 'GOL'), cumulativePoints: 6 }]
    // pool só tem ZAG — nenhum goleiro disponível para entrar
    const pool2 = [{ athlete: athlete('Murilo', 'ZAG'), teamSide: 'home' as const, pointsSoFar: 5 }]
    render(
      <SubstitutionModal open lineup={lineup2} pool={pool2} palettes={palettes} homeTeamId="t1"
        loading={false} onClose={() => {}} onConfirm={() => {}} />,
    )
    fireEvent.click(screen.getByText('Alisson'))
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }))
    expect(screen.getByText(/nenhum jogador disponível para essa posição/i)).toBeInTheDocument()
    // sem candidato selecionável, não dá pra avançar
    expect(screen.getByRole('button', { name: /próximo/i })).toBeDisabled()
  })
})
