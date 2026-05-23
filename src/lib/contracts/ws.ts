export const WsClientEvent = {
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  DRAFT_PICK: 'draft:pick',
  MATCH_SUBSTITUTE: 'match:substitute',
} as const
export type WsClientEvent = (typeof WsClientEvent)[keyof typeof WsClientEvent]

export const WsServerEvent = {
  ROOM_STATE: 'room:state',
  ROOM_GUEST_JOINED: 'room:guest_joined',
  ROOM_ABANDONED: 'room:abandoned',
  DRAFT_PICK_MADE: 'draft:pick_made',
  DRAFT_CURRENT_PICK: 'draft:current_pick',
  MATCH_STARTED: 'match:started',
  MATCH_EVENT: 'match:event',
  MATCH_SCORE_UPDATED: 'match:score_updated',
  MATCH_SUBSTITUTION_APPLIED: 'match:substitution_applied',
  MATCH_FINISHED: 'match:finished',
  ERROR: 'error',
} as const
export type WsServerEvent = (typeof WsServerEvent)[keyof typeof WsServerEvent]

export const WsErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_MEMBER: 'NOT_MEMBER',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  VALIDATION: 'VALIDATION',
  INTERNAL: 'INTERNAL',
  // Draft
  NOT_DRAFTING: 'NOT_DRAFTING',
  INVALID_PICK_NUMBER: 'INVALID_PICK_NUMBER',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  LINEUP_NOT_READY: 'LINEUP_NOT_READY',
  ATHLETE_NOT_IN_LINEUP: 'ATHLETE_NOT_IN_LINEUP',
  ATHLETE_ALREADY_PICKED: 'ATHLETE_ALREADY_PICKED',
  POSITION_ALREADY_FILLED: 'POSITION_ALREADY_FILLED',
  PICK_RACE_LOST: 'PICK_RACE_LOST',
} as const
export type WsErrorCode = (typeof WsErrorCode)[keyof typeof WsErrorCode]

import type { Role, RoomStatus, RoomWinner } from '@/lib/contracts/rooms'

export interface RoomGuestJoinedPayload {
  guest: { id: string; nickname: string }
  status: RoomStatus
}

// `winner` covers all wire values from the snapshot: host/guest on regular
// abandon, 'draw' if both abandon, 'abandoned' when the expiration cron fires.
export interface RoomAbandonedPayload {
  by: Role
  winner: RoomWinner | null
}

export interface WsErrorPayload {
  code: WsErrorCode
  message: string
}

export type {
  DraftPickMadePayload,
  DraftCurrentPickPayload,
  MatchStartedPayload,
} from '@/lib/contracts/draft'
