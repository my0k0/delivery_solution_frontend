import { useState } from 'react'
import { toast } from 'sonner'
import { downloadShopFile, useShopStatement, type ShopDateQuery } from './api'
import { getTodayDate } from '@/features/reports/date-range'
import { usePermission } from '@/lib/auth/gate'
import { getApiErrorMessage } from '@/lib/api/client'
import { formatMmk } from '@/lib/money'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const STATEMENT_COUNTS = [
  { key: 'receivedCount', label: 'Received' },
  { key: 'outForDeliveryCount', label: 'Out for delivery' },
  { key: 'deliveredCount', label: 'Delivered' },
  { key: 'returnedCount', label: 'Returned' },
  { key: 'cancelledCount', label: 'Cancelled' },
] as const

export function ShopStatementPage() {
  const today = getTodayDate()
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [dateBasis, setDateBasis] = useState<'ENTRY' | 'DELIVERED'>('ENTRY')
  const [isExporting, setIsExporting] = useState(false)
  const canExport = usePermission('shop-reports.export')
  const query: ShopDateQuery = { dateFrom, dateTo, dateBasis }
  const isDateRangeValid = Boolean(dateFrom && dateTo && dateFrom <= dateTo)
  const statement = useShopStatement(query)

  async function exportStatement(format: 'csv' | 'xlsx') {
    setIsExporting(true)
    try {
      await downloadShopFile('/shop/statement/export', { ...query, format })
      toast.success(`${format.toUpperCase()} statement downloaded`)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not export the statement'))
    } finally {
      setIsExporting(false)
    }
  }

  return <div className="flex min-w-0 flex-col gap-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight">Statement</h1><p className="text-sm text-muted-foreground">Order totals and settlement for your shop.</p></div>
      {canExport && <div className="flex gap-2"><button type="button" disabled={isExporting || !isDateRangeValid} onClick={() => void exportStatement('csv')} className="min-h-10 rounded-md border px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">Export CSV</button><button type="button" disabled={isExporting || !isDateRangeValid} onClick={() => void exportStatement('xlsx')} className="min-h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Export XLSX</button></div>}
    </div>
    <section aria-label="Statement date filters" className="grid min-w-0 gap-3 rounded-lg border bg-card p-3 sm:grid-cols-3">
      <DateField label="From" htmlFor="statement-date-from" value={dateFrom} onChange={setDateFrom} />
      <DateField label="To" htmlFor="statement-date-to" value={dateTo} onChange={setDateTo} />
      <div className="flex min-w-0 flex-col gap-1"><label htmlFor="statement-date-basis" className="text-xs font-medium">Date basis</label><select id="statement-date-basis" value={dateBasis} onChange={(event) => setDateBasis(event.target.value as 'ENTRY' | 'DELIVERED')} className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"><option value="ENTRY">Entry date</option><option value="DELIVERED">Delivered date</option></select></div>
    </section>
    {!isDateRangeValid ? <p role="alert" className="text-sm text-destructive">The start date must not be after the end date.</p> : statement.isLoading ? <div aria-label="Loading statement" className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}</div> : statement.isError ? <EmptyState title="Could not load your statement" description={getApiErrorMessage(statement.error)} /> : statement.data ? <>
      <p className="text-sm text-muted-foreground">{statement.data.shopName} · {statement.data.dateFrom} to {statement.data.dateTo} · {statement.data.dateBasis === 'DELIVERED' ? 'Delivered date' : 'Entry date'}</p>
      <section aria-label="Order counts by status" className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{STATEMENT_COUNTS.map(({ key, label }) => <Card size="sm" key={key}><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><p className="font-mono text-2xl font-semibold tabular-nums">{statement.data[key]}</p></CardContent></Card>)}</section>
      <section aria-label="Statement totals" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MoneyCard title="Package price" amount={statement.data.priceTotal} /><MoneyCard title="Delivery fees" amount={statement.data.feeTotal} /><MoneyCard title="COD collected" amount={statement.data.codCollected} /><MoneyCard title="COD expected" amount={statement.data.codExpected} /><MoneyCard title="Net settlement · delivered" amount={statement.data.netOwedToShopDelivered} /><MoneyCard title="Net settlement · pending" amount={statement.data.pendingNetOwedToShop} /><MoneyCard title="Net settlement · total" amount={statement.data.netOwedToShopTotal} />
      </section>
      <p className="text-xs text-muted-foreground">A positive net settlement means the company owes your shop; a negative amount means your shop owes the company.</p>
    </> : null}
  </div>
}

function DateField({ label, htmlFor, value, onChange }: { label: string; htmlFor: string; value: string; onChange: (value: string) => void }) {
  return <div className="flex min-w-0 flex-col gap-1"><label htmlFor={htmlFor} className="text-xs font-medium">{label}</label><input id={htmlFor} type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring" /></div>
}

function MoneyCard({ title, amount }: { title: string; amount: string }) {
  return <Card size="sm" className="min-w-0"><CardHeader className="pb-2"><CardTitle className="text-xs leading-5 text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><p className="break-words font-mono text-lg font-semibold tabular-nums">{formatMmk(amount)}</p></CardContent></Card>
}
