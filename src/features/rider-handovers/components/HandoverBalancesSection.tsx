import { useState } from 'react'
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
import { HandoverBalancesTable } from './HandoverBalancesTable'
import { HandoverBalancesToolbar } from './HandoverBalancesToolbar'

interface HandoverBalancesSectionProps {
  canCreate: boolean
  onRecord: (balance: RiderHandoverBalance) => void
}

/** The "what does each rider still owe" half of the page. */
export function HandoverBalancesSection({ canCreate, onRecord }: HandoverBalancesSectionProps) {
  const [searchInput, setSearchInput] = useState('')
  const [outstandingOnlyInput, setOutstandingOnlyInput] = useState(false)
  const [filters, setFilters] = useState<HandoverBalanceFilters>({ page: 1, perPage: PAGE_SIZE })

  const { data, isLoading, isError, error } = useRiderHandoverBalances(filters)

  const hasFilters = !!(filters.search || filters.outstandingOnly)
  // Apply is enabled only when the local draft differs from the committed filters.
  const hasPendingChanges =
    (searchInput || undefined) !== filters.search ||
    (outstandingOnlyInput || undefined) !== filters.outstandingOnly

  function applyFilters() {
    setFilters({
      page: 1,
      perPage: PAGE_SIZE,
      search: searchInput || undefined,
      outstandingOnly: outstandingOnlyInput || undefined,
    })
  }

  function resetFilters() {
    setSearchInput('')
    setOutstandingOnlyInput(false)
    setFilters({ page: 1, perPage: PAGE_SIZE })
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
        searchInput={searchInput}
        outstandingOnlyInput={outstandingOnlyInput}
        hasFilters={hasFilters}
        hasPendingChanges={hasPendingChanges}
        onSearchInputChange={setSearchInput}
        onOutstandingOnlyChange={setOutstandingOnlyInput}
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
            filters.search
              ? 'No riders match your filters. Try widening the search.'
              : filters.outstandingOnly
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
              <PaginationPrevious onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))} />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm text-muted-foreground">
                Page {filters.page} of {data.meta.totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </section>
  )
}
