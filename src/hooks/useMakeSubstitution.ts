'use client'

import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { socketEmit } from '@/lib/socket'
import { WsClientEvent, type WsErrorCode } from '@/lib/contracts/ws'

/**
 * Max time (ms) we wait for the server's ack before giving up. Mirrors the
 * draft-pick ack timeout — 5s leaves room for slow networks without leaving
 * the user staring at a frozen ConfirmSubDialog.
 */
const ACK_TIMEOUT_MS = 5000

export class SubstitutionError extends Error {
  constructor(public readonly code: WsErrorCode | 'UNKNOWN', message: string) {
    super(message)
    this.name = 'SubstitutionError'
  }
}

export interface MakeSubstitutionInput {
  removeAthleteId: string
  addAthleteId: string
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

function emitSubstitution(roomId: string, input: MakeSubstitutionInput): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new SubstitutionError('UNKNOWN', 'Tempo limite ao aguardar resposta do servidor.'),
      )
    }, ACK_TIMEOUT_MS)

    socketEmit<{ roomId: string; removeAthleteId: string; addAthleteId: string }>(
      WsClientEvent.MATCH_SUBSTITUTE,
      { roomId, ...input },
      (resp) => {
        clearTimeout(timer)
        const parsed = ackSchema.safeParse(resp)
        if (!parsed.success) {
          reject(
            new SubstitutionError('UNKNOWN', 'Resposta do servidor em formato inválido.'),
          )
          return
        }
        if ('error' in parsed.data) {
          reject(
            new SubstitutionError(
              parsed.data.error.code as WsErrorCode,
              parsed.data.error.message,
            ),
          )
          return
        }
        resolve()
      },
    )
  })
}

export function useMakeSubstitution(roomId: string) {
  return useMutation<void, SubstitutionError, MakeSubstitutionInput>({
    mutationFn: (input) => emitSubstitution(roomId, input),
  })
}
