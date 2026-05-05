import { render, screen } from '@testing-library/react'
import { JerseyIcon } from '@/components/JerseyIcon'

describe('JerseyIcon', () => {
  it('renders the jersey number', () => {
    render(
      <JerseyIcon jerseyNumber={10} primaryColor="#cc0000" secondaryColor="#ffffff" />,
    )
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('renders ? when number is null', () => {
    render(
      <JerseyIcon jerseyNumber={null} primaryColor="#cc0000" secondaryColor="#ffffff" />,
    )
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('applies the lg size class', () => {
    const { container } = render(
      <JerseyIcon jerseyNumber={7} primaryColor="#003399" secondaryColor="#ffffff" size="lg" />,
    )
    expect(container.firstChild).toHaveClass('w-10', 'h-10', 'text-base')
  })
})
