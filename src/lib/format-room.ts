import { RoomErrorCode, RoomStatus, type RoomStatus as RoomStatusType } from '@/lib/contracts/rooms'
import { ApiError } from '@/lib/api'

const ROOM_STATUS_LABEL: Record<RoomStatusType, string> = {
  [RoomStatus.WAITING]: 'Aguardando',
  [RoomStatus.DRAFTING]: 'Em draft',
  [RoomStatus.LIVE]: 'Ao vivo',
  [RoomStatus.FINISHED]: 'Finalizada',
}

export function formatRoomStatus(status: RoomStatusType): string {
  return ROOM_STATUS_LABEL[status]
}

const JOIN_ERROR_MESSAGE: Record<string, string> = {
  [RoomErrorCode.IS_HOST]: 'Você é o anfitrião dessa sala.',
  [RoomErrorCode.ROOM_NOT_OPEN]: 'Essa sala já está em andamento.',
  [RoomErrorCode.ROOM_EXPIRED]: 'Esse link já expirou.',
  [RoomErrorCode.ROOM_NOT_FOUND]: 'Sala não encontrada.',
  [RoomErrorCode.MATCH_INELIGIBLE]: 'Essa partida não está mais disponível pra entrar.',
  [RoomErrorCode.RACE_LOST]: 'Outro jogador entrou primeiro. Essa sala agora está cheia.',
}

const JOIN_ERROR_FALLBACK = 'Não foi possível entrar na sala. Tente novamente.'
const JOIN_ERROR_UNAUTHORIZED = 'Sua sessão expirou. Faça login novamente.'

export function formatJoinError(err: unknown): string {
  if (!(err instanceof ApiError)) return JOIN_ERROR_FALLBACK
  if (err.status === 401) return JOIN_ERROR_UNAUTHORIZED
  return (err.code && JOIN_ERROR_MESSAGE[err.code]) ?? JOIN_ERROR_FALLBACK
}
