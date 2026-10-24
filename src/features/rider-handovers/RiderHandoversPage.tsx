import { useState } from 'react'
import { usePermission } from '@/lib/auth/usePermission'
import { useUrlFilters } from '@/lib/url/useUrlFilters'
import type { RiderHandover, RiderHandoverBalance } from './api'
import { HANDOVER_FILTER_SCHEMA } from './handover-filters'
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
  // One owner of the URL for both sections: two independent filter stores would
  // each rewrite the whole query string and delete the other's params.
  const { filters, update } = useUrlFilters(HANDOVER_FILTER_SCHEMA)

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

      <HandoverBalancesSection
        canCreate={canCreate}
        onRecord={openRecordDialog}
        values={{
          balancePage: filters.balancePage,
          balanceSearch: filters.balanceSearch,
          outstandingOnly: filters.outstandingOnly,
        }}
        onChange={update}
      />

      <HandoverHistorySection
        canUpdate={canUpdate}
        onCorrect={openCorrectDialog}
        values={{
          page: filters.page,
          riderId: filters.riderId,
          method: filters.method,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        }}
        onChange={update}
      />

      <HandoverDialog
        open={isDialogOpen}
        handover={handoverToCorrect}
        sourceRow={sourceRow}
        onClose={closeDialog}
      />
    </div>
  )
}
