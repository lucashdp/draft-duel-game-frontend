import { RoomStatus, type RoomStatus as RoomStatusType } from '@/lib/contracts/rooms'

const ROOM_STATUS_LABEL: Record<RoomStatusType, string> = {
  [RoomStatus.WAITING]: 'Aguardando',
  [RoomStatus.DRAFTING]: 'Em draft',
  [RoomStatus.LIVE]: 'Ao vivo',
  [RoomStatus.FINISHED]: 'Finalizada',
}

export function formatRoomStatus(status: RoomStatusType): string {
  return ROOM_STATUS_LABEL[status]
}
