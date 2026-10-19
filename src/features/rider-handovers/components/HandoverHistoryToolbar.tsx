import { Button } from '@/components/ui/button'
import { FilterSelect } from '@/components/form/FilterSelect'
import type { SelectOption } from '@/components/form/SelectField'
import { Input } from '@/components/ui/input'
import { HANDOVER_METHOD_OPTIONS, type HandoverMethod } from '../handover-methods'

interface HandoverHistoryToolbarProps {
  riderIdInput?: string
  methodInput?: HandoverMethod
  dateFromInput: string
  dateToInput: string
  riderOptions: readonly SelectOption[]
  hasFilters: boolean
  hasPendingChanges: boolean
  onRiderChange: (value: string | undefined) => void
  onMethodChange: (value: HandoverMethod | undefined) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onApply: () => void
  onReset: () => void
}

/**
 * History toolbar: rider / method / received-date window + Apply/Reset.
 *
 * Everything commits on Apply, including the date inputs. A native date input
 * reports an empty value while the officer is still typing a date, and firing a
 * query on every segment would spend a request the API answers with 400 for a
 * filter the officer has not finished expressing.
 */
export function HandoverHistoryToolbar({
  riderIdInput,
  methodInput,
  dateFromInput,
  dateToInput,
  riderOptions,
  hasFilters,
  hasPendingChanges,
  onRiderChange,
  onMethodChange,
  onDateFromChange,
  onDateToChange,
  onApply,
  onReset,
}: HandoverHistoryToolbarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        value={riderIdInput}
        options={riderOptions}
        onChange={onRiderChange}
        placeholder="All riders"
        aria-label="Filter by rider"
        className="w-48"
      />

      <FilterSelect
        value={methodInput}
        options={HANDOVER_METHOD_OPTIONS}
        onChange={onMethodChange}
        placeholder="All methods"
        aria-label="Filter by received method"
        className="w-40"
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="handover-date-from" className="text-sm font-medium">
          Received from
        </label>
        <Input
          id="handover-date-from"
          type="date"
          value={dateFromInput}
          onChange={(event) => onDateFromChange(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="handover-date-to" className="text-sm font-medium">
          Received to
        </label>
        <Input
          id="handover-date-to"
          type="date"
          value={dateToInput}
          onChange={(event) => onDateToChange(event.target.value)}
        />
      </div>

      <Button variant="outline" onClick={onApply} disabled={!hasPendingChanges}>
        Apply
      </Button>
      {hasFilters && (
        <Button variant="ghost" onClick={onReset}>
          Reset
        </Button>
      )}
    </div>
  )
}
