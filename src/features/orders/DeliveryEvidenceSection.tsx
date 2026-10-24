import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/lib/api/client';
import { badgeClass } from '@/lib/utils';
import { fetchDeliveryProofs, orderKeys, type AssigneeType, type OrderStatus } from '@/features/orders/api';
import { DeliveryProofThumbnail } from '@/features/orders/DeliveryProofThumbnail';

interface DeliveryEvidenceSectionProps {
  orderId: string;
  trackingCode: string;
  /**
   * The badge cannot come from `approvedAt` alone: an order sitting in the
   * approval queue has an unaccepted capture that nobody rejected, and a
   * cancelled order has one with no resubmission coming. Only the order's own
   * status says which of those the officer is looking at.
   */
  status: OrderStatus;
  /** A partner delivery never carries a photo, so its empty state must not promise one. */
  assigneeType: AssigneeType | null;
}

/**
 * The photo a rider captured at handover, and whether an officer accepted it.
 *
 * `approvedAt` is the only thing that makes a capture evidence: a submission
 * that was sent back keeps its row, so a screen that trusted "the newest photo"
 * would show a rejected picture as proof of delivery.
 */
interface EvidenceBadge {
  label: string;
  /** `undefined` keeps the neutral secondary badge — nothing is wrong, it is just not reviewed. */
  className: string | undefined;
}

/**
 * An unaccepted capture means three different things depending on the order, so
 * the label is derived from both facts rather than from `approvedAt` alone.
 */
function describeCapture(hasAcceptedCapture: boolean, status: OrderStatus): EvidenceBadge {
  if (hasAcceptedCapture) return { label: 'Accepted evidence', className: badgeClass('positive') };
  if (status === 'AWAITING_APPROVAL') return { label: 'Awaiting review', className: undefined };
  if (status === 'ASSIGNED') {
    return { label: 'Not accepted — a resubmission is pending', className: badgeClass('warning') };
  }
  return { label: 'Not accepted', className: badgeClass('warning') };
}

export function DeliveryEvidenceSection({ orderId, trackingCode, status, assigneeType }: DeliveryEvidenceSectionProps) {
  const queryClient = useQueryClient();
  const proofsQuery = useQuery({
    queryKey: orderKeys.proofs(orderId),
    queryFn: () => fetchDeliveryProofs(orderId),
  });

  const proofs = proofsQuery.data ?? [];
  // At most one row is ever accepted, and it is the newest rider delivery; the
  // rest are captures from submissions that were sent back.
  const evidence = proofs.find((proof) => proof.approvedAt !== null) ?? null;
  const latest = evidence ?? proofs[0] ?? null;
  const earlier = latest ? proofs.filter((proof) => proof.id !== latest.id) : [];
  const capture = describeCapture(Boolean(latest?.approvedAt), status);
  const isNotDeliveredYet = status === 'PENDING' || status === 'ASSIGNED';
  const emptyDetail = assigneeType === 'PARTNER'
    ? 'Partner deliveries are marked delivered by the office, so they never carry a rider photo.'
    : isNotDeliveredYet
      ? 'The rider attaches one when submitting the delivery.'
      : 'Orders delivered before photo evidence was required have no photo.';

  function refreshEvidence() {
    void queryClient.invalidateQueries({ queryKey: orderKeys.proofs(orderId) });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" aria-label="Delivery evidence">
      <div>
        <h2 className="text-base font-semibold">Delivery evidence</h2>
        <p className="text-sm text-muted-foreground">
          The photo the rider captured when this order was handed over. A photo counts as evidence only once an
          officer approves the delivery.
        </p>
      </div>

      {proofsQuery.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : proofsQuery.isError ? (
        <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">
          {getApiErrorMessage(proofsQuery.error, 'Could not load the delivery photo.')}
        </p>
      ) : !latest ? (
        <div>
          <p className="text-sm font-medium">
            {isNotDeliveredYet ? 'No photo yet.' : 'No photo was captured for this order.'}
          </p>
          <p className="text-sm text-muted-foreground">{emptyDetail}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className={capture.className}>{capture.label}</Badge>
            <a href={latest.url} target="_blank" rel="noreferrer" className="text-sm font-medium underline underline-offset-4">
              View full size
            </a>
          </div>

          <DeliveryProofThumbnail
            key={latest.url}
            proof={latest}
            alt={`Delivery photo captured for ${trackingCode}`}
            onRetry={refreshEvidence}
          />

          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Captured at</dt><dd className="mt-1">{new Date(latest.capturedAt).toLocaleString()}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Captured by</dt><dd className="mt-1">{latest.uploadedByName}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Approved at</dt><dd className="mt-1">{latest.approvedAt ? new Date(latest.approvedAt).toLocaleString() : '—'}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Approved by</dt><dd className="mt-1">{latest.approvedByName ?? '—'}</dd></div>
          </dl>

          {earlier.length > 0 && (
            <details className="rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Earlier submissions ({earlier.length})</summary>
              <div className="mt-3 flex flex-col gap-4">
                {earlier.map((proof) => (
                  <div key={proof.id} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {proof.approvedAt ? (
                        <Badge variant="secondary" className={badgeClass('positive')}>Accepted evidence</Badge>
                      ) : (
                        <Badge variant="secondary" className={badgeClass('warning')}>Not accepted</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Captured {new Date(proof.capturedAt).toLocaleString()} by {proof.uploadedByName}
                      </span>
                    </div>
                    <DeliveryProofThumbnail
                      key={proof.url}
                      proof={proof}
                      alt={`Earlier delivery photo captured for ${trackingCode}`}
                      onRetry={refreshEvidence}
                    />
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}
