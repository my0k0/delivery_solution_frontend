/**
 * Hand-written mirror of the backend's fixed permission grid
 * (`d_api/src/common/auth/permission-keys.ts`). Kept out of `api.ts` so codegen
 * never clobbers it.
 *
 * This is a *type* mirror, not a runtime source of truth: which keys actually
 * exist comes from `GET /permissions` at runtime. `MODULE_ACTIONS` gives the
 * compiler a closed key union and gives the grid a stable column order.
 *
 * View ≡ read, edit ≡ update — there is no separate view/edit action.
 */
export const MODULE_ACTIONS = {
  users: ['create', 'read', 'update', 'delete', 'export', 'import'],
  roles: ['create', 'read', 'update', 'delete'],
  permissions: ['read', 'update'],
  shops: ['create', 'read', 'update', 'delete', 'export', 'import'],
  customers: ['create', 'read', 'update', 'delete', 'export', 'import'],
  riders: ['create', 'read', 'update', 'delete', 'export', 'import'],
  orders: [
    'create',
    'read',
    'update',
    'delete',
    'export',
    'import',
    'cancel',
    'update_costs',
    'update_after_approval',
  ],
  deliveries: ['create', 'read', 'update', 'delete', 'export', 'import', 'approve'],
  townships: ['create', 'read', 'update', 'delete', 'export', 'import'],
  partners: ['create', 'read', 'update', 'delete', 'export', 'import'],
  ways: ['create', 'read', 'update', 'delete', 'export', 'import', 'override_commission'],
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
  'import',
  'approve',
  'cancel',
  'update_costs',
  'update_after_approval',
  'override_commission',
] as const

export type ActionName = (typeof ACTION_ORDER)[number]
