export type Position = 'GOL' | 'LAT' | 'ZAG' | 'MEI' | 'ATA'

export type ActionType =
  | 'GOL' | 'ASS' | 'RB' | 'DS' | 'PE'
  | 'DEF' | 'SG' | 'DD' | 'DP' | 'GS'
  | 'FF' | 'FS' | 'FT' | 'I' | 'GC' | 'PP'
  | 'CA' | 'CV'

export type RoomStatus = 'waiting' | 'drafting' | 'live' | 'finished'

export type Role = 'host' | 'guest'

export type Winner = 'host' | 'guest' | 'draw' | 'abandoned'

export interface User {
  id: string
  email: string
  nickname: string
}

export interface Championship {
  id: string
  slug: string
  name: string
  kind: 'league' | 'cup'
}

export interface Team {
  id: string
  name: string
  shortName: string
  abbreviation: string
  crestUrl: string | null
  primaryColor: string
  secondaryColor: string
}

export interface Athlete {
  id: string
  name: string
  shortName: string
  position: Position
  jerseyNumber: number | null
  team: Team
}

export interface Match {
  id: string
  championshipId: string
  kickoffAt: string
  status: 'scheduled' | 'live' | 'finished' | 'postponed'
  currentMinute: number | null
  homeScore: number | null
  awayScore: number | null
  homeTeam: Team
  awayTeam: Team
  lineupsConfirmedAt: string | null
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

export interface MatchEvent {
  eventId: string
  athleteId: string
  action: ActionType
  minute: number
  points: number
  affectedRole: Role | null
}

export const ACTION_LABELS: Record<ActionType, string> = {
  GOL: 'Gol',
  ASS: 'Assistência',
  RB: 'Roubada de Bola',
  DS: 'Desarme',
  PE: 'Passe Errado',
  FF: 'Falta Sofrida',
  FS: 'Falta Cometida',
  FT: 'Finalização na Trave',
  I: 'Impedimento',
  GC: 'Gol Contra',
  PP: 'Pênalti Perdido',
  DEF: 'Defesa',
  SG: 'Jogo sem Sofrer Gol',
  DD: 'Defesa Difícil',
  DP: 'Defesa de Pênalti',
  GS: 'Gol Sofrido',
  CA: 'Cartão Amarelo',
  CV: 'Cartão Vermelho',
}

export const POSITION_ORDER: Position[] = ['GOL', 'LAT', 'ZAG', 'MEI', 'ATA']
