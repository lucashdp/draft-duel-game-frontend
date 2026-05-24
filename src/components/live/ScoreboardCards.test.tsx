import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreboardCards } from './ScoreboardCards'

describe('ScoreboardCards', () => {
  it('highlights winning card in green', () => {
    render(
      <ScoreboardCards
        myName="Eu"
        oppName="Bob"
        myScore={15.5}
        oppScore={10}
        enableSubstitution={false}
        subMode={false}
        onToggleSub={() => {}}
      />,
    )
    const myCard = screen.getByTestId('my-card')
    expect(myCard.className).toMatch(/text-event-positive|text-green/)
  })

  it('shows the unlimited-subs hint when enableSubstitution is true', () => {
    render(
      <ScoreboardCards
        myName="Eu"
        oppName="Bob"
        myScore={5}
        oppScore={10}
        enableSubstitution={true}
        subMode={false}
        onToggleSub={() => {}}
      />,
    )
    expect(screen.getByText(/Subs ilimitadas/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /substituir/i })).toBeInTheDocument()
  })

  it('hides the sub UI when enableSubstitution is false', () => {
    render(
      <ScoreboardCards
        myName="Eu"
        oppName="Bob"
        myScore={5}
        oppScore={10}
        enableSubstitution={false}
        subMode={false}
        onToggleSub={() => {}}
      />,
    )
    expect(screen.queryByText(/Subs ilimitadas/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /substituir/i })).not.toBeInTheDocument()
  })

  it('shows Cancelar when subMode is true', () => {
    render(
      <ScoreboardCards
        myName="Eu"
        oppName="Bob"
        myScore={5}
        oppScore={10}
        enableSubstitution={true}
        subMode={true}
        onToggleSub={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
  })
})
