import type { Township } from './api'
import type { TownshipValues } from './validations'

export const EMPTY_TOWNSHIP: TownshipValues = {
  name: '',
  defaultDeliveryFee: '',
  leadTimeDays: '',
}

export function toTownshipFormValues(township: Township | undefined): TownshipValues {
  return township
    ? {
        name: township.name,
        defaultDeliveryFee: township.defaultDeliveryFee,
        leadTimeDays: String(township.leadTimeDays),
      }
    : EMPTY_TOWNSHIP
}
