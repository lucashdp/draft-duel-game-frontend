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
        canSub={false}
        subMode={false}
        onToggleSub={() => {}}
      />,
    )
    const myCard = screen.getByTestId('my-card')
    expect(myCard.className).toMatch(/text-event-positive|text-green/)
  })

  it('shows sub banner when canSub is true', () => {
    render(
      <ScoreboardCards
        myName="Eu"
        oppName="Bob"
        myScore={5}
        oppScore={10}
        canSub={true}
        subMode={false}
        onToggleSub={() => {}}
      />,
    )
    expect(screen.getByText(/Substitui[çc][aã]o dispon[ií]vel/i)).toBeInTheDocument()
  })

  it('shows Cancelar when subMode is true', () => {
    render(
      <ScoreboardCards
        myName="Eu"
        oppName="Bob"
        myScore={5}
        oppScore={10}
        canSub={true}
        subMode={true}
        onToggleSub={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
  })
})
