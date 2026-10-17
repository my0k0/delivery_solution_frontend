import type { components } from '@/types/api'
import { maximumMoney, moneyRatioPercent } from '@/lib/money'

type DailyOrderStatus = components['schemas']['OrdersPerDayStatusDto']
type FinancialDay = components['schemas']['FinancialDayDto']
type TopShop = components['schemas']['TopShopDto']
type TownshipRate = components['schemas']['TownshipSuccessRateDto']

const ORDER_STATUS_SERIES = [
  { status: 'PENDING', label: 'Pending', color: 'var(--chart-5)' },
  { status: 'ASSIGNED', label: 'Assigned', color: 'var(--chart-3)' },
  { status: 'AWAITING_APPROVAL', label: 'Awaiting approval', color: 'var(--warning)' },
  { status: 'DELIVERED', label: 'Delivered', color: 'var(--success)' },
  { status: 'CANCELLED', label: 'Cancelled', color: 'var(--destructive)' },
] as const

const FINANCIAL_SERIES = [
  { key: 'feeIncome', label: 'Fee income', color: 'var(--chart-1)' },
  { key: 'partnerCost', label: 'Partner cost', color: 'var(--chart-3)' },
  { key: 'commissionEarned', label: 'Commission', color: 'var(--chart-5)' },
] as const

function ChartFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border bg-card p-4" aria-label={title}>
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function ChartLegend({ items }: { items: readonly { label: string; color: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Chart legend">
      {items.map((item) => (
        <li className="flex items-center gap-2" key={item.label}>
          <span aria-hidden="true" className="size-2.5 rounded-sm border border-foreground/20" style={{ backgroundColor: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function ChartEmpty({ description }: { description: string }) {
  return <p className="flex min-h-40 items-center justify-center rounded-md border border-dashed px-4 text-center text-sm text-muted-foreground">{description}</p>
}

function AxisDateLabel({ date }: { date: string }) {
  const [, month, day] = date.split('-')
  return <>{month}/{day}</>
}

export function OrdersPerDayChart({ data }: { data: DailyOrderStatus[] }) {
  const dates = [...new Set(data.map((item) => item.date))].sort()
  if (!dates.length) return <ChartFrame title="Orders per day by status"><ChartEmpty description="No orders in this date range." /></ChartFrame>

  const width = 720
  const height = 270
  const plotLeft = 44
  const plotTop = 16
  const plotWidth = width - plotLeft - 12
  const plotHeight = 190
  const bottom = plotTop + plotHeight
  const countsForDate = dates.map((date) => data.filter((item) => item.date === date).reduce((total, item) => total + item.orderCount, 0))
  const maximumCount = Math.max(1, ...countsForDate)
  const groupWidth = plotWidth / dates.length
  const barWidth = Math.max(1, groupWidth * 0.58)
  const dateStep = Math.max(1, Math.ceil(dates.length / 8))

  return (
    <ChartFrame title="Orders per day by status">
      <div className="min-w-0" role="img" aria-label={`Stacked bar chart showing order counts by status across ${dates.length} dates. Exact values are listed below.`}>
        <svg className="block h-auto w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {[0, 25, 50, 75, 100].map((percentage) => {
            const y = bottom - plotHeight * percentage / 100
            const label = Math.round(maximumCount * percentage / 100)
            return <g key={percentage}><line x1={plotLeft} x2={width - 12} y1={y} y2={y} stroke="var(--border)" strokeDasharray={percentage === 0 ? undefined : '3 4'} /><text x={plotLeft - 8} y={y + 4} textAnchor="end" fill="var(--muted-foreground)" fontSize="11">{label}</text></g>
          })}
          {dates.map((date, dateIndex) => {
            let nextY = bottom
            const dateOrders = data.filter((item) => item.date === date)
            const x = plotLeft + dateIndex * groupWidth + (groupWidth - barWidth) / 2
            const orderedSegments = ORDER_STATUS_SERIES.map((series) => ({
              ...series,
              count: dateOrders.find((item) => item.status === series.status)?.orderCount ?? 0,
            }))
            return <g key={date}>
              {orderedSegments.map((segment) => {
                if (segment.count === 0) return null
                const barHeight = plotHeight * segment.count / maximumCount
                nextY -= barHeight
                return <g key={segment.status}><rect x={x} y={nextY} width={barWidth} height={barHeight} fill={segment.color} stroke="var(--card)" strokeWidth="1"><title>{`${date}: ${segment.label}, ${segment.count} orders`}</title></rect></g>
              })}
              {dateIndex % dateStep === 0 && <text x={x + barWidth / 2} y={bottom + 18} textAnchor="middle" fill="var(--muted-foreground)" fontSize="10"><AxisDateLabel date={date} /></text>}
            </g>
          })}
          <text x="12" y={plotTop + plotHeight / 2} textAnchor="middle" fill="var(--muted-foreground)" fontSize="10" transform={`rotate(-90 12 ${plotTop + plotHeight / 2})`}>Orders</text>
        </svg>
      </div>
      <ChartLegend items={ORDER_STATUS_SERIES} />
      <table className="sr-only">
        <caption>Daily order counts by status</caption>
        <thead><tr><th scope="col">Date</th>{ORDER_STATUS_SERIES.map((series) => <th scope="col" key={series.status}>{series.label}</th>)}</tr></thead>
        <tbody>{dates.map((date) => <tr key={date}><th scope="row">{date}</th>{ORDER_STATUS_SERIES.map((series) => <td key={series.status}>{data.find((item) => item.date === date && item.status === series.status)?.orderCount ?? 0}</td>)}</tr>)}</tbody>
      </table>
    </ChartFrame>
  )
}

export function FinancialComparisonChart({ data }: { data: FinancialDay[] }) {
  if (!data.length) return <ChartFrame title="Fee income vs partner cost vs commission"><ChartEmpty description="No approved-delivery finances in this date range." /></ChartFrame>
  const width = 720
  const height = 270
  const plotLeft = 50
  const plotTop = 16
  const plotWidth = width - plotLeft - 12
  const plotHeight = 190
  const bottom = plotTop + plotHeight
  const allValues = data.flatMap((day) => FINANCIAL_SERIES.map((series) => day[series.key]))
  const maximumValue = maximumMoney(allValues)
  const groupWidth = plotWidth / data.length
  const barWidth = Math.max(1, Math.min(16, groupWidth * 0.18))
  const dateStep = Math.max(1, Math.ceil(data.length / 8))

  return (
    <ChartFrame title="Fee income vs partner cost vs commission">
      <div className="min-w-0" role="img" aria-label="Grouped bar chart comparing daily fee income, partner cost, and commission. The vertical axis is percentage of the highest amount in the selected range. Exact amounts are listed below.">
        <svg className="block h-auto w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {[0, 25, 50, 75, 100].map((percentage) => {
            const y = bottom - plotHeight * percentage / 100
            return <g key={percentage}><line x1={plotLeft} x2={width - 12} y1={y} y2={y} stroke="var(--border)" strokeDasharray={percentage === 0 ? undefined : '3 4'} /><text x={plotLeft - 8} y={y + 4} textAnchor="end" fill="var(--muted-foreground)" fontSize="11">{percentage}%</text></g>
          })}
          {data.map((day, dayIndex) => {
            const totalBarWidth = barWidth * FINANCIAL_SERIES.length
            const startX = plotLeft + dayIndex * groupWidth + (groupWidth - totalBarWidth) / 2
            return <g key={day.date}>
              {FINANCIAL_SERIES.map((series, seriesIndex) => {
                const amount = day[series.key]
                const barHeight = plotHeight * moneyRatioPercent(amount, maximumValue) / 100
                const x = startX + seriesIndex * barWidth
                return <rect key={series.key} x={x} y={bottom - barHeight} width={barWidth - 1} height={barHeight} fill={series.color} stroke="var(--card)" strokeWidth="1"><title>{`${day.date}: ${series.label}, ${amount} MMK`}</title></rect>
              })}
              {dayIndex % dateStep === 0 && <text x={plotLeft + dayIndex * groupWidth + groupWidth / 2} y={bottom + 18} textAnchor="middle" fill="var(--muted-foreground)" fontSize="10"><AxisDateLabel date={day.date} /></text>}
            </g>
          })}
          <text x="13" y={plotTop + plotHeight / 2} textAnchor="middle" fill="var(--muted-foreground)" fontSize="10" transform={`rotate(-90 13 ${plotTop + plotHeight / 2})`}>Relative amount</text>
        </svg>
      </div>
      <ChartLegend items={FINANCIAL_SERIES} />
      <table className="sr-only">
        <caption>Daily delivery finances, in MMK</caption>
        <thead><tr><th scope="col">Date</th>{FINANCIAL_SERIES.map((series) => <th scope="col" key={series.key}>{series.label}</th>)}</tr></thead>
        <tbody>{data.map((day) => <tr key={day.date}><th scope="row">{day.date}</th>{FINANCIAL_SERIES.map((series) => <td key={series.key}>{day[series.key]} MMK</td>)}</tr>)}</tbody>
      </table>
    </ChartFrame>
  )
}

export function TopShopsChart({ data }: { data: TopShop[] }) {
  const maximumCount = Math.max(0, ...data.map((shop) => shop.orderCount))
  return <ChartFrame title="Top shops by order count">
    {data.length ? <ol className="flex flex-col gap-3" aria-label="Shop ranking by number of orders">
      {data.map((shop, index) => <li key={shop.shopId} className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-sm">
        <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
        <div className="min-w-0">
          <div className="mb-1 flex min-w-0 justify-between gap-2"><span className="truncate">{shop.shopName}</span><span className="font-mono tabular-nums">{shop.orderCount}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${shop.shopName} orders`} aria-valuemin={0} aria-valuemax={maximumCount} aria-valuenow={shop.orderCount}><div className="h-full rounded-full bg-chart-1" style={{ width: `${maximumCount === 0 ? 0 : shop.orderCount * 100 / maximumCount}%` }} /></div>
        </div><span className="sr-only">orders</span>
      </li>)}
    </ol> : <ChartEmpty description="No shops have orders in this date range." />}
  </ChartFrame>
}

export function TownshipSuccessChart({ data }: { data: TownshipRate[] }) {
  return <ChartFrame title="Township delivery outcomes">
    {data.length ? <ul className="flex flex-col gap-3">
      {data.map((township) => <li key={township.townshipId} className="min-w-0">
        <div className="mb-1 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
          <span className="truncate font-medium">{township.townshipName}</span><span className="font-mono tabular-nums">{township.successRate}% success</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${township.townshipName} success rate`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(township.successRate)}><div className="h-full rounded-full bg-success" style={{ width: `${township.successRate}%` }} /></div>
        <p className="mt-1 text-xs text-muted-foreground">{township.deliveredCount} delivered · {township.cancelledCount} cancelled</p>
      </li>)}
    </ul> : <ChartEmpty description="No completed order outcomes in this date range." />}
  </ChartFrame>
}
