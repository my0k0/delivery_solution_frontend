import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePermission } from '@/lib/auth/usePermission'
import { useUrlFilters } from '@/lib/url/useUrlFilters'
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
  type OrderFilters,
  type ShopAdvanceFilter,
} from '@/features/orders/api'
import {
  ORDERS_FILTER_SCHEMA,
  ORDER_DATE_BASES,
  PACKAGE_PAYMENT_FILTERS,
  SHOP_ADVANCE_FILTERS,
  toOrderDateBasis,
  toOrderStatus,
  toPackagePayment,
  toShopAdvance,
} from '@/features/orders/order-filters'
import { calculateCodToCollect } from '@/features/orders/money'
import { OrderFormDialog } from '@/features/orders/OrderFormDialog'
import { OrderSelectField } from '@/features/orders/components/OrderSelectField'
import { ShopSettlementBadge } from '@/features/orders/components/ShopSettlementBadge'

const PAGE_SIZE = 20

/** Labels for the tuples the URL schema owns — the values are never re-spelled here. */
const SHOP_ADVANCE_LABELS: Record<ShopAdvanceFilter, string> = {
  NOT_ADVANCED: 'Advance still due',
  ADVANCED: 'Advanced',
}

const SHOP_ADVANCE_FILTER_OPTIONS = SHOP_ADVANCE_FILTERS.map((value) => ({
  value,
  label: SHOP_ADVANCE_LABELS[value],
}))

const PACKAGE_PAYMENT_LABELS: Record<(typeof PACKAGE_PAYMENT_FILTERS)[number], string> = {
  false: 'Customer did not pay the shop',
  true: 'Customer paid the shop',
}

const PACKAGE_PAYMENT_FILTER_OPTIONS = PACKAGE_PAYMENT_FILTERS.map((value) => ({
  value,
  label: PACKAGE_PAYMENT_LABELS[value],
}))

const DATE_BASIS_OPTIONS = ORDER_DATE_BASES.map((basis) => ({
  value: basis,
  label: basis === 'ENTRY' ? 'Entry date' : 'Delivered date',
}))

/**
 * Orders list. Every filter — including the page and the date range — lives in
 * the URL, so opening an order and coming back restores the same view, the same
 * page, and a warm React Query entry instead of a cold list.
 */
export function OrdersPage() {
  const canCreate = usePermission('orders.create')
  const navigate = useNavigate()
  const { filters: values, update, reset, hasActiveFilters } = useUrlFilters(ORDERS_FILTER_SCHEMA)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const queryClient = useQueryClient()
  const shops = useShops({ page: 1, perPage: 100 })
  const townships = useQuery({ queryKey: orderKeys.townships, queryFn: fetchTownships })
  const riders = useQuery({ queryKey: ['operations', 'riders', 'active'], queryFn: () => fetchRiders({ page: 1, perPage: 100, status: 'ACTIVE' }) })
  const partners = useQuery({ queryKey: orderKeys.partners, queryFn: fetchDeliveryPartners })
  const filters: OrderFilters = {
    page: values.page,
    perPage: PAGE_SIZE,
    search: values.search.trim() || undefined,
    status: values.status || undefined,
    shopId: values.shopId || undefined,
    townshipId: values.townshipId || undefined,
    assigneeId: values.assigneeId || undefined,
    shopAdvance: values.shopAdvance || undefined,
    isPackagePaidToShop: values.isPackagePaidToShop === '' ? undefined : values.isPackagePaidToShop === 'true',
    dateFrom: values.dateFrom || undefined,
    dateTo: values.dateTo || undefined,
    dateBasis: values.dateBasis,
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

  // A remembered page can outlive the rows that filled it — someone cancels
  // orders while you are away, and page 7 of 3 comes back empty. Fall back to
  // the last real page instead of showing "No orders found".
  const totalPages = orders.data?.meta.totalPages
  useEffect(() => {
    if (totalPages === undefined) return
    if (values.page > Math.max(totalPages, 1)) {
      update({ page: Math.max(totalPages, 1) }, { keepPage: true })
    }
  }, [totalPages, values.page, update])

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

      <section aria-label="Order filters" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Filters</h2>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={reset}>Reset filters</Button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="relative flex flex-col gap-2">
            <label htmlFor="order-search" className="text-sm font-medium">Search</label>
            <Search className="absolute left-3 top-[2.55rem] size-4 text-muted-foreground" aria-hidden="true" />
            <Input id="order-search" className="pl-9" value={values.search} placeholder="Tracking code, name, phone, address" onChange={(event) => update({ search: event.target.value })} />
          </div>
          <OrderSelectField id="order-filter-status" label="Status" value={values.status} options={ORDER_STATUSES.map((value) => ({ value, label: value.replaceAll('_', ' ') }))} placeholder="All statuses" onChange={(value) => update({ status: toOrderStatus(value) })} />
          <OrderSelectField id="order-filter-shop" label="Shop" value={values.shopId} options={(shops.data?.data ?? []).map((shop) => ({ value: shop.id, label: shop.name }))} placeholder="All shops" onChange={(value) => update({ shopId: value })} />
          <OrderSelectField id="order-filter-township" label="Township" value={values.townshipId} options={(townships.data ?? []).map((township) => ({ value: township.id, label: township.name }))} placeholder="All townships" onChange={(value) => update({ townshipId: value })} />
          <OrderSelectField id="order-filter-assignee" label="Assignee" value={values.assigneeId} options={assigneeOptions} placeholder="All assignees" onChange={(value) => update({ assigneeId: value })} />
          <OrderSelectField id="order-filter-shop-advance" label="Shop advance" value={values.shopAdvance} options={SHOP_ADVANCE_FILTER_OPTIONS} placeholder="Any advance state" onChange={(value) => update({ shopAdvance: toShopAdvance(value) })} />
          <OrderSelectField id="order-filter-package-payment" label="Package payment" value={values.isPackagePaidToShop} options={PACKAGE_PAYMENT_FILTER_OPTIONS} placeholder="Any package payment" onChange={(value) => update({ isPackagePaidToShop: toPackagePayment(value) })} />
          <OrderSelectField id="order-date-basis" label="Date basis" value={values.dateBasis} options={DATE_BASIS_OPTIONS} onChange={(value) => update({ dateBasis: toOrderDateBasis(value) })} />
          <div className="flex flex-col gap-2">
            <label htmlFor="order-date-from" className="text-sm font-medium">From</label>
            <Input id="order-date-from" type="date" value={values.dateFrom} onChange={(event) => update({ dateFrom: event.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="order-date-to" className="text-sm font-medium">To</label>
            <Input id="order-date-to" type="date" value={values.dateTo} onChange={(event) => update({ dateTo: event.target.value })} />
          </div>
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
                <TableHead>Tracking</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Est. delivery</TableHead><TableHead className="text-right">COD to collect</TableHead><TableHead title="Whether the company has paid the shop for this order's package, derived from the order's recorded fields rather than from a payment record.">Shop settlement</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {orders.data.data.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell><Link className="font-mono font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/orders/${order.id}`}>{order.trackingCode}</Link></TableCell>
                    <TableCell><Badge className={order.status === 'DELIVERED' ? 'bg-success text-success-foreground' : order.status === 'AWAITING_APPROVAL' ? 'bg-warning text-warning-foreground' : ''} variant={order.status === 'CANCELLED' ? 'destructive' : 'secondary'}>{order.status.replaceAll('_', ' ')}</Badge></TableCell>
                    <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{order.estimatedDeliveryDate ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">{calculateCodToCollect(order)}</TableCell>
                    <TableCell><ShopSettlementBadge order={order} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{orders.data.meta.total} orders · Page {orders.data.meta.page} of {Math.max(orders.data.meta.totalPages, 1)}</span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={values.page <= 1} onClick={() => update({ page: values.page - 1 }, { keepPage: true })}>Previous</Button>
              <Button variant="outline" disabled={values.page >= orders.data.meta.totalPages} onClick={() => update({ page: values.page + 1 }, { keepPage: true })}>Next</Button>
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
