import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TeamIcon } from '@/components/TeamIcon'

describe('TeamIcon', () => {
  it('renders an img element when imageUrl is provided', () => {
    const { container } = render(
      <TeamIcon
        imageUrl="https://example.com/team.png"
        primaryColor="#ff0000"
        secondaryColor="#ffffff"
      />,
    )
    const img = container.querySelector('img')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/team.png')
  })

  it('renders no img element when imageUrl is null', () => {
    const { container } = render(
      <TeamIcon
        imageUrl={null}
        primaryColor="#ff0000"
        secondaryColor="#ffffff"
      />,
    )
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })
})
