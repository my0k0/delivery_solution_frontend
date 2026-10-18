/**
 * Hand-written mirror of the backend's fixed permission grid
 * (`delivery_solution_api/src/common/auth/permission-keys.ts`). Kept out of `api.ts` so codegen
 * never clobbers it.
 *
 * This is a *type* mirror, not a runtime source of truth: which keys actually
 * exist comes from `GET /permissions` at runtime. `MODULE_ACTIONS` gives the
 * compiler a closed key union and gives the grid a stable column order.
 *
 * View ≡ read, edit ≡ update — there is no separate view/edit action.
 */
export const MODULE_ACTIONS = {
  users: ['create', 'read', 'update', 'delete'],
  roles: ['create', 'read', 'update', 'delete'],
  permissions: ['read', 'update'],
  shops: ['create', 'read', 'update', 'delete'],
  customers: ['create', 'read', 'update', 'delete'],
  riders: ['create', 'read', 'update', 'delete'],
  orders: [
    'create',
    'read',
    'update',
    'cancel',
    'update_after_approval',
    'shop_settlement',
  ],
  deliveries: ['read', 'update', 'approve'],
  townships: ['create', 'read', 'update', 'delete'],
  partners: ['create', 'read', 'update', 'delete'],
  'shop-portal': ['read'],
  'shop-reports': ['export'],
  reports: ['read', 'export'],
} as const satisfies Record<string, readonly string[]>

export type ModuleName = keyof typeof MODULE_ACTIONS

/** Exact `module.action` union — a literal string type, not `string`. */
export type PermissionKey = {
  [Module in ModuleName]: `${Module}.${(typeof MODULE_ACTIONS)[Module][number]}`
}[ModuleName]

/** Canonical action order — drives the grid's columns so the table doesn't
 * reshuffle when the backend reorders its payload. */
export const ACTION_ORDER = [
  'create',
  'read',
  'update',
  'delete',
  'export',
  'approve',
  'cancel',
  'update_after_approval',
  'shop_settlement',
] as const

export type ActionName = (typeof ACTION_ORDER)[number]
