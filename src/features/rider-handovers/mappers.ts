/**
 * DTO ↔ form-state translation for handovers. Lives beside `validations.ts`
 * rather than in the fields component: these are pure functions with no JSX, and
 * `HandoverForm.tsx` should export exactly one thing.
 */
import { toNullableString } from '@/lib/nullable'
import { getTodayDate } from '@/features/reports/date-range'
import type {
  CreateRiderHandoverBody,
  RiderHandover,
  UpdateRiderHandoverBody,
} from './api'
import type { HandoverValues } from './validations'

/**
 * Create-mode defaults, computed per open rather than from a module-level
 * `EMPTY_HANDOVER`. `receivedOn` defaults to today — the day the office is
 * receiving the cash — and a constant evaluated at import time would still read
 * yesterday in a tab left open overnight. The rider is preselected when the
 * officer started from a balances row, and blank otherwise.
 */
export function toNewHandoverFormValues(riderId = ''): HandoverValues {
  return {
    riderId,
    amount: '',
    receivedOn: getTodayDate(),
    method: 'KPAY',
    note: '',
    reason: '',
  }
}

/**
 * Row → form state. Codegen types `note` as `Record<string, never> | null` and an
 * `<input>` can only hold a string, so `null` becomes `''` here, once.
 */
export function toHandoverFormValues(handover: RiderHandover): HandoverValues {
  return {
    riderId: handover.riderId,
    amount: handover.amount,
    receivedOn: handover.receivedOn,
    method: handover.method,
    note: toNullableString(handover.note ?? null) ?? '',
    reason: '',
  }
}

/**
 * A cleared optional input holds `''`, which goes over the wire as `null` so it
 * reads as "no value" rather than "the empty string" — and so an untouched blank
 * note compares equal to a stored `null` and is not mistaken for a change.
 */
function toNoteBody(note: string): string | null {
  return note.trim() === '' ? null : note.trim()
}

export function toCreateRiderHandoverBody(
  values: HandoverValues,
): CreateRiderHandoverBody {
  return {
    riderId: values.riderId,
    amount: values.amount,
    receivedOn: values.receivedOn,
    method: values.method,
    note: toNoteBody(values.note),
  }
}

/**
 * Sends the whole editable set rather than a client-side delta: the API diffs
 * against the stored row, so which fields really changed — and whether anything
 * did — is decided in one place instead of two that can disagree.
 */
export function toUpdateRiderHandoverBody(
  values: HandoverValues,
): UpdateRiderHandoverBody {
  return {
    riderId: values.riderId,
    amount: values.amount,
    receivedOn: values.receivedOn,
    method: values.method,
    note: toNoteBody(values.note),
    reason: values.reason,
  }
}
