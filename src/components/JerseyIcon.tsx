import { cn } from '@/lib/utils'

const sizeMap = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
} as const

interface JerseyIconProps {
  jerseyNumber?: number | null
  primaryColor: string
  secondaryColor: string
  size?: keyof typeof sizeMap
  className?: string
}

export function JerseyIcon({
  primaryColor,
  secondaryColor,
  size = 'md',
  className,
}: JerseyIconProps) {
  return (
    <div
      className={cn(
        sizeMap[size],
        'rounded shrink-0',
        className,
      )}
      style={{
        backgroundColor: primaryColor,
        border: `2px solid ${secondaryColor}`,
      }}
    />
  )
}
