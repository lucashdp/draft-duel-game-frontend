'use client'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { AthleteRefDto } from '@/lib/contracts/draft'

interface Props {
  athlete: AthleteRefDto | null
  teamName: string
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

export function ConfirmPickDialog({ athlete, teamName, onConfirm, onCancel, isPending }: Props) {
  const open = athlete !== null
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar pick</DialogTitle>
          <DialogDescription>
            {athlete && (
              <>
                Draftar <strong>{athlete.name}</strong> ({athlete.position}, {teamName})?
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} onClick={onCancel} />}>
            Cancelar
          </DialogClose>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Draftando…
              </>
            ) : (
              'Confirmar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
