import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MatchHeader } from './MatchHeader'

const team = (over = {}) => ({
  id: 't1', name: 'Esquadrão', shortName: 'Esquadrão', abbreviation: 'ESQ',
  imageUrl: null, primaryColor: '#ff0000', secondaryColor: '#ffffff', ...over,
})

describe('MatchHeader', () => {
  it('mostra o ícone de ao vivo mas esconde o texto "AO VIVO" no mobile', () => {
    render(
      <MatchHeader homeTeam={team()} awayTeam={team({ id: 't2', abbreviation: 'PAL' })}
        homeScore={2} awayScore={1} matchStatus="live" minute={73} />,
    )
    const liveText = screen.getByText('AO VIVO')
    expect(liveText.className).toContain('hidden')
  })
})
