import { describe, expect, it } from 'vitest'
import { colorDistance, resolveMatchPalettes, paletteForSide, SAME_COLOR_THRESHOLD } from './teamColors'

describe('colorDistance', () => {
  it('é 0 para cores idênticas', () => {
    expect(colorDistance('#ff0000', '#ff0000')).toBe(0)
  })
  it('é grande para cores bem diferentes', () => {
    expect(colorDistance('#ff0000', '#0000ff')).toBeGreaterThan(SAME_COLOR_THRESHOLD)
  })
})

describe('resolveMatchPalettes', () => {
  it('inverte a paleta do visitante quando as primárias colidem', () => {
    const { home, away } = resolveMatchPalettes(
      { primaryColor: '#ff0000', secondaryColor: '#ffffff' },
      { primaryColor: '#ff0000', secondaryColor: '#000000' },
    )
    expect(home).toEqual({ primary: '#ff0000', secondary: '#ffffff' })
    expect(away).toEqual({ primary: '#000000', secondary: '#ff0000' })
  })
  it('não inverte quando as primárias são distintas', () => {
    const { away } = resolveMatchPalettes(
      { primaryColor: '#ff0000', secondaryColor: '#ffffff' },
      { primaryColor: '#0000ff', secondaryColor: '#ffff00' },
    )
    expect(away).toEqual({ primary: '#0000ff', secondary: '#ffff00' })
  })
  it('usa defaults neutros quando a cor é nula', () => {
    const { home } = resolveMatchPalettes(
      { primaryColor: null, secondaryColor: null },
      { primaryColor: '#0000ff', secondaryColor: '#ffff00' },
    )
    expect(home).toEqual({ primary: '#1f2937', secondary: '#ffffff' })
  })
})

describe('paletteForSide', () => {
  it('retorna a paleta certa por lado', () => {
    const palettes = { home: { primary: '#a', secondary: '#b' }, away: { primary: '#c', secondary: '#d' } }
    expect(paletteForSide(palettes, 'away')).toEqual({ primary: '#c', secondary: '#d' })
  })
})
