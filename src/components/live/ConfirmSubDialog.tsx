'use client'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface AthleteLike {
  id: string
  shortName: string
  position: string
}

interface ConfirmSubDialogProps {
  open: boolean
  removedAthlete: AthleteLike
  addedAthlete: AthleteLike
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

export function ConfirmSubDialog({
  open,
  removedAthlete,
  addedAthlete,
  onConfirm,
  onCancel,
  loading,
}: ConfirmSubDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar substituição</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          Tirar <strong>{removedAthlete.shortName}</strong> ({removedAthlete.position}) e
          colocar <strong>{addedAthlete.shortName}</strong> ({addedAthlete.position})?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? 'Confirmando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
