import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { DeliveryProof } from '@/features/orders/api';

interface DeliveryProofThumbnailProps {
  proof: DeliveryProof;
  alt: string;
  /** Refetch the proofs so a fresh signed URL is minted. */
  onRetry: () => void;
}

/**
 * One stored photo, with the one failure it can actually have: the signed URL
 * it was rendered from lived five minutes and this screen has outlived it.
 *
 * That is expected rather than an error, so it says what happened and offers
 * the action that fixes it — a bare broken-image icon leaves the officer
 * unable to tell "expired" from "no photo" from "the bucket is down".
 *
 * Callers should key this on `proof.url`: a refetch replaces the URL, and the
 * remount is what lets a previously failed image try again.
 */
export function DeliveryProofThumbnail({ proof, alt, onRetry }: DeliveryProofThumbnailProps) {
  const [hasFailed, setHasFailed] = useState(false);

  if (hasFailed) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border p-4">
        <p className="text-sm text-muted-foreground">This image link expired. Refresh the order to view it again.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>Refresh photo</Button>
      </div>
    );
  }

  return (
    <img
      src={proof.url}
      alt={alt}
      // `self-start` stops a flex column from stretching the image to full
      // width, which would leave letterboxed gutters inside a bordered box and
      // read as a layout bug rather than a photo.
      className="max-h-80 w-auto max-w-full self-start rounded-md border border-border object-contain"
      onError={() => setHasFailed(true)}
    />
  );
}
