'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { buildInviteUrl } from '@/constants/rooms'

interface Props {
  code: string
}

export function InviteLinkCard({ code }: Props) {
  const [url] = useState(() => buildInviteUrl(code))

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">
        Compartilhe este link
      </label>
      <div className="flex gap-2">
        <Input value={url} readOnly className="font-mono text-sm" />
        <Button type="button" onClick={handleCopy} variant="secondary">
          Copiar
        </Button>
      </div>
    </div>
  )
}
