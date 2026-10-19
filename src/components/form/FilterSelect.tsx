import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SelectOption } from './SelectField'

export type { SelectOption }

interface FilterSelectProps<TValue extends string> {
  /** `undefined` means "no filter" and renders the placeholder. */
  value: TValue | undefined
  options: readonly SelectOption[]
  onChange: (value: TValue | undefined) => void
  /** Omit when the caller supplies its own "All" option instead. */
  placeholder?: string
  className?: string
  'aria-label'?: string
}

/**
 * The controlled `Select` a filter toolbar needs — no react-hook-form, no error
 * slot, and no "All" option.
 *
 * `SelectField` can't cover this case: it requires a `Control` because form
 * fields need validation state. Filter selects are pure local UI state that
 * only becomes a query param when Apply is pressed, which is why every toolbar
 * used to hand-roll the same block — a hand-built `items` map for Base UI's
 * label lookup, plus a guard chain like
 * `if (value === 'BIKE' || value === 'MOTORBIKE' || …)` to re-narrow the
 * `string` Base UI hands back into the caller's union. That chain was written
 * out by hand three times in `RidersToolbar` and twice in `ShopsToolbar`, and
 * it silently did nothing if a new option was added without editing it.
 *
 * `isValue` is a real type guard, so the caller's `onChange` receives
 * `TValue` with no cast — and a value that is somehow not in `options` (a
 * filter left over from a previous build, say) degrades to "no filter" instead
 * of stranding the trigger blank.
 */
export function FilterSelect<TValue extends string>({
  value,
  options,
  onChange,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: FilterSelectProps<TValue>) {
  const items = useMemo(
    () => Object.fromEntries(options.map((option) => [option.value, option.label])),
    [options],
  )

  const isValue = (next: string): next is TValue =>
    options.some((option) => option.value === next)

  return (
    <Select
      items={items}
      value={value ?? ''}
      onValueChange={(next) => onChange(next !== null && isValue(next) ? next : undefined)}
    >
      {/*
        The label belongs on the trigger, not on the Select root: Base UI renders
        the root as no element at all, so an `aria-label` passed there never
        reaches the DOM and the trigger was left with only its placeholder text as
        a name. `placeholder` remains the fallback, which is at least the visible
        text, but a caller's `aria-label` wins.
      */}
      <SelectTrigger className={className ?? 'w-[140px]'} aria-label={ariaLabel ?? placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
