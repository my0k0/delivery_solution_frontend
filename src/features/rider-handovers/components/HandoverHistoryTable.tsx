import { Fragment } from 'react'
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toNullableString } from '@/lib/nullable'
import { badgeClass, formatDate, formatDecimalAmount } from '@/lib/utils'
import type { RiderHandover } from '../api'
import { handoverMethodLabel } from '../handover-methods'
import { HandoverAuditTrail } from './HandoverAuditTrail'

interface HandoverHistoryTableProps {
  handovers: RiderHandover[]
  canUpdate: boolean
  expandedId: string | null
  onToggleHistory: (id: string) => void
  onCorrect: (handover: RiderHandover) => void
}

/**
 * Every handover the office has accepted, newest first.
 *
 * "Modified" is read from `updatedAt` moving off `createdAt`: the API rewrites
 * every field it is sent, so an untouched row is the only one whose two stamps
 * match, and there is no separate flag to trust.
 */
export function HandoverHistoryTable({
  handovers,
  canUpdate,
  expandedId,
  onToggleHistory,
  onCorrect,
}: HandoverHistoryTableProps) {
  const columnCount = canUpdate ? 7 : 6

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rider</TableHead>
            <TableHead>Received on</TableHead>
            <TableHead>Received by</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Note</TableHead>
            <TableHead>Recorded</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {handovers.map((handover) => {
            const isExpanded = expandedId === handover.id
            const isModified = handover.updatedAt !== handover.createdAt
            const note = toNullableString(handover.note ?? null)
            const recordedByName = toNullableString(handover.recordedByName ?? null)

            return (
              <Fragment key={handover.id}>
                <TableRow>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {handover.riderName}
                      {isModified && (
                        <Badge variant="secondary" className={badgeClass('warning')}>
                          Modified
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{handover.receivedOn}</TableCell>
                  <TableCell>{handoverMethodLabel(handover.method)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatDecimalAmount(handover.amount)}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate text-muted-foreground" title={note ?? undefined}>
                    {note ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(handover.createdAt)}
                    <span className="block text-xs">{recordedByName ?? '—'}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Hide' : 'Show'} the correction history of the handover from ${handover.riderName}`}
                        onClick={() => onToggleHistory(handover.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </Button>
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Correct the handover from ${handover.riderName}`}
                          onClick={() => onCorrect(handover)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="bg-muted/40">
                      <HandoverAuditTrail handoverId={handover.id} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
