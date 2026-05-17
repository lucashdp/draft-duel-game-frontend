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
} as const
export type WsErrorCode = (typeof WsErrorCode)[keyof typeof WsErrorCode]

export interface RoomGuestJoinedPayload {
  guest: { id: string; nickname: string }
  status: string  // wire format: 'waiting' | 'drafting' | 'live' | 'finished'
}

export interface RoomAbandonedPayload {
  by: 'host' | 'guest'
  winner: 'host' | 'guest' | null
}

export interface WsErrorPayload {
  code: WsErrorCode
  message: string
}
