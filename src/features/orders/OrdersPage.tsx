import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePermission } from '@/lib/auth/usePermission'
import { fetchRiders } from '@/features/riders/api'
import { useShops } from '@/features/shops/api'
import {
  createOrder,
  fetchDeliveryPartners,
  fetchOrders,
  fetchTownships,
  orderKeys,
  ORDER_STATUSES,
  type OrderBody,
  type OrderDateBasis,
  type OrderFilters,
  type OrderStatus,
} from '@/features/orders/api'
import { calculateCodToCollect, calculateNetOwedToShop } from '@/features/orders/money'
import { OrderFormDialog } from '@/features/orders/OrderFormDialog'
import { OrderSelectField } from '@/features/orders/components/OrderSelectField'

const PAGE_SIZE = 20

export function OrdersPage() {
  const canCreate = usePermission('orders.create')
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [shopId, setShopId] = useState('')
  const [townshipId, setTownshipId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [dateBasis, setDateBasis] = useState<OrderDateBasis>('ENTRY')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const queryClient = useQueryClient()
  const shops = useShops({ page: 1, perPage: 100 })
  const townships = useQuery({ queryKey: orderKeys.townships, queryFn: fetchTownships })
  const riders = useQuery({ queryKey: ['operations', 'riders', 'active'], queryFn: () => fetchRiders({ page: 1, perPage: 100, status: 'ACTIVE' }) })
  const partners = useQuery({ queryKey: orderKeys.partners, queryFn: fetchDeliveryPartners })
  const filters: OrderFilters = {
    page,
    perPage: PAGE_SIZE,
    search: search.trim() || undefined,
    status: status ? status as OrderStatus : undefined,
    shopId: shopId || undefined,
    townshipId: townshipId || undefined,
    assigneeId: assigneeId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    dateBasis,
  }
  const orders = useQuery({ queryKey: orderKeys.list(filters), queryFn: () => fetchOrders(filters) })
  const createMutation = useMutation({
    mutationFn: (body: OrderBody) => createOrder(body),
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({ queryKey: orderKeys.all })
      setIsFormOpen(false)
      navigate(`/orders/${order.id}`)
    },
  })

  function resetToFirstPage(update: () => void) {
    setPage(1)
    update()
  }

  const assigneeOptions = [
    ...(riders.data?.data ?? []).map((rider) => ({ value: rider.id, label: `${rider.name} · Rider` })),
    ...(partners.data ?? []).filter((partner) => partner.isActive).map((partner) => ({ value: partner.id, label: `${partner.name} · Partner` })),
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">Search and manage order delivery, collection, and shop balances.</p>
        </div>
        {canCreate && <Button onClick={() => setIsFormOpen(true)}><Plus className="size-4" />Create order</Button>}
      </div>

      <section aria-label="Order filters" className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative flex flex-col gap-2">
          <label htmlFor="order-search" className="text-sm font-medium">Search</label>
          <Search className="absolute left-3 top-[2.55rem] size-4 text-muted-foreground" aria-hidden="true" />
          <Input id="order-search" className="pl-9" value={search} placeholder="Tracking code, name, phone, address" onChange={(event) => resetToFirstPage(() => setSearch(event.target.value))} />
        </div>
        <OrderSelectField id="order-filter-status" label="Status" value={status} options={ORDER_STATUSES.map((value) => ({ value, label: value.replaceAll('_', ' ') }))} placeholder="All statuses" onChange={(value) => resetToFirstPage(() => setStatus(value))} />
        <OrderSelectField id="order-filter-shop" label="Shop" value={shopId} options={(shops.data?.data ?? []).map((shop) => ({ value: shop.id, label: shop.name }))} placeholder="All shops" onChange={(value) => resetToFirstPage(() => setShopId(value))} />
        <OrderSelectField id="order-filter-township" label="Township" value={townshipId} options={(townships.data ?? []).map((township) => ({ value: township.id, label: township.name }))} placeholder="All townships" onChange={(value) => resetToFirstPage(() => setTownshipId(value))} />
        <OrderSelectField id="order-filter-assignee" label="Assignee" value={assigneeId} options={assigneeOptions} placeholder="All assignees" onChange={(value) => resetToFirstPage(() => setAssigneeId(value))} />
        <OrderSelectField id="order-date-basis" label="Date basis" value={dateBasis} options={[{ value: 'ENTRY', label: 'Entry date' }, { value: 'DELIVERED', label: 'Delivered date' }]} onChange={(value) => resetToFirstPage(() => setDateBasis(value as OrderDateBasis))} />
        <div className="flex flex-col gap-2">
          <label htmlFor="order-date-from" className="text-sm font-medium">From</label>
          <Input id="order-date-from" type="date" value={dateFrom} onChange={(event) => resetToFirstPage(() => setDateFrom(event.target.value))} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="order-date-to" className="text-sm font-medium">To</label>
          <Input id="order-date-to" type="date" value={dateTo} onChange={(event) => resetToFirstPage(() => setDateTo(event.target.value))} />
        </div>
      </section>

      {orders.isLoading ? (
        <div className="space-y-2" aria-label="Loading orders">
          {[0, 1, 2, 3].map((row) => <div key={row} className="h-12 animate-pulse rounded-md bg-muted" />)}
        </div>
      ) : orders.isError ? (
        <p role="alert" className="rounded-md border border-destructive p-4 text-sm text-destructive">{orders.error.message || 'Could not load orders.'}</p>
      ) : orders.data?.data.length ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Tracking</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Est. delivery</TableHead><TableHead className="text-right">COD to collect</TableHead><TableHead className="text-right">Net owed to shop (estimated)</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {orders.data.data.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell><Link className="font-mono font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/orders/${order.id}`}>{order.trackingCode}</Link></TableCell>
                    <TableCell><Badge className={order.status === 'DELIVERED' ? 'bg-success text-success-foreground' : order.status === 'AWAITING_APPROVAL' ? 'bg-warning text-warning-foreground' : ''} variant={order.status === 'CANCELLED' ? 'destructive' : 'secondary'}>{order.status.replaceAll('_', ' ')}</Badge></TableCell>
                    <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{order.estimatedDeliveryDate ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">{calculateCodToCollect(order)}</TableCell>
                    <TableCell className="text-right font-mono">{calculateNetOwedToShop(order)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{orders.data.meta.total} orders · Page {orders.data.meta.page} of {Math.max(orders.data.meta.totalPages, 1)}</span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((currentPage) => currentPage - 1)}>Previous</Button>
              <Button variant="outline" disabled={page >= orders.data.meta.totalPages} onClick={() => setPage((currentPage) => currentPage + 1)}>Next</Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState title="No orders found" description="Adjust the filters or create an order to get started." />
      )}

      {isFormOpen && <OrderFormDialog
        open={isFormOpen}
        order={null}
        pending={createMutation.isPending}
        onClose={() => setIsFormOpen(false)}
        onSave={async (body) => {
          if (!('shopId' in body) || !('customerId' in body) || !('packagePrice' in body)) throw new Error('Invalid order fields.')
          await createMutation.mutateAsync(body as OrderBody)
        }}
      />}
    </div>
  )
}
