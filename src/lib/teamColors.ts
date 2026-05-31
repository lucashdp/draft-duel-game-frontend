/** Cores neutras quando o time não tem paleta configurada (iguais às de PlayerCard). */
const DEFAULT_PRIMARY = '#1f2937'
const DEFAULT_SECONDARY = '#ffffff'

/** Distância (redmean) abaixo da qual as primárias contam como "a mesma cor". Tunável. */
export const SAME_COLOR_THRESHOLD = 60

export interface Palette {
  primary: string
  secondary: string
}

interface TeamColorsInput {
  primaryColor: string | null
  secondaryColor: string | null
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Aproximação perceptual barata (redmean). Faixa ~0..765. */
export function colorDistance(a: string, b: string): number {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  if (!ca || !cb) return Number.POSITIVE_INFINITY
  const rmean = (ca.r + cb.r) / 2
  const dr = ca.r - cb.r
  const dg = ca.g - cb.g
  const db = ca.b - cb.b
  return Math.sqrt(
    (2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db,
  )
}

function withDefaults(t: TeamColorsInput): Palette {
  return {
    primary: t.primaryColor ?? DEFAULT_PRIMARY,
    secondary: t.secondaryColor ?? DEFAULT_SECONDARY,
  }
}

/**
 * Resolve as paletas de uma partida. Se as primárias de casa e fora forem muito
 * próximas, inverte primária<->secundária do time VISITANTE para diferenciá-lo.
 */
export function resolveMatchPalettes(
  home: TeamColorsInput,
  away: TeamColorsInput,
): { home: Palette; away: Palette } {
  const homePalette = withDefaults(home)
  let awayPalette = withDefaults(away)
  if (colorDistance(homePalette.primary, awayPalette.primary) < SAME_COLOR_THRESHOLD) {
    awayPalette = { primary: awayPalette.secondary, secondary: awayPalette.primary }
  }
  return { home: homePalette, away: awayPalette }
}

export function paletteForSide(
  palettes: { home: Palette; away: Palette },
  side: 'home' | 'away',
): Palette {
  return side === 'home' ? palettes.home : palettes.away
}

/** Mapeia um atleta (pelo teamId) ao lado home/away dado o id do time da casa. */
export function sideForTeamId(teamId: string, homeTeamId: string): 'home' | 'away' {
  return teamId === homeTeamId ? 'home' : 'away'
}
