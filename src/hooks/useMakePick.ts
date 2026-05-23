'use client'

import { useMutation } from '@tanstack/react-query'
import { socketEmit } from '@/lib/socket'
import { WsClientEvent } from '@/lib/contracts/ws'
import type { WsErrorCode } from '@/lib/contracts/ws'

export class PickError extends Error {
  constructor(public readonly code: WsErrorCode | 'UNKNOWN', message: string) {
    super(message)
    this.name = 'PickError'
  }
}

export interface MakePickInput {
  pickNumber: number
  athleteId: string
}

interface AckOk { ok: true }
interface AckErr { error: { code: WsErrorCode; message: string } }
type Ack = AckOk | AckErr

function isErr(a: Ack): a is AckErr {
  return (a as AckErr).error !== undefined
}

export function useMakePick(roomId: string) {
  return useMutation<void, PickError, MakePickInput>({
    mutationFn: ({ pickNumber, athleteId }) =>
      new Promise<void>((resolve, reject) => {
        socketEmit<{ roomId: string; pickNumber: number; athleteId: string }>(
          WsClientEvent.DRAFT_PICK,
          { roomId, pickNumber, athleteId },
          (resp) => {
            const ack = resp as Ack
            if (isErr(ack)) {
              reject(new PickError(ack.error.code, ack.error.message))
            } else {
              resolve()
            }
          },
        )
      }),
  })
}
