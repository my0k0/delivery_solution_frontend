import { useState } from 'react'
import { usePermission } from '@/lib/auth/usePermission'
import type { RiderHandover, RiderHandoverBalance } from './api'
import { HandoverBalancesSection } from './components/HandoverBalancesSection'
import { HandoverDialog } from './components/HandoverDialog'
import { HandoverHistorySection } from './components/HandoverHistorySection'

/**
 * Rider handovers: what each rider still owes, and every handover the office has
 * accepted.
 *
 * The balances half is riders-driven, so a rider with nothing delivered appears
 * with a zero balance rather than being absent — the officer reads the same list
 * before and after the first delivery, and does not have to wonder whether a
 * missing name means "settled" or "not found".
 *
 * Recording starts from a rider's row, not from a page-level button: the amount
 * is checked against that rider's outstanding amount, and a dialog that opened
 * without a rider would have nothing to check it against.
 */
export function RiderHandoversPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [handoverToCorrect, setHandoverToCorrect] = useState<RiderHandover>()
  const [sourceRow, setSourceRow] = useState<RiderHandoverBalance>()
  const canCreate = usePermission('rider-handovers.create')
  const canUpdate = usePermission('rider-handovers.update')

  function openRecordDialog(balance: RiderHandoverBalance) {
    setHandoverToCorrect(undefined)
    setSourceRow(balance)
    setIsDialogOpen(true)
  }

  function openCorrectDialog(handover: RiderHandover) {
    setHandoverToCorrect(handover)
    setSourceRow(undefined)
    setIsDialogOpen(true)
  }

  function closeDialog() {
    setIsDialogOpen(false)
    setHandoverToCorrect(undefined)
    setSourceRow(undefined)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Rider handovers</h1>
        <p className="text-sm text-muted-foreground">
          Cash a rider has handed back, and what each rider still owes. Record one from the rider’s
          row below — that row is the outstanding amount it settles against.
        </p>
      </div>

      <HandoverBalancesSection canCreate={canCreate} onRecord={openRecordDialog} />

      <HandoverHistorySection canUpdate={canUpdate} onCorrect={openCorrectDialog} />

      <HandoverDialog
        open={isDialogOpen}
        handover={handoverToCorrect}
        sourceRow={sourceRow}
        onClose={closeDialog}
      />
    </div>
  )
}
