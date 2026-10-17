# Frontend ⇄ API compatibility follow-ups

**Goal:** close the four gaps approved after the rebuild, plus the one live
defect that audit surfaced (`POST /townships` is broken), plus the API-side bug
that would otherwise make the new delete button report "Internal server error".

**Repos**

| Repo | Where | Branch |
| --- | --- | --- |
| Frontend | `/Users/yanmyoaung/.local/share/opencode/worktree/cea5bc/workflow-v2-api-compat` | `rebuild/api-compat` |
| API | `/Users/yanmyoaung/Desktop/myoko/delivery_solution_api` | as-is |

**Environment:** API running on `:3000`; Vite dev server on `:5174` when `:5173`
is taken. Demo logins: `owner@mail.com` / `Password1234`,
`rider1@demo.delivery.local` / `Password1234`.

## Global constraints

- **Frontend: no new spec files, no new dependencies.** `CLAUDE.md:26` is a
  standing user instruction. The pre-existing 7 Vitest files / 33 tests must
  keep passing and are the only automated frontend signal. Verification is
  `pnpm lint` + `pnpm build` + `pnpm test` + live probe + browser smoke.
- **API: tech tests are normal and expected here** (`AGENTS.md` quality gate:
  `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:e2e`).
  A unit spec is added for the changed service.
- **Do not commit.** Both repos say commit only when the user explicitly asks
  (`frontend AGENTS.md:11`, `API AGENTS.md:3`). Leave both working trees dirty
  and present the diffs. (The six rebuild commits already on
  `rebuild/api-compat` came from the previously approved plan.)
- **The API is the source of truth for every limit.** All values below were read
  from `../delivery_solution_api/src/**/dto/*.dto.ts`, not inferred.
- No `any`, no `@ts-ignore`, no bare `!`. Narrow `unknown` with guards.
- One component export per file; non-component code goes to `mappers.ts`/`lib/`.

---

## Task 1 — One table for the API's field limits

**Why.** 15 client-side limits disagree with the API DTOs. Where the client is
looser the user types a valid-looking value and gets a 400; where it is stricter
it refuses input the server would accept. Both directions are drift. Today the
numbers are magic literals inside each feature's zod schema, which is how they
drifted. `src/lib/constants/validation.ts` is already the documented home of
server-enforced rules (`ROLE_NAME_PATTERN`, `AMOUNT_PATTERN`,
`MIN/MAX_PASSWORD_LENGTH`), so the limits go there too.

### 1a. `src/lib/constants/validation.ts`

Append (do not move the existing three exports):

```ts
/**
 * Length limits the API enforces (`@MaxLength` on the request DTOs).
 *
 * These mirror `d_api`, not the UI: a value longer than the server's limit is a
 * 400 after the user has typed the whole thing, so the client has to stop it
 * first. They used to be magic numbers inside each feature's zod schema, which
 * is how they drifted — `shops.channelName` allowed 200 against a DTO limit of
 * 100, and `users.name`, `users.phone` and `roles.description` had no cap at
 * all, so the API rejected what the form accepted.
 *
 * Source of truth: `../delivery_solution_api/src/<feature>/dto/*.dto.ts`.
 * Nothing checks these against the DTOs automatically; change both sides
 * together.
 */
export const FIELD_LIMITS = {
  shop: { name: 150, channelName: 100, phone: 30, address: 500, notes: 500 },
  customer: { name: 150, phone: 30, address: 500, notes: 500 },
  rider: {
    name: 100,
    phone: 20,
    licenseNo: 50,
    vehiclePlate: 30,
    nrcNumber: 50,
    emergencyContactPhone: 30,
    notes: 500,
  },
  user: { name: 100, phone: 20 },
  role: { description: 255 },
  township: { name: 120 },
  partner: { name: 120, phone: 30, note: 1000 },
  order: { deliveryAddress: 2000, notes: 2000, partnerTrackingNo: 200 },
} as const

/**
 * Commission fields: `@Matches(/^\d+(\.\d{1,2})?$/)` plus `@MaxLength(13)`, i.e.
 * at most 10 integer digits and 2 decimals. AMOUNT_PATTERN expresses the same
 * rule, so it is used for validation; this constant is only for `maxLength`.
 */
export const COMMISSION_MAX_LENGTH = 13
```

Replace `AMOUNT_PATTERN` (keep the export name and the doc comment, fix the
pattern and the reason):

```ts
/**
 * Money input accepted by the API: up to 10 whole units with an optional 1-2
 * decimals, e.g. `200`, `200.5`, `200.00`. One source of truth for every amount
 * field (township default fee, order package price/delivery fee/partner fee,
 * commission rate and rider override).
 *
 * Matches `MONEY_PATTERN` in `CreateOrderDto` and, together with the commission
 * DTOs' `@MaxLength(13)`, is their effective rule. The previous pattern had no
 * integer-digit cap, so an 11-digit fee passed here and 400'd on the server.
 */
export const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/
```

### 1b. Point every schema and form at the table

| File | Change |
| --- | --- |
| `src/features/shops/validations.ts` | `name`→`FIELD_LIMITS.shop.name`; `channelName` max **200→100**; `phone` max **20→30**; `address` max **300→500**; `notes`→`.notes`. Messages become template literals carrying the same number. |
| `src/features/customers/validations.ts` | Delete the local `NAME_MAX`; use `FIELD_LIMITS.customer.name`; `phone` max **50→30**; `address`/`notes` from the table. |
| `src/features/riders/validations.ts` | `name`/`notes` from the table; `phone` **50→20**; `licenseNo` **100→50**; `vehiclePlate` **50→30**; `nrcNumber` **100→50**; `emergencyContactPhone` **50→30**. Leave `email` at `max(255)` and add: `// client-side only — the API has no email length cap (@IsEmail)`. |
| `src/features/users/validations.ts` | `name`: add `.max(FIELD_LIMITS.user.name, …)` (was uncapped). `phone`: add `.max(FIELD_LIMITS.user.phone, …)` (was uncapped). |
| `src/features/roles/validations.ts` | `description`: `.max(FIELD_LIMITS.role.description, 'Description must be at most 255 characters').nullable()` in **both** schemas. |
| `src/features/townships/validations.ts` | `name` max **100→120** from the table. `defaultDeliveryFee` keeps `AMOUNT_PATTERN` (now capped). |
| `src/features/townships/components/TownshipForm.tsx` | `maxLength={FIELD_LIMITS.township.name}`. |
| `src/features/partners/DeliveryPartnerForm.tsx` | `maxLength` 120/30/1000 → `FIELD_LIMITS.partner.name/phone/note`. (Already correct; this removes the second copy of the numbers.) |
| `src/features/orders/OrderForm.tsx` | Line 187: replace both inline `/^\d{1,10}(\.\d{1,2})?$/` with `AMOUNT_PATTERN` (import it). Add `maxLength={FIELD_LIMITS.order.partnerTrackingNo}` to line 289, `…order.deliveryAddress` to line 293, `…order.notes` to line 307. |
| `src/features/ways/PayWayAnywayDialog.tsx` | Line 59 `maxLength` **500→1000** (server `@MaxLength(1000)`). |
| `src/features/ways/CommissionSettingsPage.tsx` | Line 40: `/^\d+(\.\d{1,2})?$/` → `AMOUNT_PATTERN`. |
| `src/features/ways/RiderCommissionOverrideDialog.tsx` | Line 27: same swap; add `maxLength={COMMISSION_MAX_LENGTH}` to the `Input` on line 56. |

**Behaviour changes to state out loud** (all align the client to the server):
- stricter on submit: `shops.channelName` 100, `users.name` 100, `users.phone`
  20, `roles.description` 255, riders' five fields, commission values >10 integer
  digits, township fee >10 integer digits.
- looser on submit (previously blocked valid input): `shops.phone` 30,
  `shops.address` 500, `townships.name` 120, `PayWayAnywayDialog` reason 1000.

### 1c. Verify

1. `pnpm test` — 7 files / 33 tests still green. (`users/validations.spec.ts`
   and `roles/validations.spec.ts` are read-only here: neither pins a changed
   limit, so no assertion is weakened.)
2. `pnpm lint` 0 errors · `pnpm build` 0.
3. Throwaway probe script in the temp dir (`frontend-endpoint-audit.mjs`
   pattern): for each entity POST an **over-limit** value → expect 400, then an
   **at-limit** value → expect 2xx; delete whatever it created. Covers shops
   (`channelName` 101/100, `phone` 31/30, `address` 501/500), customers
   (`phone` 31/30), riders (`phone` 21/20, `licenseNo` 51/50, `vehiclePlate`
   31/30, `nrcNumber` 51/50, `emergencyContactPhone` 31/30, plus the
   `name` 101/100 already known), users (`name` 101/100, `phone` 21/20), roles
   (`description` 256/255), townships (`name` 121/120,
   `defaultDeliveryFee` 11-digit → 400 / 10-digit → 201). Orders are not
   create-probed (cleanup is not cheap); their limits were read from the DTO and
   are enforced by `maxLength` attributes checked in the browser smoke.
4. Browser smoke (playwright MCP): Shops → New shop, paste 101 chars in
   *Channel name* → inline error, no request fired. Order create form → the
   notes/address/tracking inputs refuse the 2001st/201st character.

---

## Task 2 — Townships: send the required `leadTimeDays`

**Why.** `CreateTownshipDto` requires `leadTimeDays: number` (`@IsInt() @Min(0)`,
no `@IsOptional`). `createTownship(name, defaultDeliveryFee)` never sent it, so
"New township" 400s on every submit — proved live:
`{"message":["leadTimeDays must not be less than 0","leadTimeDays must be an integer number"]}`.
Nothing caught it because `http.post`'s body is untyped; typing it against
codegen turns the omission into a compile error.

`leadTimeDays` is not filler: the API returns it, `OrderForm.tsx:143,164`
computes the order's estimated delivery date from it, and
`TownshipChangeDialog.tsx:28` shows it.

### 2a. `src/features/townships/api.ts`

```ts
export type Township = components['schemas']['TownshipResponseDto']
/** Codegen DTO — keeps a required server field from going missing again. */
export type CreateTownshipBody = components['schemas']['CreateTownshipDto']
export type UpdateTownshipBody = components['schemas']['UpdateTownshipDto']

export async function createTownship(body: CreateTownshipBody): Promise<Township> {
  const response = await http.post<Township>('/townships', body)
  return response.data
}

export async function updateTownship(id: string, body: UpdateTownshipBody): Promise<Township> {
  const response = await http.patch<Township>(`/townships/${id}`, body)
  return response.data
}
```

`useSaveTownship` takes the whole body for both modes (PATCH is fully optional,
so one shape serves both):

```ts
export function useSaveTownship() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: UpdateTownshipBody }) =>
      id ? updateTownship(id, body) : createTownship(body as CreateTownshipBody),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: townshipsKeys.all })
    },
  })
}
```

### 2b. `src/features/townships/validations.ts`

`leadTimeDays` stays a **string** in form state, like the money field — Zod v4
accumulates string checks and the repo's convention is a `z.string()` whose
`Number()` happens at the request boundary, never `z.coerce` (which would
silently turn `''` into `0`):

```ts
leadTimeDays: z
  .string()
  .trim()
  .min(1, 'Lead time is required')
  .regex(/^\d+$/, 'Lead time must be a whole number of days (0 or more)')
  .refine((value) => Number.isSafeInteger(Number(value)), 'Lead time is too large'),
```

### 2c. `src/features/townships/mappers.ts`

```ts
export const EMPTY_TOWNSHIP: TownshipValues = { name: '', defaultDeliveryFee: '', leadTimeDays: '' }

export function toTownshipFormValues(township: Township | undefined): TownshipValues {
  return township
    ? {
        name: township.name,
        defaultDeliveryFee: township.defaultDeliveryFee,
        leadTimeDays: String(township.leadTimeDays),
      }
    : EMPTY_TOWNSHIP
}
```

### 2d. `src/features/townships/components/TownshipForm.tsx`

Add after `defaultDeliveryFee`, following the same `TextField` shape:

```tsx
<TextField
  {...register('leadTimeDays')}
  htmlFor="township-lead-time"
  label="Lead time (days)"
  inputMode="numeric"
  required
  error={errors.leadTimeDays?.message}
/>
```

### 2e. `src/features/townships/components/TownshipDialog.tsx`

`onValid` sends the number:

```ts
await saveTownshipMutation.mutateAsync({
  id: township?.id,
  body: {
    name: values.name,
    defaultDeliveryFee: values.defaultDeliveryFee,
    leadTimeDays: Number(values.leadTimeDays),
  },
})
```

Update both `DialogDescription` branches to mention lead time, and `submitLabel`
stays as-is.

### 2f. `src/features/townships/TownshipsPage.tsx`

Add a **Lead time** column between the fee and Actions
(`{township.leadTimeDays} {township.leadTimeDays === 1 ? 'day' : 'days'}`) and say
so in the header copy. A field you can set but never see is a trap; the API
already returns it.

### 2g. Verify

1. `pnpm build` (this is the step that now fails if `leadTimeDays` is dropped) ·
   `pnpm lint` · `pnpm test`.
2. Live probe: `POST /townships {name, defaultDeliveryFee, leadTimeDays: 3}` →
   **201**, capture the id; `PATCH /townships/{id} {leadTimeDays: 5}` → 200;
   `DELETE /townships/{id}` → 204. Assert the round-trip value is 5.
3. Browser smoke: Townships → New township → fill name, fee, lead time → toast
   "Township created"; the row appears with the lead time. Reopen for edit → the
   field is seeded. Confirm the 3-field dialog still fits and scrolls at 375px
   width (CLAUDE.md: dialogs must not overflow — verify in a real browser).

---

## Task 3 — Townships: delete

**Why.** `DELETE /townships/{id}` and the `townships.delete` permission key both
exist with no frontend caller. `CLAUDE.md:47` still says "Townships cannot be
deleted", which is stale relative to the API.

### 3a. `src/features/townships/api.ts`

```ts
export async function deleteTownship(id: string): Promise<void> {
  await http.delete(`/townships/${id}`)
}

export function useDeleteTownship() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTownship,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: townshipsKeys.all })
    },
  })
}
```

Own-domain invalidation only, matching `useDeleteCustomer`
(`customers/api.ts:94`) and `useSaveTownship`.

### 3b. `src/features/townships/TownshipsPage.tsx`

Mirror `CustomersPage`'s delete wiring exactly (read it first — it is the
template for dialog + toast + list gating):

- `const canDelete = usePermission('townships.delete')`
- `const [townshipToDelete, setTownshipToDelete] = useState<Township | null>(null)`
- `const deleteTownshipMutation = useDeleteTownship()`
- header cell becomes `{(canUpdate || canDelete) && <TableHead className="text-right">Actions</TableHead>}`
- cell renders the pencil when `canUpdate` and, after it, when `canDelete`:

```tsx
<Button
  variant="ghost"
  size="icon-sm"
  aria-label={`Delete ${township.name}`}
  onClick={() => setTownshipToDelete(township)}
>
  <Trash2 className="size-3.5" />
</Button>
```

- below `<TownshipDialog …/>`:

```tsx
<DeleteConfirmDialog
  open={townshipToDelete !== null}
  onClose={() => setTownshipToDelete(null)}
  title="Delete township"
  description={`Delete ${townshipToDelete?.name ?? 'this township'}? A township that orders already reference cannot be deleted.`}
  onConfirm={async () => {
    if (!townshipToDelete) return
    await deleteTownshipMutation.mutateAsync(townshipToDelete.id)
    toast.success('Township deleted')
    setTownshipToDelete(null)
  }}
/>
```

- imports: `Trash2` (with `Pencil, Plus`), `toast` from `sonner`,
  `DeleteConfirmDialog` from `@/components/DeleteConfirmDialog`, `useDeleteTownship`.
- The empty-state description on line 54 stays accurate.

### 3c. `CLAUDE.md` — correct the one stale sentence

Line 47, `Townships cannot be deleted.` → townships *can* be deleted
(`DELETE /townships/{id}`, gated `townships.delete`), except when orders
reference them (409). Also record the required `leadTimeDays` on create on the
same line. Leave the rest of the file alone; the other stale lines are reported,
not rewritten (see "Reported, not fixed").

### 3d. Verify

1. `pnpm lint` · `pnpm build` · `pnpm test`.
2. Live probe after Task 6: `DELETE` an unused township → 204; `DELETE` an in-use
   one → **409** (not 500).
3. Browser smoke: Townships → delete an unused row → confirm dialog → toast
   "Township deleted" and the row disappears. As an office user, delete an in-use
   row → the dialog surfaces the 409 message from the API, not "Internal server
   error".

---

## Task 4 — Rider destinations are RIDER-only

**Why.** `/rider-dashboard` and `/rider-board` gate on `deliveries.read`, which
OWNER/ADMIN/OFFICER also hold, but every `/riders/me/*` call behind them 403s for
a non-rider. Office users see two sidebar links that always error.

`user.role` is `string` in codegen; the app already compares it
(`App.tsx:58` uses `'SHOP'`). Roles are
`OWNER | ADMIN | OFFICER | RIDER | SHOP`.

### 4a. `src/config/navigation.ts`

- Add to `NavItem`, after `permission`:

```ts
  /**
   * Role gate. Absent = any role. The rider destinations are the only entries
   * that need it: their permission (`deliveries.read`) is held by office roles
   * too, but the `/riders/me/*` endpoints behind them are rider-only.
   */
  roles?: readonly string[]
```

- `{ to: "/rider-dashboard", … }` and `{ to: "/rider-board", … }` each get
  `roles: ["RIDER"]`.
- Replace the tail of the file (from the `firstAllowedPath` doc comment) with:

```ts
/**
 * A nav item is visible when the caller's role is allowed and the permission is
 * held. Single source of truth for the sidebar and for the landing redirect.
 */
export function isNavItemVisible(
  item: NavItem,
  hasPermission: (name: PermissionKey) => boolean,
  role: string | undefined,
): boolean {
  if (item.roles && !(role !== undefined && item.roles.includes(role))) return false;
  return !item.permission || hasPermission(item.permission);
}

export function visibleNavItems(
  hasPermission: (name: PermissionKey) => boolean,
  role: string | undefined,
): NavItem[] {
  return NAV_ITEMS.filter((item) => isNavItemVisible(item, hasPermission, role));
}

/**
 * First sidebar destination the caller can actually open. Falls back to
 * Settings (ungated) so a low-permission user never lands in a redirect loop.
 */
export function firstAllowedPath(
  hasPermission: (name: PermissionKey) => boolean,
  role: string | undefined,
): string {
  for (const item of NAV_ITEMS) {
    if (isNavItemVisible(item, hasPermission, role)) return item.to;
  }
  return "/settings/password";
}
```

### 4b. `src/components/layout/Sidebar.tsx`

`SidebarContent` (lines 36–50) becomes:

```tsx
function SidebarContent() {
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const role = useAuthStore((state) => state.user?.role)
  return (
    <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
      {visibleNavItems(hasPermission, role).map((item) => (
        <SidebarNavLink key={item.to} item={item} />
      ))}
    </nav>
  )
}
```

Imports: drop `Can`, add `useAuthStore` and
`{ NAV_ITEMS → visibleNavItems }`. `React Query`'s `hasPermission` selector is
the same one `App.tsx:56` already uses.

### 4c. `src/lib/auth/gate.tsx`

```tsx
export function ProtectedRoute({
  perm,
  roles,
}: {
  perm: PermissionKey
  roles?: readonly string[]
}) {
  const location = useLocation()
  const allowed = usePermission(perm)
  const role = useAuthStore((state) => state.user?.role)
  const roleAllowed = roles === undefined || (role !== undefined && roles.includes(role))
  if (!allowed || !roleAllowed) {
    return <Navigate to="/403" replace state={{ from: location }} />
  }
  return <Outlet />
}
```

Optional prop → the two `ProtectedRoute` assertions in `gate.spec.tsx` are
unaffected.

### 4d. `src/App.tsx`

- `RedirectToFirst` (line 59):
  `firstAllowedPath(hasPermission, user?.role)`.
- Lines 92 and 110:
  `<ProtectedRoute perm="deliveries.read" roles={['RIDER']} />`.

### 4e. Verify

1. `pnpm lint` · `pnpm build` · `pnpm test` (33 tests).
2. Browser, rider login (`rider1@demo.delivery.local`): sidebar shows only
   *My dashboard*, *My deliveries*, *Settings*; no office links. `/rider-board`
   loads.
3. Browser, owner login: neither rider link is in the sidebar; typing
   `/rider-dashboard` lands on **/403**, and the post-login redirect still goes
   to `/dashboard`.
4. A rider hitting `/dashboard` still gets /403 (unchanged).

---

## Task 5 — `AssignOrderDialog` says why the picker is empty

**Why.** The dialog opens on `orders.update` and saves through
`POST /orders/{id}/assign` (also `orders.update`), but its lists need
*other* grants: `/riders/assignable` requires `orders.create`, `/delivery-partners`
requires `partners.read`. An `orders.update`-only user therefore sees an empty
select plus the misleading "Choose an assignee, or choose Clear assignee."

`/orders/{id}/assign` → `orders.update`; `/riders/assignable` → `orders.create`;
`GET /delivery-partners` → `partners.read` (all read from the controllers).

### 5a. `src/features/orders/AssignOrderDialog.tsx`

Replace the empty-picker failure with the real cause:

```tsx
const riderError = riders.isError ? getApiErrorMessage(riders.error) : ''
const partnerError = partners.isError ? getApiErrorMessage(partners.error) : ''
const listError = assigneeType === 'RIDER' ? riderError : assigneeType === 'PARTNER' ? partnerError : ''
```

- Render the picker only when there is no error for the selected type:

```tsx
{assigneeType && !listError && (
  <OrderSelectField id="assignment-person" … />
)}
{listError && (
  <p role="alert" className="text-sm text-destructive">
    {assigneeType === 'RIDER'
      ? 'Could not load assignable riders. '
      : 'Could not load delivery partners. '}
    {listError}
  </p>
)}
```

- Disable the save button while `listError` is set, so the action cannot be
  attempted with an unusable list:
  `disabled={pending || Boolean(listError)}`.
- Import `getApiErrorMessage` from `@/lib/api/client`.

Keep the existing order of responsibilities: the dialog owns the query error
copy, `OrderSelectField` stays a dumb picker.

### 5b. Verify

1. `pnpm lint` · `pnpm build` · `pnpm test`.
2. Live probe: as `owner@mail.com`, create a throwaway role holding
   `orders.read` + `orders.update` but **not** `orders.create`/`partners.read`,
   and a throwaway user on it. Log in as that user → open an order → *Assign*:
   the dialog shows the riders error instead of a silent empty select, and Save
   is disabled. Confirm `GET /riders/assignable` with that token is a 403.
   Delete the user, then the role.
3. Browser smoke as that user, then clean up and re-verify the owner path still
   assigns normally.

---

## Task 6 — API: deleting a referenced township is a 409, not a 500

**Why.** `orders.townshipId` is `onDelete: 'restrict'`, and
`TownshipsService.remove` lets the FK violation escape as an unhandled error:

```
DELETE /townships/{id}  (referenced by orders)
→ HTTP 500 {"statusCode":500,"message":"Internal server error"}
```

Without this, the Task 3 button reports "Internal server error" for a perfectly
ordinary case.

### 6a. `src/common/database/pg-error-code.ts` (new)

Extract the two private helpers that `is-unique-violation.ts` already has, so
the second violation kind does not copy them:

```ts
export function asErrorObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/** Postgres error code, looking through the `cause` chain Drizzle wraps. */
export function getErrorCode(err: unknown): unknown {
  const error = asErrorObject(err);
  const cause = asErrorObject(error?.cause);
  return error?.code ?? cause?.code;
}
```

`src/common/database/is-unique-violation.ts`: import `getErrorCode` and delete
its private copies. Its exported name, signature and the `23505` behaviour are
unchanged, so no caller moves.

### 6b. `src/common/database/is-foreign-key-violation.ts` (new)

```ts
import { getErrorCode } from './pg-error-code.js';

/** Narrow a caught DB error to a Postgres foreign-key violation. */
export function isForeignKeyViolation(err: unknown): boolean {
  return getErrorCode(err) === '23503';
}
```

(ESM under `nodenext`: the `.js` suffix is mandatory.)

### 6c. `src/townships/townships.service.ts`

```ts
  async remove(id: string): Promise<void> {
    const township = await this.townshipOrThrow(id);
    try {
      await this.database.db.delete(townships).where(eq(townships.id, id));
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          `Township '${township.name}' is used by orders and cannot be deleted`,
        );
      }
      throw error;
    }
  }
```

`ConflictException` is already imported. Add the import for
`isForeignKeyViolation`.

### 6d. `src/townships/townships.controller.ts`

Document the status on the delete route, mirroring the `@ApiConflictResponse`
usage already in `src/shops/shops.controller.ts` (check it and copy the style):

```ts
@Delete(':id') @RequirePermissions('townships.delete')
@ApiNoContentResponse({ description: 'Township deleted' })
@ApiConflictResponse({ description: 'Township is referenced by orders' })
```

### 6e. `src/townships/townships.service.spec.ts` (new)

Mirror `src/shops/shops.service.spec.ts` (same `Test.createTestingModule` +
mocked `DatabaseService` shape). Cases:

1. `remove` deletes an existing township and resolves.
2. `remove` throws `NotFoundException` for an unknown id.
3. `remove` maps a `{ code: '23503' }` rejection to `ConflictException`.
4. `create` passes `leadTimeDays` through to `values` — the regression guard for
   the contract Task 2 fixes on the client.

### 6f. Verify

1. `pnpm typecheck` · `pnpm lint` · `pnpm build` · `pnpm test`.
2. Check `vitest.config.e2e.ts` for a fixed port; if the e2e suite binds `:3000`,
   stop the dev server first (both use the Compose Postgres DB). Run
   `pnpm test:e2e` if it can run without clobbering the running server;
   otherwise say plainly that it was not run.
3. Restart/reload the API and re-probe: `DELETE` an in-use township → **409**
   with the new message; `DELETE` an unused one → **204**.
4. Confirm `GET /api/v1/docs-json` now documents the 409 on that route.

---

## Order and commit policy

1 → 2 → 3 (3d depends on 6 for the 409 probe) → 4 → 5 → 6. Tasks 4 and 5 are
independent of the rest and of each other.

**Do not commit either repo.** Present the diffs and the gate results, and ask.

## Reported, not fixed

- `src/features/orders/OrderForm.tsx` has the same shape as Task 5: five option
  lists (`/shops`, `/customers`, `/riders`, `/townships`, `/delivery-partners`)
  render empty with no explanation when the caller's role lacks the matching
  `.read` grant.
- `CLAUDE.md` still says "township endpoints use `orders.*`" (line 38), that
  order creation "requires … an active rider" (line 49), and that rider-board is
  "at `/rider`, outside the office `AppShell`" (line 51). All three are stale
  against the current API/routes. Only line 47 is corrected, because Task 3
  makes it wrong about code I am writing.
- `/orders/approval` gates nav on `deliveries.approve` and the route on
  `orders.read` — latent until a custom role holds only one. (Offered earlier;
  not selected.)
- Reviewer nit: duplicate `toMinorUnits`/`fromMinorUnits` helpers.

---

## Outcome

### Deviations from the plan

1. **Task 6 changed shape.** The plan called for catching the foreign-key
   violation (`code 23503`) in `TownshipsService.remove()` and documenting a 409
   with `@ApiConflictResponse`. Both halves were dropped in favour of a
   **count pre-check**, which is what `RolesService.remove()` and
   `UsersService.remove()` already do:

   ```ts
   const referencing = Number(
     (await this.database.db
       .select({ c: sql<number>`count(*)` })
       .from(orders)
       .where(eq(orders.townshipId, id)))[0]?.c ?? 0,
   );
   if (referencing > 0) throw new ConflictException(
     `${referencing} order(s) still use township '${township.name}'. Reassign or delete them first.`,
   );
   ```

   Why: the catch-based version was written, compiled, deployed to the running
   dev server (listener PID 44348, started 15:16:31 — *after* the edit), and
   **still returned 500**. `getErrorCode(error) === '23503'` did not hold for the
   real Drizzle error, i.e. the error's code is not reachable at
   `error.code ?? error.cause.code`. The pre-check removes that dependency
   entirely, is testable with a mocked count, and matches the repo idiom. The
   added `src/common/database/pg-error-code.ts` and `is-foreign-key-violation.ts`
   were deleted again and `is-unique-violation.ts` restored to its original form.

2. **No `@ApiConflictResponse` anywhere.** The API documents **no** error
   responses on any route, so adding one for this endpoint would have been the
   only one in the codebase. Plan step 4 (`docs-json` shows the 409) was
   therefore dropped rather than satisfied with a one-off inconsistency.

### Task 7 (approved after review): commission DTOs vs the column

`UpdateCommissionRateDto` and `UpdateRiderDto.commissionPerWayOverride` accepted
`@MaxLength(13)` with `@Matches(/^\d+(\.\d{1,2})?$/)`, but they write to
`numeric(12,2)` columns, which hold **10** integer digits. Measured live:

| value | length | old result |
|---|---|---|
| `9999999999` | 10 | 200 |
| `12345678901` | 11 | **500** |
| `1234567890123` | 13 | **500** |

The DTO was looser than the column, so a value valid per DTO died in Postgres as
an unhandled `22003`. Both patterns are now `MONEY_PATTERN`
(`/^\d{1,10}(\.\d{1,2})?$/`), a local const in each DTO file exactly as
`create-order.dto.ts` and `update-order.dto.ts` already do it, and the redundant
`@MaxLength(13)` (the pattern bounds the length) is gone. The Swagger `pattern`
strings were updated to match.

Note the frontend's `AMOUNT_PATTERN` already matched the column, so the UI could
never trigger this — only a direct API call could. An earlier version of the
comment on `AMOUNT_PATTERN` claimed the DTO was the effective rule; the probe
falsified that and both comments were corrected.

Tested where this repo tests validation — e2e, not unit:

- `test/ways.e2e-spec.ts`: 11 and 13 integer digits and 3 decimals → 400;
  `9999999999` → 200 with body `{value: '9999999999.00'}`; `9999999999.99` → 200.
  Reads the current rate first and restores it afterwards, so the suite does not
  leave the shared `app_settings` row mutated.
- `test/riders.e2e-spec.ts`: `12345678901` → 400; `9999999999.99` → 200.

`MONEY_PATTERN` now exists in four DTO files. Consolidating it into one shared
constant would touch the two order DTOs, which is outside what was approved —
reported rather than done.

### Verification (all observed, not inferred)

API: `pnpm typecheck` / `lint` / `build` clean; `pnpm test` 23 files /
**143** tests pass (new `townships.service.spec.ts`: 4 tests); `pnpm test:e2e
test/ways.e2e-spec.ts test/riders.e2e-spec.ts` **7** tests pass (5 before Task 7).

Live probe, **29/29 checks** pass — including the commission case that failed
before Task 7 (expected 400, got 500). Notably:

- `POST /townships` with `leadTimeDays` → 201; without it → 400 (the original
  bug, reproduced as a 400); `PATCH` round-trips `leadTimeDays` 3 → 5.
- `DELETE` unused township → 204; `DELETE` in-use → **409**,
  `9 order(s) still use township 'Demo Central'. Reassign or delete them first.`
- Every server-side length limit matches the new `FIELD_LIMITS` (shops,
  customers, riders, users, roles, townships, order fields, commission).

Frontend browser smoke (Playwright, dev server `:5174`):

- Rider login → `/rider-dashboard`; sidebar shows exactly *My dashboard, My
  deliveries, Settings*; live data renders; no console errors.
- Owner login → `/dashboard`; 18 office links; **no** rider links;
  `/rider-dashboard` and `/rider-board` → `/403`.
- Townships: dialog exposes all three inputs (`township-name`,
  `township-default-fee`, `township-lead-time`); create → toast *Township
  created*, row reads `123.45` / `3 days`; delete → toast *Township deleted*;
  delete of an in-use township surfaces the real 409 message and leaves the row.
- Task 5: a throwaway role holding only `orders.read` + `orders.update` opened
  the Assign dialog; choosing *Rider* showed *"Could not load assignable riders.
  You do not have the required permissions for this action"* with Save disabled.
  Temporary role permissions and user were removed afterwards; OFFICER's
  original 22 permissions restored (verified by set equality).

Not run: the full API `pnpm test:e2e` suite. Correction to an earlier
assumption: the e2e specs build their own app with `Test.createTestingModule` +
`app.init()` and never call `listen()`, so they do **not** bind a port and do not
contend with the dev server on `:3000` — that was never a blocker. The two files
covering the changed validation were run instead.

### Environment note

`pnpm dev` was started in the worktree for the browser pass and is still
running on `:5174`.
