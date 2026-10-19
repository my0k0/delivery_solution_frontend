import { Skeleton } from '@/components/ui/skeleton'
import { readApiError } from '@/lib/api/client'
import { toNullableString } from '@/lib/nullable'
import { formatDateTime } from '@/lib/utils'
import { useRiderHandoverAudit } from '../api'
import { handoverAuditValue, handoverFieldLabel } from '../audit-fields'

interface HandoverAuditTrailProps {
  handoverId: string
}

/**
 * One handover's correction history, oldest first — the same chronological order
 * as the order audit trail, so a trail reads downward through time and the latest
 * change is the last line rather than the first. Each line carries the moment it
 * was written, to the minute, because two corrections of the same handover on the
 * same day are otherwise indistinguishable.
 *
 * Mounted only for the row that is expanded, which is what keeps the query off
 * for the rows nobody asked about — hence a plain id rather than a nullable one
 * to guard.
 */
export function HandoverAuditTrail({ handoverId }: HandoverAuditTrailProps) {
  const { data, isLoading, isError, error } = useRiderHandoverAudit(handoverId)

  if (isLoading) {
    return <Skeleton className="h-12 w-full" />
  }

  if (isError) {
    return (
      <p className="text-xs text-destructive">
        {readApiError(error).message ?? 'Could not load this handover’s history.'}
      </p>
    )
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No corrections — this handover reads as it was recorded.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2 text-xs">
      {data.map((entry) => {
        const reason = toNullableString(entry.reason ?? null)
        const actorName = toNullableString(entry.actorName ?? null)
        return (
          <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{handoverFieldLabel(entry.field)}</span>
            <span className="text-muted-foreground">
              {handoverAuditValue(entry.field, entry.oldValue)} →{' '}
              {handoverAuditValue(entry.field, entry.newValue)}
            </span>
            {reason && <span>· {reason}</span>}
            <span className="text-muted-foreground">
              · {actorName ?? 'Unknown'} · {formatDateTime(entry.createdAt)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
