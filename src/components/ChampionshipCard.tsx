import Link from 'next/link'
import { cn } from '@/lib/utils'

const KIND_LABEL: Record<'league' | 'cup', string> = {
  league: 'Liga',
  cup: 'Copa',
}

interface ChampionshipCardProps {
  slug: string
  name: string
  kind: 'league' | 'cup'
  className?: string
}

export function ChampionshipCard({ slug, name, kind, className }: ChampionshipCardProps) {
  return (
    <Link
      href={`/championships/${slug}`}
      className={cn(
        'block rounded-xl bg-surface px-5 py-6 transition-all',
        'hover:bg-accent hover:scale-[1.01]',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.05)]',
        className,
      )}
    >
      <span className="inline-block text-[0.65rem] font-semibold uppercase tracking-wider text-primary mb-2">
        {KIND_LABEL[kind]}
      </span>
      <h2 className="text-xl font-bold text-foreground">{name}</h2>
    </Link>
  )
}
