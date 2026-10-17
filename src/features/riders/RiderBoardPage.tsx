import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getApiErrorMessage } from '@/lib/api/client'
import { usePermission } from '@/lib/auth/usePermission'
import { fetchRiderBoard, orderKeys, submitRiderDelivered, type RiderBoardOrder } from '@/features/orders/api'

function groupOrdersByWay(orders: RiderBoardOrder[]): Array<[string, RiderBoardOrder[]]> {
  const groupedOrders = new Map<string, RiderBoardOrder[]>()
  for (const order of orders) {
    const wayLabel = order.wayLabel ?? 'No way assigned'
    const existingOrders = groupedOrders.get(wayLabel) ?? []
    groupedOrders.set(wayLabel, [...existingOrders, order])
  }
  return Array.from(groupedOrders.entries())
}

export function RiderBoardPage() {
  const canSubmitDelivery = usePermission('deliveries.update')
  const queryClient = useQueryClient()
  const board = useQuery({ queryKey: orderKeys.riderBoard, queryFn: fetchRiderBoard })
  const ordersByWay = groupOrdersByWay(board.data ?? [])
  const submitMutation = useMutation({
    mutationFn: submitRiderDelivered,
    onSuccess: async () => {
      toast.success('Delivery submitted for office approval')
      await queryClient.invalidateQueries({ queryKey: orderKeys.riderBoard })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const isBoardEndpointMissing = isAxiosError(board.error) && board.error.response?.status === 404

  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="text-xl font-semibold tracking-tight">My deliveries</h1><p className="text-sm text-muted-foreground">Orders assigned to you. Submit completed deliveries for office approval.</p></div>
      {board.isLoading ? <div className="space-y-2" aria-label="Loading assigned orders">{[0, 1, 2].map((row) => <div key={row} className="h-14 animate-pulse rounded-md bg-muted" />)}</div> : board.isError ? <p role="alert" className="rounded-md border border-destructive p-4 text-sm text-destructive">{isBoardEndpointMissing ? 'The current API does not expose the rider assigned-orders endpoint yet.' : getApiErrorMessage(board.error)}</p> : board.data?.length ? <div className="flex flex-col gap-5">
        {ordersByWay.map(([wayLabel, wayOrders]) => <section key={wayLabel} className="flex flex-col gap-2" aria-label={`Orders for way ${wayLabel}`}>
          <h2 className="text-base font-semibold">{wayLabel}</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table><TableHeader><TableRow><TableHead>Tracking</TableHead><TableHead>Customer</TableHead><TableHead>Delivery address</TableHead><TableHead>Township</TableHead><TableHead className="text-right">COD to collect</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>
              {(wayOrders ?? []).map((order) => <TableRow key={order.id}><TableCell className="font-mono font-medium">{order.trackingCode}</TableCell><TableCell><div>{order.customerName}</div>{order.customerPhone && <div className="text-xs text-muted-foreground">{order.customerPhone}</div>}</TableCell><TableCell className="max-w-80 truncate">{order.customerAddress ?? '—'}</TableCell><TableCell>{order.townshipName ?? '—'}</TableCell><TableCell className="text-right font-mono">{order.codToCollect}</TableCell><TableCell className="text-right">{canSubmitDelivery && order.status === 'ASSIGNED' ? <Button size="sm" className="min-h-10" disabled={submitMutation.isPending} onClick={() => submitMutation.mutate(order.id)}>Submit delivered</Button> : <Badge variant="secondary">{order.status.replaceAll('_', ' ')}</Badge>}</TableCell></TableRow>)}
            </TableBody></Table>
          </div>
        </section>)}
      </div> : <EmptyState title="No assigned orders" description="Orders assigned to you will appear here." />}
      <p className="text-xs text-muted-foreground">There is no fail or reject action. Submitted deliveries wait for office approval.</p>
    </div>
  )
}
