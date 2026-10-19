import { Coins } from 'lucide-react'
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
import { userStatusLabel, userStatusTone } from '@/lib/constants/user-status'
import { isZeroMoney } from '@/lib/money'
import { toNullableString } from '@/lib/nullable'
import { badgeClass, formatDecimalAmount } from '@/lib/utils'
import type { RiderHandoverBalance } from '../api'

interface HandoverBalancesTableProps {
  balances: RiderHandoverBalance[]
  canCreate: boolean
  onRecord: (balance: RiderHandoverBalance) => void
}

/**
 * What each rider still owes: approved COD minus what they have handed back.
 *
 * A negative balance cannot happen through correct use — the officer accepts the
 * cash before recording it — so it is labelled as the company holding money,
 * which is what it would mean, and left visible rather than clamped to zero. A
 * mistake the office cannot see is a mistake it cannot fix.
 */
export function HandoverBalancesTable({
  balances,
  canCreate,
  onRecord,
}: HandoverBalancesTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rider</TableHead>
            <TableHead className="text-right">Delivered COD</TableHead>
            <TableHead className="text-right">Handed back</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Oldest unsettled delivery</TableHead>
            <TableHead>Last handover</TableHead>
            {canCreate && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {balances.map((balance) => {
            const isSettled = isZeroMoney(balance.balance)
            const isHeldByRider = balance.balance.startsWith('-')
            const oldestUnsettled = toNullableString(balance.oldestUnsettledDeliveredOn ?? null)
            const lastReceived = toNullableString(balance.lastReceivedOn ?? null)

            return (
              <TableRow key={balance.riderId}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {balance.riderName}
                    {balance.riderStatus === 'INACTIVE' && (
                      <Badge
                        variant="secondary"
                        className={badgeClass(userStatusTone(balance.riderStatus))}
                      >
                        {userStatusLabel(balance.riderStatus)}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatDecimalAmount(balance.deliveredCod)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatDecimalAmount(balance.accepted)}
                </TableCell>
                <TableCell className="text-right">
                  {isSettled ? (
                    <span className="font-mono tabular-nums text-muted-foreground">0.00</span>
                  ) : isHeldByRider ? (
                    <Badge variant="secondary" className={badgeClass('warning')}>
                      Company holds {formatDecimalAmount(balance.balance.slice(1))}
                    </Badge>
                  ) : (
                    <span className="font-mono font-medium tabular-nums">
                      {formatDecimalAmount(balance.balance)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{oldestUnsettled ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{lastReceived ?? '—'}</TableCell>
                {canCreate && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Record a handover from ${balance.riderName}`}
                      onClick={() => onRecord(balance)}
                    >
                      <Coins className="size-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
