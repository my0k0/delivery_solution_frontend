import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { readApiError } from '@/lib/api/client'
import { PAGE_SIZE } from '@/lib/constants'
import { RIDER_LIST_MAX_PER_PAGE, useRiders } from '@/features/riders/api'
import {
  useRiderHandovers,
  type HandoverFilters,
  type RiderHandover,
} from '../api'
import type { HandoverMethod } from '../handover-methods'
import { HandoverHistoryTable } from './HandoverHistoryTable'
import { HandoverHistoryToolbar } from './HandoverHistoryToolbar'

interface HandoverHistorySectionProps {
  canUpdate: boolean
  onCorrect: (handover: RiderHandover) => void
}

/** The "what has been recorded" half of the page. */
export function HandoverHistorySection({ canUpdate, onCorrect }: HandoverHistorySectionProps) {
  const [riderIdInput, setRiderIdInput] = useState<string>()
  const [methodInput, setMethodInput] = useState<HandoverMethod>()
  const [dateFromInput, setDateFromInput] = useState('')
  const [dateToInput, setDateToInput] = useState('')
  const [filters, setFilters] = useState<HandoverFilters>({ page: 1, perPage: PAGE_SIZE })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const riders = useRiders({ page: 1, perPage: RIDER_LIST_MAX_PER_PAGE })
  const { data, isLoading, isError, error } = useRiderHandovers(filters)

  const riderOptions = useMemo(
    () => (riders.data?.data ?? []).map((rider) => ({ value: rider.id, label: rider.name })),
    [riders.data],
  )

  const hasFilters = !!(filters.riderId || filters.method || filters.dateFrom || filters.dateTo)
  // Apply is enabled only when the local draft differs from the committed filters.
  const hasPendingChanges =
    (riderIdInput || undefined) !== filters.riderId ||
    (methodInput || undefined) !== filters.method ||
    (dateFromInput || undefined) !== filters.dateFrom ||
    (dateToInput || undefined) !== filters.dateTo

  function applyFilters() {
    // A new result set collapses whatever row was open, so a stale trail cannot
    // sit under a row that happens to reuse the id on the next page.
    setExpandedId(null)
    setFilters({
      page: 1,
      perPage: PAGE_SIZE,
      riderId: riderIdInput || undefined,
      method: methodInput || undefined,
      dateFrom: dateFromInput || undefined,
      dateTo: dateToInput || undefined,
    })
  }

  function resetFilters() {
    setRiderIdInput(undefined)
    setMethodInput(undefined)
    setDateFromInput('')
    setDateToInput('')
    setExpandedId(null)
    setFilters({ page: 1, perPage: PAGE_SIZE })
  }

  function goToPage(page: number) {
    setExpandedId(null)
    setFilters((previous) => ({ ...previous, page }))
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="handover-history-heading">
      <div>
        <h2 id="handover-history-heading" className="text-base font-semibold tracking-tight">
          Handover history
        </h2>
        <p className="text-sm text-muted-foreground">
          Cash the office has accepted. Corrections keep the row and record what changed.
        </p>
      </div>

      <HandoverHistoryToolbar
        riderIdInput={riderIdInput}
        methodInput={methodInput}
        dateFromInput={dateFromInput}
        dateToInput={dateToInput}
        riderOptions={riderOptions}
        hasFilters={hasFilters}
        hasPendingChanges={hasPendingChanges}
        onRiderChange={setRiderIdInput}
        onMethodChange={setMethodInput}
        onDateFromChange={setDateFromInput}
        onDateToChange={setDateToInput}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Could not load handover history"
          description={readApiError(error).message ?? 'Unexpected error'}
        />
      ) : data && data.data.length === 0 ? (
        <EmptyState
          title="No handovers recorded"
          description={
            hasFilters
              ? // Any of the four filters can be the one that emptied the list, so
                // the advice names both ways out rather than blaming the dates.
                'No handovers match your filters. Try widening the dates or removing a filter.'
              : 'Record one from the balances above when a rider hands cash back.'
          }
        />
      ) : (
        <HandoverHistoryTable
          handovers={data?.data ?? []}
          canUpdate={canUpdate}
          expandedId={expandedId}
          onToggleHistory={(id) => setExpandedId((current) => (current === id ? null : id))}
          onCorrect={onCorrect}
        />
      )}

      {data && data.meta.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => goToPage(filters.page - 1)} />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm text-muted-foreground">
                Page {filters.page} of {data.meta.totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext onClick={() => goToPage(filters.page + 1)} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </section>
  )
}
