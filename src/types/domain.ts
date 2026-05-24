import type { Position } from '@/lib/contracts/catalog'
import type { ActionType } from '@/lib/contracts/live'

export type { ActionType }

export type RoomStatus = 'waiting' | 'drafting' | 'live' | 'finished'

export type Role = 'host' | 'guest'

export type Winner = 'host' | 'guest' | 'draw' | 'abandoned'

export interface User {
  id: string
  email: string
  nickname: string
}

export interface DraftPick {
  pickNumber: number
  role: Role
  athleteId: string
}

export interface LineupInterval {
  athleteId: string
  validFromMinute: number
  validToMinute: number | null
}

export interface Room {
  id: string
  code: string
  matchId: string
  status: RoomStatus
  currentPickNumber: number
  hostScore: number | null
  guestScore: number | null
  winner: Winner | null
  hostUserId: string
  guestUserId: string | null
  draftPicks: DraftPick[]
  hostIntervals: LineupInterval[]
  guestIntervals: LineupInterval[]
}

export const ACTION_LABELS: Record<ActionType, string> = {
  GOAL: 'Gol',
  ASSIST: 'Assistência',
  YELLOW_CARD: 'Cartão Amarelo',
  RED_CARD: 'Cartão Vermelho',
  SAVE: 'Defesa',
  PENALTY_SAVE: 'Defesa de Pênalti',
  OWN_GOAL: 'Gol Contra',
  PENALTY_MISS: 'Pênalti Perdido',
  PENALTY_GOAL: 'Gol de Pênalti',
  INTERCEPTION: 'Roubada de Bola',
  TACKLE_WON: 'Desarme',
  KEY_PASS: 'Passe Decisivo',
  SHOT_ON_TARGET: 'Finalização Certa',
  CLEAN_SHEET: 'Jogo sem Sofrer Gol',
  HARD_SAVE: 'Defesa Difícil',
  GOAL_CONCEDED: 'Gol Sofrido',
  POST_HIT: 'Finalização na Trave',
  MISSED_PASS: 'Passe Errado',
  FOUL_SUFFERED: 'Falta Sofrida',
  FOUL_COMMITTED: 'Falta Cometida',
  OFFSIDE: 'Impedimento',
}

export const POSITION_ORDER: Position[] = ['GOL', 'LAT', 'ZAG', 'MEI', 'ATA']
