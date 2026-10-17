import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { EmptyState } from '@/components/EmptyState'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fetchRiders, ridersKeys } from '@/features/riders/api'
import { StartWayDialog } from '@/features/ways/StartWayDialog'
import { WayStateBadge } from '@/features/ways/WayStateBadge'
import { createWay, fetchWays, wayKeys, type WayState } from '@/features/ways/api'
import { getApiErrorMessage } from '@/lib/api/client'

const WAY_STATES: Array<{ value: WayState | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All states' },
  { value: 'EMPTY', label: 'Empty' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'EARNED', label: 'Earned' },
  { value: 'PAID_ANYWAY', label: 'Paid anyway' },
]

export function WaysPage() {
  const [riderId, setRiderId] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [state, setState] = useState<WayState | 'ALL'>('ALL')
  const filters = {
    riderId: riderId === 'ALL' ? undefined : riderId,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    state: state === 'ALL' ? undefined : state,
  }
  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo)
  const ways = useQuery({ queryKey: wayKeys.list(filters), queryFn: () => fetchWays(filters), enabled: !hasInvalidDateRange })
  const riders = useQuery({
    queryKey: ridersKeys.list({ page: 1, perPage: 100 }),
    queryFn: () => fetchRiders({ page: 1, perPage: 100 }),
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Ways</h1>
          <p className="text-sm text-muted-foreground">Rider routes and per-way commission status.</p>
        </div>
        <StartWayDialog onSave={async (body) => { await createWay(body) }} />
      </div>

      <section aria-label="Filter ways" className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ways-rider-filter">Rider</Label>
          <Select value={riderId} onValueChange={(value) => value && setRiderId(value)}>
            <SelectTrigger id="ways-rider-filter" className="min-h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All riders</SelectItem>
              {(riders.data?.data ?? []).map((rider) => <SelectItem key={rider.id} value={rider.id}>{rider.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ways-date-from">Date from</Label>
          <Input id="ways-date-from" type="date" className="min-h-10" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ways-date-to">Date to</Label>
          <Input id="ways-date-to" type="date" className="min-h-10" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ways-state-filter">State</Label>
          <Select value={state} onValueChange={(value) => {
            if (value === 'ALL' || WAY_STATES.some((wayState) => wayState.value === value)) setState(value as WayState | 'ALL')
          }}>
            <SelectTrigger id="ways-state-filter" className="min-h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{WAY_STATES.map((wayState) => <SelectItem key={wayState.value} value={wayState.value}>{wayState.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </section>

      {hasInvalidDateRange && <p role="alert" className="text-sm text-destructive">The start date must be on or before the end date.</p>}
      {ways.isLoading ? <div className="h-48 animate-pulse rounded-lg border border-border bg-muted" aria-label="Loading ways" />
        : ways.isError ? <EmptyState title="Could not load ways" description={getApiErrorMessage(ways.error)} />
          : !ways.data?.length ? <EmptyState title="No ways found" description="Try changing the filters, or start a new way for a rider." />
            : <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>Rider</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Orders</TableHead><TableHead>State</TableHead><TableHead className="text-right">Commission</TableHead><TableHead className="text-right">Pending</TableHead></TableRow></TableHeader>
                <TableBody>
                  {ways.data.map((way) => <TableRow key={way.id}>
                    <TableCell><Link to={`/ways/${way.id}`} className="font-medium underline-offset-4 hover:underline">{way.riderName}</Link></TableCell>
                    <TableCell className="whitespace-nowrap">{way.wayDate} · {way.sequence}</TableCell>
                    <TableCell className="text-right font-mono">{way.orderCount}</TableCell>
                    <TableCell><div className="flex flex-wrap items-center gap-2"><WayStateBadge state={way.state} />{way.isOpen && <span className="text-xs text-muted-foreground">Open</span>}</div></TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono">{way.commissionAmount} MMK</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono">{way.pendingAmount} MMK</TableCell>
                  </TableRow>)}
                </TableBody>
              </Table>
            </div>}
    </div>
  )
}
