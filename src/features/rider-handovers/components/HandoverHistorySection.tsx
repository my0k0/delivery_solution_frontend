import { useEffect, useMemo, useState } from 'react'
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
import type { HandoverPageFilterValues } from '../handover-filters'
import { HandoverHistoryTable } from './HandoverHistoryTable'
import { HandoverHistoryToolbar } from './HandoverHistoryToolbar'

type HistoryValues = Pick<
  HandoverPageFilterValues,
  'page' | 'riderId' | 'method' | 'dateFrom' | 'dateTo'
>

interface HistoryDraft {
  riderId: string
  method: HandoverMethod | ''
  dateFrom: string
  dateTo: string
}

interface HandoverHistorySectionProps {
  canUpdate: boolean
  onCorrect: (handover: RiderHandover) => void
  /** Committed filters, owned by the page and stored in the URL. */
  values: HistoryValues
  onChange: (
    patch: Partial<HandoverPageFilterValues>,
    options?: { keepPage?: boolean },
  ) => void
}

/** The "what has been recorded" half of the page. */
export function HandoverHistorySection({
  canUpdate,
  onCorrect,
  values,
  onChange,
}: HandoverHistorySectionProps) {
  const [draft, setDraft] = useState<HistoryDraft | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // `null` draft means "no edits yet", so the toolbar follows the URL — after
  // Back, or after a sidebar link restored a remembered view.
  const shown: HistoryDraft = draft ?? {
    riderId: values.riderId,
    method: values.method,
    dateFrom: values.dateFrom,
    dateTo: values.dateTo,
  }

  const filters: HandoverFilters = {
    page: values.page,
    perPage: PAGE_SIZE,
    riderId: values.riderId || undefined,
    method: values.method || undefined,
    dateFrom: values.dateFrom || undefined,
    dateTo: values.dateTo || undefined,
  }

  const riders = useRiders({ page: 1, perPage: RIDER_LIST_MAX_PER_PAGE })
  const { data, isLoading, isError, error } = useRiderHandovers(filters)

  // Same guard as the balances table: a remembered `?page=5` against 2 pages of
  // history would otherwise render an empty list with no pagination and, with no
  // filters set, no Reset either — a dead end reachable only by editing the URL.
  const totalPages = data?.meta.totalPages
  useEffect(() => {
    if (totalPages === undefined) return
    const lastPage = Math.max(totalPages, 1)
    if (values.page > lastPage) onChange({ page: lastPage }, { keepPage: true })
  }, [totalPages, values.page, onChange])

  const riderOptions = useMemo(
    () => (riders.data?.data ?? []).map((rider) => ({ value: rider.id, label: rider.name })),
    [riders.data],
  )

  const hasFilters = !!(values.riderId || values.method || values.dateFrom || values.dateTo)
  // Apply is enabled only when the local draft differs from the committed filters.
  const hasPendingChanges =
    shown.riderId !== values.riderId ||
    shown.method !== values.method ||
    shown.dateFrom !== values.dateFrom ||
    shown.dateTo !== values.dateTo

  function applyFilters() {
    // A new result set collapses whatever row was open, so a stale trail cannot
    // sit under a row that happens to reuse the id on the next page.
    setExpandedId(null)
    setDraft(null)
    onChange({
      page: 1,
      riderId: shown.riderId,
      method: shown.method,
      dateFrom: shown.dateFrom,
      dateTo: shown.dateTo,
    })
  }

  function resetFilters() {
    setExpandedId(null)
    setDraft(null)
    onChange({ page: 1, riderId: '', method: '', dateFrom: '', dateTo: '' })
  }

  function goToPage(page: number) {
    setExpandedId(null)
    onChange({ page }, { keepPage: true })
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
        riderIdInput={shown.riderId || undefined}
        methodInput={shown.method || undefined}
        dateFromInput={shown.dateFrom}
        dateToInput={shown.dateTo}
        riderOptions={riderOptions}
        hasFilters={hasFilters}
        hasPendingChanges={hasPendingChanges}
        onRiderChange={(riderId) => setDraft({ ...shown, riderId: riderId ?? '' })}
        onMethodChange={(method) => setDraft({ ...shown, method: method ?? '' })}
        onDateFromChange={(dateFrom) => setDraft({ ...shown, dateFrom })}
        onDateToChange={(dateTo) => setDraft({ ...shown, dateTo })}
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
              <PaginationPrevious
                onClick={() => {
                  if (values.page > 1) goToPage(values.page - 1)
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm text-muted-foreground">
                Page {values.page} of {data.meta.totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => {
                  if (values.page < data.meta.totalPages) goToPage(values.page + 1)
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </section>
  )
}
