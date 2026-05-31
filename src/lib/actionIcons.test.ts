import { describe, expect, it } from 'vitest'
import { ACTION_ICONS } from './actionIcons'
import { ACTION_TYPES } from '@/lib/contracts/live'

describe('ACTION_ICONS', () => {
  it('tem um ícone não-vazio para todos os ACTION_TYPES', () => {
    for (const t of ACTION_TYPES) {
      expect(ACTION_ICONS[t], `faltando ícone para ${t}`).toBeTruthy()
    }
  })
})
