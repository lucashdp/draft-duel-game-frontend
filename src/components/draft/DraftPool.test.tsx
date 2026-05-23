import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DraftPool } from './DraftPool'
import type { DraftPoolEntryDto } from '@/lib/contracts/draft'
import type { TeamRefDto } from '@/lib/contracts/rooms'

const home: TeamRefDto = { id: 'th', name: 'Home', shortName: 'Home', abbreviation: 'HOM', primaryColor: '#FF0000', secondaryColor: '#FFFFFF' }
const away: TeamRefDto = { id: 'ta', name: 'Away', shortName: 'Away', abbreviation: 'AWY', primaryColor: '#0000FF', secondaryColor: '#FFFFFF' }

function makeEntry(opts: { id: string; teamSide: 'home'|'away'; teamId: string; position?: 'GOL'|'LAT'|'ZAG'|'MEI'|'ATA'; picked?: 'host'|'guest'|null }): DraftPoolEntryDto {
  return {
    athlete: {
      id: opts.id, name: opts.id, shortName: opts.id,
      position: opts.position ?? 'GOL', jerseyNumber: 1, teamId: opts.teamId,
    },
    teamSide: opts.teamSide,
    pickedByRole: opts.picked ?? null,
  }
}

describe('DraftPool', () => {
  it('renders "Atualizar escalação" CTA and empty state when lineupReady is false', () => {
    const onRefresh = vi.fn()
    render(
      <DraftPool
        pool={[]} disabled lineupReady={false}
        homeTeam={home} awayTeam={away}
        positionsRemaining={['GOL','LAT','ZAG','MEI','ATA']}
        hostNickname="alice" guestNickname="bob"
        onPick={vi.fn()} onRefresh={onRefresh}
      />,
    )
    expect(screen.getByRole('button', { name: /atualizar escala/i })).toBeInTheDocument()
  })

  it('shows two columns of starters when lineupReady=true', () => {
    const pool = [
      makeEntry({ id: 'h1', teamSide: 'home', teamId: 'th' }),
      makeEntry({ id: 'a1', teamSide: 'away', teamId: 'ta' }),
    ]
    render(
      <DraftPool
        pool={pool} disabled={false} lineupReady={true}
        homeTeam={home} awayTeam={away}
        positionsRemaining={['GOL','LAT','ZAG','MEI','ATA']}
        hostNickname="alice" guestNickname="bob"
        onPick={vi.fn()} onRefresh={vi.fn()}
      />,
    )
    expect(screen.getAllByText(/^h1$|^a1$/)).toHaveLength(2)
  })

  it('filters by position chip', async () => {
    const pool = [
      makeEntry({ id: 'h-gol', teamSide: 'home', teamId: 'th', position: 'GOL' }),
      makeEntry({ id: 'h-ata', teamSide: 'home', teamId: 'th', position: 'ATA' }),
    ]
    const user = userEvent.setup()
    render(
      <DraftPool
        pool={pool} disabled={false} lineupReady={true}
        homeTeam={home} awayTeam={away}
        positionsRemaining={['GOL','LAT','ZAG','MEI','ATA']}
        hostNickname="alice" guestNickname="bob"
        onPick={vi.fn()} onRefresh={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /^gol$/i }))
    expect(screen.getByText('h-gol')).toBeInTheDocument()
    expect(screen.queryByText('h-ata')).not.toBeInTheDocument()
  })

  it('marks picked entries and skips onPick for them', async () => {
    const onPick = vi.fn()
    const pool = [
      makeEntry({ id: 'taken', teamSide: 'home', teamId: 'th', picked: 'host' }),
    ]
    const user = userEvent.setup()
    render(
      <DraftPool
        pool={pool} disabled={false} lineupReady={true}
        homeTeam={home} awayTeam={away}
        positionsRemaining={['GOL','LAT','ZAG','MEI','ATA']}
        hostNickname="alice" guestNickname="bob"
        onPick={onPick} onRefresh={vi.fn()}
      />,
    )
    await user.click(screen.getByText('taken'))
    expect(onPick).not.toHaveBeenCalled()
  })

  it('calls onPick when available card is clicked', async () => {
    const onPick = vi.fn()
    const pool = [
      makeEntry({ id: 'avail', teamSide: 'home', teamId: 'th' }),
    ]
    const user = userEvent.setup()
    render(
      <DraftPool
        pool={pool} disabled={false} lineupReady={true}
        homeTeam={home} awayTeam={away}
        positionsRemaining={['GOL','LAT','ZAG','MEI','ATA']}
        hostNickname="alice" guestNickname="bob"
        onPick={onPick} onRefresh={vi.fn()}
      />,
    )
    await user.click(screen.getByText('avail'))
    expect(onPick).toHaveBeenCalledWith('avail')
  })
})
