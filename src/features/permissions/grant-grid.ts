/**
 * Pure layout logic for the module × action permission grid. Kept out of the
 * component so the rectangular shape of the table is testable on its own.
 */
import { ACTION_ORDER } from '@/types/permission'

/** One rendered cell — `defined` means the backend actually guards the key. */
export interface GridAction {
  action: string
  key: string
  defined: boolean
}

export interface GridRow {
  module: string
  actions: Record<string, GridAction>
}

export interface GridLayout {
  columns: string[]
  rows: GridRow[]
}

/** `orders.read` → `read`; `shops` → `shops`. */
export function permissionAction(key: string): string {
  const separator = key.indexOf('.')
  return separator === -1 ? key : key.slice(separator + 1)
}

/**
 * Build the grid shape. The catalog decides which keys *exist*; `ACTION_ORDER`
 * decides which columns render. A module that doesn't guard `approve` gets an
 * inert cell rather than a ragged row — and a backend-added action shows up on
 * its own, because the module set comes from the payload, not a hardcoded list.
 */
export function buildGridLayout(
  catalog: { module: string; permissions: string[] }[],
): GridLayout {
  const keysByModule = new Map(
    catalog.map((group) => [group.module, new Set(group.permissions)]),
  )
  const present = new Set(
    catalog.flatMap((group) => group.permissions.map(permissionAction)),
  )

  // Keep the canonical order, but don't drop an action the backend added.
  const extraActions = Array.from(present)
    .filter((action) => !(ACTION_ORDER as readonly string[]).includes(action))
    .sort()

  const rows = catalog.map((group) => {
    const definedKeys = keysByModule.get(group.module) ?? new Set<string>()
    const actions: Record<string, GridAction> = {}
    for (const action of [...ACTION_ORDER, ...extraActions]) {
      const key = `${group.module}.${action}`
      actions[action] = { action, key, defined: definedKeys.has(key) }
    }
    return { module: group.module, actions }
  })

  return { columns: [...ACTION_ORDER, ...extraActions], rows }
}

/** Every cell the backend actually guards, flattened — the save set's universe. */
export function layoutDefinedKeys(layout: GridLayout): string[] {
  return layout.rows.flatMap((row) =>
    Object.values(row.actions)
      .filter((cell) => cell.defined)
      .map((cell) => cell.key),
  )
}
