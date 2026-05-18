import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OpponentSlot } from './OpponentSlot'

describe('OpponentSlot', () => {
  it('shows waiting state when opponent is null', () => {
    render(<OpponentSlot opponent={null} />)
    expect(screen.getByText(/aguardando oponente/i)).toBeInTheDocument()
  })

  it('shows opponent nickname when present', () => {
    render(<OpponentSlot opponent={{ nickname: 'bob' }} />)
    expect(screen.getByText('bob')).toBeInTheDocument()
  })
})
