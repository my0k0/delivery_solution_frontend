import type { FormHTMLAttributes, ReactNode } from 'react'
import {
  FormProvider,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from 'react-hook-form'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { DialogClose, DialogFooter } from '@/components/ui/dialog'

interface FormProps<TFieldValues extends FieldValues>
  extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  /** The `useForm` return — provides context to `Controller`-based fields. */
  form: UseFormReturn<TFieldValues>
  /** Runs only after the zod resolver passes. */
  onValid: SubmitHandler<TFieldValues>
  children: ReactNode
}

/**
 * `<FormProvider>` + the `<form>` element in one, so a dialog never has to
 * remember both. Validation lives entirely in the resolver; this only wires
 * `handleSubmit` to the native submit event.
 *
 * `noValidate` is load-bearing, not cosmetic. Fields carry a `required`
 * attribute for the visual marker, and native constraint validation would
 * otherwise cancel the `submit` event before `handleSubmit` ever runs — the
 * zod resolver never executes and the styled inline errors never appear; the
 * user gets the browser's own unstyled bubble instead. Verified: with
 * `required` and no `noValidate`, a zod `.min(1, 'Name is required')` message
 * never renders. One validation authority, one error style.
 */
export function Form<TFieldValues extends FieldValues>({
  form,
  onValid,
  children,
  className,
  ...formProps
}: FormProps<TFieldValues>) {
  return (
    <FormProvider {...form}>
      <form
        className={cn('flex min-h-0 flex-col gap-4', className)}
        onSubmit={(event) => void form.handleSubmit(onValid)(event)}
        noValidate
        {...formProps}
      >
        {children}
      </form>
    </FormProvider>
  )
}

interface FormBodyProps {
  children: ReactNode
  className?: string
}

/**
 * The scrolling region of a long form: header and footer stay pinned, only the
 * fields move.
 *
 * This is the counterpart to `FormFooter` and it must sit *inside* `<Form>`,
 * not around it — the submit button lives in the footer, and it only submits
 * the fields that are inside the same `<form>` element.
 *
 * `min-h-0` is load-bearing. A flex item defaults to `min-height: auto`, which
 * refuses to shrink below its content, so `flex-1` alone would leave this at
 * full height and `overflow-y-auto` would never engage. `overscroll-contain`
 * stops the scroll from chaining to the page behind the modal once the fields
 * are exhausted.
 */
export function FormBody({ children, className }: FormBodyProps) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface FormFooterProps {
  submitLabel: string
  isSubmitting: boolean
  /**
   * For a form whose only pending change is the edit itself — a correction with
   * nothing changed has nothing to send, and the backend's "Nothing changed"
   * rejection is a round trip to learn what the client already knows.
   */
  isSubmitDisabled?: boolean
}

/**
 * The dialog footer every create/edit form ends with. Close first, submit
 * second, so the row reads [Close][Submit] on desktop and stacks with Close on
 * top on mobile.
 *
 * `DialogClose` drives the dialog's own `onOpenChange`, so the parent still
 * runs its `onClose` cleanup — no `onClose` prop needed here.
 */
export function FormFooter({
  submitLabel,
  isSubmitting,
  isSubmitDisabled = false,
}: FormFooterProps) {
  return (
    <DialogFooter>
      <DialogClose render={<Button type="button" variant="outline" />}>
        Close
      </DialogClose>
      <Button type="submit" disabled={isSubmitting || isSubmitDisabled}>
        {submitLabel}
      </Button>
    </DialogFooter>
  )
}
