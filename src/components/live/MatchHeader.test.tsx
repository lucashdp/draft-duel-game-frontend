import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatchHeader } from './MatchHeader'

const team = (over = {}) => ({
  id: 't1',
  name: 'Esquadrão',
  shortName: 'Esquadrão',
  abbreviation: 'ESQ',
  imageUrl: null,
  primaryColor: '#ff0000',
  secondaryColor: '#ffffff',
  ...over,
})

const baseProps = {
  homeTeam: team({ id: 't1', name: 'Flamengo', shortName: 'Flamengo', abbreviation: 'FLA' }),
  awayTeam: team({ id: 't2', name: 'Palmeiras', shortName: 'Palmeiras', abbreviation: 'PAL' }),
  homeScore: 1,
  awayScore: 0,
  matchStatus: 'live' as const,
}

describe('MatchHeader', () => {
  it('renders teams (shortName + abbreviation) and live score', () => {
    render(<MatchHeader {...baseProps} />)
    // desktop shortName + mobile abbreviation both rendered (CSS toggles visibility)
    expect(screen.getByText('Flamengo')).toBeInTheDocument()
    expect(screen.getByText('FLA')).toBeInTheDocument()
    expect(screen.getByText('Palmeiras')).toBeInTheDocument()
    expect(screen.getByText('PAL')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('AO VIVO')).toBeInTheDocument()
  })

  it('mostra o ícone de ao vivo mas esconde o texto "AO VIVO" no mobile', () => {
    render(<MatchHeader {...baseProps} />)
    const liveText = screen.getByText('AO VIVO')
    expect(liveText.className).toContain('hidden')
  })

  it('shows FIM badge in finished status and hides AO VIVO', () => {
    render(<MatchHeader {...baseProps} matchStatus="finished" />)
    expect(screen.getByText(/FIM/i)).toBeInTheDocument()
    expect(screen.queryByText('AO VIVO')).not.toBeInTheDocument()
  })
})
