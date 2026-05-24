import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatchHeader } from './MatchHeader'

const baseProps = {
  homeTeam: { id: '1', name: 'Flamengo', shortName: 'FLA' },
  awayTeam: { id: '2', name: 'Palmeiras', shortName: 'PAL' },
  homeScore: 1,
  awayScore: 0,
  matchStatus: 'live' as const,
  minute: 30,
}

describe('MatchHeader', () => {
  it('renders teams and live score', () => {
    render(<MatchHeader {...baseProps} />)
    expect(screen.getByText('FLA')).toBeInTheDocument()
    expect(screen.getByText('PAL')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText(/AO VIVO/i)).toBeInTheDocument()
    expect(screen.getByText("30'")).toBeInTheDocument()
  })

  it('shows FIM badge in finished status', () => {
    render(<MatchHeader {...baseProps} matchStatus="finished" minute={95} />)
    expect(screen.getByText(/FIM/i)).toBeInTheDocument()
    expect(screen.queryByText(/AO VIVO/i)).not.toBeInTheDocument()
  })

  it('renders placeholder when minute is null', () => {
    render(<MatchHeader {...baseProps} minute={null} />)
    expect(screen.getByText(/--/)).toBeInTheDocument()
  })
})
