import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/lib/api/client';
import { cn } from 'cn';
import { orderKeys, submitRiderDelivered, type RiderBoardOrder, type RiderDelivered } from '@/features/orders/api';
import { downscaleImageForUpload } from '@/features/riders/downscale-image';

interface SubmitDeliveryDialogProps {
  order: RiderBoardOrder | null;
  onClose: () => void;
}

interface SubmitDeliveryVariables {
  orderId: string;
  photo: File;
}

/**
 * The photo is the whole point of this dialog: it is captured at handover, so
 * it is the answer to a customer who later says the parcel never arrived. That
 * is why the submit button stays disabled until one is chosen, and why the copy
 * says so rather than leaving the rider to infer it.
 *
 * Follows `SendBackOrderDialog`'s inline-input shape — this feature predates the
 * strict Dialog/Form split and does not use it.
 */
export function SubmitDeliveryDialog({ order, onClose }: SubmitDeliveryDialogProps) {
  const queryClient = useQueryClient();
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // One object URL per chosen file, revoked when the file changes or the dialog
  // goes away — otherwise every re-pick leaks a blob for the page's lifetime.
  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(photo);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);

  const submitMutation = useMutation<RiderDelivered, unknown, SubmitDeliveryVariables>({
    mutationFn: async (variables) => {
      // Downscale before upload: it strips EXIF/GPS, makes the orientation
      // upright, and keeps a 12 MP phone photo well under the API's size limit.
      const file = await downscaleImageForUpload(variables.photo);
      return submitRiderDelivered(variables.orderId, file);
    },
    onSuccess: async () => {
      toast.success('Delivery submitted for office approval');
      await queryClient.invalidateQueries({ queryKey: orderKeys.riderBoard });
      // Not `handleClose`: `isPending` is still true inside `onSuccess`, and the
      // guard below would keep a finished dialog open forever.
      closeDialog();
    },
    onError: (error) => setMessage(getApiErrorMessage(error, 'Could not submit this delivery.')),
  });

  function closeDialog() {
    setPhoto(null);
    setMessage('');
    onClose();
  }

  function handleClose() {
    // Closing mid-upload would leave the mutation to fail (or succeed) against a
    // dialog that is no longer showing; its error would sit unseen and then
    // reappear on the next order. The upload is short, so hold the dialog open.
    if (submitMutation.isPending) return;
    closeDialog();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    // Clear the input so re-picking the same file still fires a change event.
    event.target.value = '';
    if (!file) return;
    setMessage('');
    setPhoto(file);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order || !photo) return;
    submitMutation.mutate({ orderId: order.id, photo });
  }

  return (
    <Dialog open={order !== null} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent>
        <form className="flex min-h-0 flex-col gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Submit delivery</DialogTitle>
            <DialogDescription>
              {order?.trackingCode} goes to the office for approval. Attach a photo of the parcel at the door — it is what they check if the customer says the delivery never arrived.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            {/* The input covers the label, so a tap anywhere on it opens the
                camera or the picker and keyboard focus lands on a real input. */}
            <label
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'relative min-h-10 w-full cursor-pointer focus-within:ring-3 focus-within:ring-ring/50',
              )}
            >
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="absolute inset-0 size-full cursor-pointer opacity-0"
                onChange={handleFileChange}
              />
              {photo ? 'Choose a different photo' : 'Take or choose a photo'}
            </label>

            {previewUrl && (
              <img
                src={previewUrl}
                alt="The photo that will be attached to this delivery"
                className="max-h-64 w-full rounded-md border border-border object-contain"
              />
            )}

            {photo && (
              <p className="font-mono text-xs text-muted-foreground">
                {photo.name} · {Math.max(1, Math.round(photo.size / 1024))} KB
              </p>
            )}
          </div>

          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitMutation.isPending} onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={!photo || submitMutation.isPending}>
              {submitMutation.isPending ? 'Submitting…' : 'Submit delivery'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
