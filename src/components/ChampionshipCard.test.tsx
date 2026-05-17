import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChampionshipCard } from '@/components/ChampionshipCard'

describe('ChampionshipCard', () => {
  it('renders name, kind label, and links to /championships/<slug>', () => {
    render(
      <ChampionshipCard
        slug="brasileirao"
        name="Brasileirão"
        kind="league"
      />,
    )
    const link = screen.getByRole('link', { name: /brasileirão/i })
    expect(link).toHaveAttribute('href', '/championships/brasileirao')
    expect(screen.getByText(/liga/i)).toBeInTheDocument()
  })

  it('shows "Copa" label for kind=cup', () => {
    render(
      <ChampionshipCard
        slug="copa-mundo"
        name="Copa do Mundo"
        kind="cup"
      />,
    )
    expect(screen.getByText('Copa')).toBeInTheDocument()
  })
})
