import { render } from '@testing-library/react'
import { JerseyIcon } from '@/components/JerseyIcon'

describe('JerseyIcon', () => {
  it('applies the lg size class', () => {
    const { container } = render(
      <JerseyIcon primaryColor="#003399" secondaryColor="#ffffff" size="lg" />,
    )
    expect(container.firstChild).toHaveClass('w-10', 'h-10', 'text-base')
  })
})
