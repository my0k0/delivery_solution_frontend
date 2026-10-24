import { useEffect, useState } from 'react'
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
import {
  useRiderHandoverBalances,
  type HandoverBalanceFilters,
  type RiderHandoverBalance,
} from '../api'
import type { HandoverPageFilterValues } from '../handover-filters'
import { HandoverBalancesTable } from './HandoverBalancesTable'
import { HandoverBalancesToolbar } from './HandoverBalancesToolbar'

type BalanceValues = Pick<
  HandoverPageFilterValues,
  'balancePage' | 'balanceSearch' | 'outstandingOnly'
>

interface BalancesDraft {
  search: string
  outstandingOnly: boolean
}

interface HandoverBalancesSectionProps {
  canCreate: boolean
  onRecord: (balance: RiderHandoverBalance) => void
  /** Committed filters, owned by the page and stored in the URL. */
  values: BalanceValues
  onChange: (
    patch: Partial<HandoverPageFilterValues>,
    options?: { keepPage?: boolean },
  ) => void
}

/**
 * The "what does each rider still owe" half of the page.
 *
 * Filters commit on Apply, so the draft below is local until then; `null` means
 * "no edits yet", which keeps the toolbar showing whatever the URL says even
 * after Back or a remembered link changed it.
 */
export function HandoverBalancesSection({
  canCreate,
  onRecord,
  values,
  onChange,
}: HandoverBalancesSectionProps) {
  const [draft, setDraft] = useState<BalancesDraft | null>(null)

  const shown: BalancesDraft = draft ?? {
    search: values.balanceSearch,
    outstandingOnly: values.outstandingOnly,
  }

  const filters: HandoverBalanceFilters = {
    page: values.balancePage,
    perPage: PAGE_SIZE,
    search: values.balanceSearch || undefined,
    outstandingOnly: values.outstandingOnly || undefined,
  }

  const { data, isLoading, isError, error } = useRiderHandoverBalances(filters)

  // A remembered or pasted page can outlive its rows: recording a handover can
  // settle the last rider on page 2, and the pagination then disappears with the
  // list showing an empty page. Fall back to the last real page.
  const totalPages = data?.meta.totalPages
  useEffect(() => {
    if (totalPages === undefined) return
    const lastPage = Math.max(totalPages, 1)
    if (values.balancePage > lastPage) onChange({ balancePage: lastPage }, { keepPage: true })
  }, [totalPages, values.balancePage, onChange])

  const hasFilters = !!(values.balanceSearch || values.outstandingOnly)
  // Apply is enabled only when the draft differs from the committed filters.
  const hasPendingChanges =
    shown.search !== values.balanceSearch || shown.outstandingOnly !== values.outstandingOnly

  function applyFilters() {
    setDraft(null)
    // `keepPage` preserves the *history* table's page; this section's own page
    // is set explicitly. Without it, searching the balances would silently send
    // the officer back to page 1 of the history table.
    onChange(
      { balancePage: 1, balanceSearch: shown.search, outstandingOnly: shown.outstandingOnly },
      { keepPage: true },
    )
  }

  function resetFilters() {
    setDraft(null)
    onChange(
      { balancePage: 1, balanceSearch: '', outstandingOnly: false },
      { keepPage: true },
    )
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="handover-balances-heading">
      <div>
        <h2 id="handover-balances-heading" className="text-base font-semibold tracking-tight">
          Outstanding balances
        </h2>
        <p className="text-sm text-muted-foreground">
          Approved deliveries minus the cash each rider has handed back. An order that is waiting
          for approval counts towards none of this until the office approves it.
        </p>
      </div>

      <HandoverBalancesToolbar
        searchInput={shown.search}
        outstandingOnlyInput={shown.outstandingOnly}
        hasFilters={hasFilters}
        hasPendingChanges={hasPendingChanges}
        onSearchInputChange={(search) => setDraft({ ...shown, search })}
        onOutstandingOnlyChange={(outstandingOnly) => setDraft({ ...shown, outstandingOnly })}
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
          title="Could not load rider balances"
          description={readApiError(error).message ?? 'Unexpected error'}
        />
      ) : data && data.data.length === 0 ? (
        <EmptyState
          title="No rider balances to show"
          description={
            values.balanceSearch
              ? 'No riders match your filters. Try widening the search.'
              : values.outstandingOnly
                ? 'No rider owes anything right now.'
                : 'Riders appear here once one is added.'
          }
        />
      ) : (
        <HandoverBalancesTable
          balances={data?.data ?? []}
          canCreate={canCreate}
          onRecord={onRecord}
        />
      )}

      {data && data.meta.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => {
                  if (values.balancePage > 1) {
                    onChange({ balancePage: values.balancePage - 1 }, { keepPage: true })
                  }
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm text-muted-foreground">
                Page {values.balancePage} of {data.meta.totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => {
                  if (values.balancePage < data.meta.totalPages) {
                    onChange({ balancePage: values.balancePage + 1 }, { keepPage: true })
                  }
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </section>
  )
}
