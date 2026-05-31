import { cn } from '@/lib/utils'

const sizeMap = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
} as const

interface TeamIconProps {
  imageUrl: string | null
  primaryColor: string
  secondaryColor: string
  size?: keyof typeof sizeMap
}

export function TeamIcon({ imageUrl, primaryColor, secondaryColor, size = 'md' }: TeamIconProps) {
  const sizeClass = sizeMap[size]

  if (imageUrl) {
    return (
      <div className={cn(sizeClass, 'shrink-0 flex items-center justify-center')}>
        <img src={imageUrl} alt="" className="w-full h-full object-contain" />
      </div>
    )
  }

  return (
    <div
      className={cn(sizeClass, 'rounded shrink-0')}
      style={{ backgroundColor: primaryColor, border: `2px solid ${secondaryColor}` }}
    />
  )
}
