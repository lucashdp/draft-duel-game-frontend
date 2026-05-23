'use client'

import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { socketEmit } from '@/lib/socket'
import { WsClientEvent, type WsErrorCode } from '@/lib/contracts/ws'

/**
 * Max time (ms) we wait for the server's ack before giving up. Spec calls for
 * `< 2s` propagation, so 5s leaves room for slow networks without leaving the
 * user with a forever-spinning ConfirmPickDialog.
 */
const ACK_TIMEOUT_MS = 5000

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

const ackSchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  }),
])

function emitPick(roomId: string, input: MakePickInput): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new PickError('UNKNOWN', 'Tempo limite ao aguardar resposta do servidor.'))
    }, ACK_TIMEOUT_MS)

    socketEmit<{ roomId: string; pickNumber: number; athleteId: string }>(
      WsClientEvent.DRAFT_PICK,
      { roomId, ...input },
      (resp) => {
        clearTimeout(timer)
        const parsed = ackSchema.safeParse(resp)
        if (!parsed.success) {
          reject(new PickError('UNKNOWN', 'Resposta do servidor em formato inválido.'))
          return
        }
        if ('error' in parsed.data) {
          reject(new PickError(parsed.data.error.code as WsErrorCode, parsed.data.error.message))
          return
        }
        resolve()
      },
    )
  })
}

export function useMakePick(roomId: string) {
  return useMutation<void, PickError, MakePickInput>({
    mutationFn: (input) => emitPick(roomId, input),
  })
}
