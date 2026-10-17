import { Badge } from '@/components/ui/badge'
import type { WayState } from '@/features/ways/api'

const WAY_STATE_LABELS: Record<WayState, string> = {
  EMPTY: 'Empty',
  PENDING_APPROVAL: 'Pending approval',
  EARNED: 'Earned',
  PAID_ANYWAY: 'Paid anyway',
}

interface WayStateBadgeProps {
  state: WayState
}

export function WayStateBadge({ state }: WayStateBadgeProps) {
  const className = state === 'EARNED'
    ? 'bg-success text-success-foreground'
    : state === 'PENDING_APPROVAL'
      ? 'bg-warning text-warning-foreground'
      : ''

  return <Badge className={className} variant={state === 'PAID_ANYWAY' ? 'outline' : 'secondary'}>{WAY_STATE_LABELS[state]}</Badge>
}
