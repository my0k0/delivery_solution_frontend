# URL-backed List Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move office list-page filter state from `useState` into the URL so a filtered view survives leaving the page, a reload, and a shared link — starting with Orders.

**Architecture:** A `useUrlFilters` hook wraps `useSearchParams` around a per-feature `UrlFilterSchema` (parse / serialize / defaults). Defaults are omitted from the URL, so `/orders` always means "today". A per-tab `sessionStorage` memory lets the sidebar return to the last filtered view. React Query then serves the cached table, because the query key no longer changes when you navigate away and back.

**Tech Stack:** React 19, React Router 7 (`useSearchParams`), TanStack Query 5, TypeScript, Tailwind + shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-10-24-url-list-filters-design.md`

## Global Constraints

- **No new test files.** Standing user instruction: this repo's verification is `pnpm lint` + `pnpm build` + a manual smoke pass against `delivery_solution_api`. The existing Vitest suite must keep passing (`pnpm test`), but no new spec file is written for this work.
- **Do not commit or push.** Only stage/commit if the user explicitly asks. Steps below end with verification, not a commit.
- **No `any`, no `as` casts to silence a union**, no `@ts-ignore`. Invalid URL values are narrowed with a real check (`ORDER_STATUSES.find((s) => s === value)`, `Number.isInteger`, an `isHandoverMethod` type guard), never asserted.
- **Every filter write uses `{ replace: true }`.** A `push` on filter changes breaks the Back button.
- **No `setState` inside an effect keyed on a fresh reference.** The hook writes to the router, never to local state.
- **Money stays a decimal string; dates stay `YYYY-MM-DD`** without UTC conversion — `getTodayDate()` from `@/features/reports/date-range` is the local-date source.
- **`src/types/api.ts` is codegen output** — read it, never edit it.
- **Colors and spacing come from tokens** (`bg-card`, `text-muted-foreground`, …). No hex, no `bg-blue-*`.
- **`pnpm`,** not npm/yarn. No new dependencies.

## Review Focus

The five things most likely to bite a real officer, each pinned to a task's smoke step:

1. **A date input fires partial and empty values while typing.** Orders commits immediately, so `dateFrom` can transiently be `''`. Expected: the list widens momentarily and settles on the officer's range; clearing a bound must mean "no bound", not "today" (Task 2, sentinel logic).
2. **Back after several filter changes must leave the page, not unwind the filters.** One `push` among the `replace`s breaks this (Task 2 and Task 4 smoke).
3. **A pasted link with junk params must render a normal default list.** `?status=BOGUS&page=abc` must not throw and must not silently keep a stale filter (Task 1 canonicalize step, Task 2 smoke).
4. **Filter memory must not leak between users or tabs.** Logout → login as a different user in the same tab starts clean (Task 3 smoke).
5. **A remembered page number can outlive its rows.** Page 7 with 3 pages left must not render "No orders found" (Task 2 clamp step).

---

### Task 1: URL filter primitives

**Files:**
- Create: `src/lib/url/list-query-memory.ts`
- Create: `src/lib/url/useUrlFilters.ts`

**Interfaces:**
- Produces (used by Tasks 2 and 4):

```ts
// list-query-memory.ts — per-tab memory of the last non-empty query per list path
export function rememberListQuery(key: string, query: string): void   // '' deletes the entry
export function readListQuery(key: string): string                    // '' when nothing stored
export function forgetListQuery(key: string): void
export function forgetAllListQueries(): void
export function useListQuery(key: string): string                     // subscribed read, for the sidebar

// useUrlFilters.ts — memory is keyed by location.pathname, so a schema declares no key
export interface UrlFilterSchema<T extends { page: number }> {
  defaults: () => T
  parse: (params: URLSearchParams) => T
  serialize: (values: T) => URLSearchParams
}

export interface UrlFiltersResult<T extends { page: number }> {
  filters: T
  /** Merges, resets `page` to `defaults().page` unless `keepPage`, writes the URL (replace), syncs memory. */
  update: (patch: Partial<T>, options?: { keepPage?: boolean }) => void
  reset: () => void
  /**
   * True when any filter other than `page` differs from its default — so the
   * "Reset filters" control does not appear merely because you are on page 2.
   */
  hasActiveFilters: boolean
}

export function useUrlFilters<T extends { page: number }>(schema: UrlFilterSchema<T>): UrlFiltersResult<T>
```

- [ ] **Step 1: Write `list-query-memory.ts`**

Storage key prefix `delivery-list-query:`. Every `sessionStorage` call sits in a `try/catch` — the API throws in a sandboxed/private context, and a lost filter memory must never break a page. `rememberListQuery(key, '')` and `forgetListQuery` both call `removeItem`.

- [ ] **Step 2: Write `useUrlFilters.ts`**

Read with `useSearchParams()`. `filters = useMemo(() => schema.parse(searchParams), [schema, searchParams])`.

Canonicalize in one effect, and sync memory there:

```ts
useEffect(() => {
  const canonical = schema.serialize(filters).toString()
  const current = searchParams.toString()
  if (canonical !== current) setSearchParams(canonical, { replace: true })
  if (canonical) rememberListQuery(schema.key, `?${canonical}`)
  else forgetListQuery(schema.key)
}, [filters, schema, searchParams, setSearchParams])
```

`update` builds `next = { ...filters, ...patch }`, sets `next.page = schema.defaults().page` unless `options?.keepPage`, serializes, and calls `setSearchParams(params, { replace: true })`. `reset` calls `setSearchParams(new URLSearchParams(), { replace: true })` and `forgetListQuery(schema.key)`.

`hasActiveFilters = schema.serialize({ ...filters, page: schema.defaults().page }).size > 0` — page is
excluded on purpose, so the Reset control does not appear just because you paged forward.

- [ ] **Step 3: Verify types and lint**

Run: `pnpm lint && pnpm build`
Expected: no errors. (The hook has no consumer yet, so this task's gate is the type checker.)

- [ ] **Step 4: Sanity-check the loop guard**

Confirm the canonicalize effect cannot run forever: after it writes `canonical`, the re-render parses the same string and `canonical !== current` is false. Confirm it also cannot wipe a valid query: `serialize(parse(x)) === x` for every value `serialize` can emit. Check the empty case by hand — `serialize(defaults).toString()` must be `''`.

---

### Task 2: Orders list filters in the URL

**Files:**
- Create: `src/features/orders/order-filters.ts`
- Modify: `src/features/orders/OrdersPage.tsx` (whole file — state block at 47-58, filter object at 65-79, filter section at 109-130)

**Interfaces:**
- Consumes: `useUrlFilters`, `UrlFilterSchema` (Task 1); `ORDER_STATUSES`, `OrderFilters`, `OrderStatus`, `OrderDateBasis`, `ShopAdvanceFilter` from `./api`.
- Produces:

```ts
export interface OrderFilterValues {
  page: number
  search: string            // '' = no search
  status: OrderStatus | ''  // '' = all
  shopId: string
  townshipId: string
  assigneeId: string
  shopAdvance: ShopAdvanceFilter | ''   // '' = any
  isPackagePaidToShop: string           // '' | 'true' | 'false'
  dateFrom: string          // 'YYYY-MM-DD', '' = no lower bound
  dateTo: string
  dateBasis: OrderDateBasis
}

export const SHOP_ADVANCE_FILTERS: readonly ShopAdvanceFilter[]
export const ORDER_DATE_BASES: readonly OrderDateBasis[]

/** Narrow a raw string from a Select to the union, or '' for "all". */
export function toOrderStatus(value: string): OrderStatus | ''
export function toShopAdvance(value: string): ShopAdvanceFilter | ''

export function defaultOrderFilters(): OrderFilterValues
export function parseOrderFilters(params: URLSearchParams): OrderFilterValues
export function serializeOrderFilters(values: OrderFilterValues): URLSearchParams
export const ORDERS_FILTER_SCHEMA: UrlFilterSchema<OrderFilterValues>
```

- [ ] **Step 1: Write `order-filters.ts`**

`defaultOrderFilters()` returns `{ page: 1, search: '', status: '', shopId: '', townshipId: '', assigneeId: '', shopAdvance: '', isPackagePaidToShop: '', dateFrom: getTodayDate(), dateTo: getTodayDate(), dateBasis: 'ENTRY' }` — a function, not a module constant, because "today" moves.

`parseOrderFilters` never throws and never casts:

| param | valid | fallback |
|---|---|---|
| `page` | `Number.isInteger(n) && n >= 1` | `1` |
| `search` / `shopId` / `townshipId` / `assigneeId` | trimmed non-empty | `''` |
| `status` | via `toOrderStatus` | `''` |
| `shopAdvance` | via `toShopAdvance` | `''` |
| `isPackagePaidToShop` | `'true'` or `'false'` | `''` |
| `dateBasis` | `v === 'ENTRY' \|\| v === 'DELIVERED'` | `'ENTRY'` |
| `dateFrom` / `dateTo` | `/^\d{4}-\d{2}-\d{2}$/` | see sentinel below |

Implement the narrowing helpers with `find`, not `includes` and not a cast — `readonly OrderStatus[]` cannot be asked `.includes(someString)` without one:

```ts
export function toOrderStatus(value: string): OrderStatus | '' {
  return ORDER_STATUSES.find((status) => status === value) ?? ''
}
```

Date sentinel, in `parse`:

```ts
const date = (name: 'dateFrom' | 'dateTo') => {
  if (!params.has(name)) return defaults[name]   // absent = the default (today)
  const raw = params.get(name) ?? ''
  if (raw === '') return ''                      // present but empty = explicitly cleared
  return ISO_DATE.test(raw) ? raw : defaults[name]
}
```

and in `serialize`: emit the param when the value differs from `defaults[name]`, and emit it with an empty value when the value is `''`. This is the only place the "cleared" case is representable — a plain "omit when falsy" would turn a cleared bound back into today.

`serializeOrderFilters` omits every value equal to its default (`page === 1`, `''`, `dateBasis === 'ENTRY'`, `dateFrom/dateTo === today`), so `serializeOrderFilters(defaultOrderFilters()).toString() === ''`.

- [ ] **Step 2: Replace the page's filter state with the hook**

Delete the ten `useState` calls and `resetToFirstPage`. Keep `isFormOpen`. Replace with:

```tsx
const { filters: values, update, reset, hasActiveFilters } = useUrlFilters(ORDERS_FILTER_SCHEMA)
```

Map `values` to `OrderFilters` exactly as lines 65-78 did, but with no casts — every union is
already narrowed by `parse`, and `''` maps to `undefined`:

```ts
const filters: OrderFilters = {
  page: values.page,
  perPage: PAGE_SIZE,
  search: values.search.trim() || undefined,
  status: values.status || undefined,
  shopId: values.shopId || undefined,
  townshipId: values.townshipId || undefined,
  assigneeId: values.assigneeId || undefined,
  shopAdvance: values.shopAdvance || undefined,
  isPackagePaidToShop: values.isPackagePaidToShop === '' ? undefined : values.isPackagePaidToShop === 'true',
  dateFrom: values.dateFrom || undefined,
  dateTo: values.dateTo || undefined,
  dateBasis: values.dateBasis,
}
```

The empty-date sentinel lives in the URL only; the request keeps today's behaviour, where an
empty bound means "no bound" and goes out as `undefined`.

Every `onChange` becomes `update({ name: value })`, narrowing where the control hands back a bare
string — `update({ status: toOrderStatus(value) })`, `update({ shopAdvance: toShopAdvance(value) })`.
Pagination becomes `update({ page: values.page + 1 }, { keepPage: true })`.

- [ ] **Step 3: Add the Reset control and the page clamp**

Wrap the filter `<section>`'s children in a flex column: a header row (`<span className="text-sm font-medium">Filters</span>` + `{hasActiveFilters && <Button variant="ghost" size="sm" onClick={reset}>Reset filters</Button>}`), then the existing `grid`. Do not put the header inside the grid — it would take a filter cell.

Clamp the page after data arrives:

```tsx
useEffect(() => {
  const totalPages = orders.data?.meta.totalPages
  if (totalPages !== undefined && values.page > Math.max(totalPages, 1)) {
    update({ page: Math.max(totalPages, 1) }, { keepPage: true })
  }
}, [orders.data?.meta.totalPages, values.page, update])
```

- [ ] **Step 4: Verify lint, build, and the existing suite**

Run: `pnpm lint && pnpm build && pnpm test`
Expected: zero lint errors, `tsc` clean, existing specs still green.

- [ ] **Step 5: Smoke the behaviour in a real browser**

Backend: `cd ../delivery_solution_api && pnpm start:dev`; frontend: `pnpm dev`. Log in as `admin1@mail.com` / `Password1234`. Using the `playwright` MCP tools, walk:

1. `/orders` → set Status `PENDING`, Shop, and From/To → address bar shows those params, and `page` is absent.
2. Click a tracking link → **Back** → same filters, same rows.
3. **Reload** → filters still applied.
4. Change page 2 → open an order → Back → still page 2.
5. **Reset filters** → `/orders` exactly, defaults visible, table unfiltered.
6. Paste `/orders?status=BOGUS&page=abc` → list renders with defaults and the URL is rewritten to `/orders`.
7. Clear the **From** input → URL shows `dateFrom=`, list shows orders from before today (unbounded), then pick a date again.
8. Set the date range, navigate away to a detail, Back: the range is intact and the date inputs show it.
9. Paste `/orders?page=999` → the list shows a real page and the URL settles on the last valid page (not "No orders found").

Expected: every step above holds. Report any step that does not, with the observed URL.

---

### Task 3: Sidebar restores the last view; auth clears it

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (`SidebarNavLink`, lines 22-43)
- Modify: `src/lib/store/auth.store.ts` (`clearSession`, line 39)
- Modify: `src/features/auth/LoginPage.tsx` (success handler, line ~44)

**Interfaces:**
- Consumes: `readListQuery`, `forgetAllListQueries` (Task 1).

- [ ] **Step 1: Append the remembered query to nav destinations**

In `SidebarNavLink`: `const remembered = useListQuery(item.to)` then `<NavLink to={`${item.to}${remembered}`} end …>`. Use the **subscribed** `useListQuery`, not `readListQuery`: the memory is written from an effect, so a render-time read is one filter change behind — clicking the link would then drop the change the officer just made (and Reset would appear not to stick). `end` still matches on the pathname, so active state is unaffected. `Sidebar` re-renders on navigation already; the subscription covers the in-page case.

- [ ] **Step 2: Clear the memory on the session teardown path**

In `auth.store.ts`, `clearSession` also calls `forgetAllListQueries()`. In `LoginPage`, call `forgetAllListQueries()` immediately before `setSession(...)`. Do **not** add it to `setSession` itself — `AuthBootstrap` and the permission refresh both call `setSession`, and that would wipe the filters on every reload and every permission change.

- [ ] **Step 3: Verify**

Run: `pnpm lint && pnpm build && pnpm test`

- [ ] **Step 4: Smoke the return paths**

1. Filter `/orders`, go to Dashboard, click **Orders** in the sidebar → filters restored, URL carries them.
2. Filter, go to an order detail, click **Orders** in the sidebar → filters restored (not a reset list).
3. Logout → login as `admin2@mail.com` → click Orders → clean defaults.
4. On the clean list, the sidebar Orders link resolves to `/orders` (no query) — verify with the link's `href`.

---

### Task 4: Rider handovers filters in the URL

**Files:**
- Create: `src/features/rider-handovers/handover-filters.ts`
- Modify: `src/features/rider-handovers/components/HandoverHistorySection.tsx` (state at 30-35, 53-79)
- Modify: `src/features/rider-handovers/components/HandoverBalancesSection.tsx` (state at 23-27, 33-46)

**Interfaces:**
- Consumes: `useUrlFilters` (Task 1).
- Produces:

```ts
export interface HandoverHistoryFilterValues {
  page: number
  riderId: string
  method: HandoverMethod | ''   // '' = any
  dateFrom: string
  dateTo: string
}
export interface HandoverBalanceFilterValues {
  page: number
  search: string
  outstandingOnly: boolean
}
export const HANDOVER_HISTORY_FILTER_SCHEMA: UrlFilterSchema<HandoverHistoryFilterValues>
export const HANDOVER_BALANCES_FILTER_SCHEMA: UrlFilterSchema<HandoverBalanceFilterValues>
```

Defaults are empty (`page: 1`, `''`, `false`) — **no date defaults here**, so a missing date already means "no bound" and no sentinel is needed.

- [ ] **Step 1: Write `handover-filters.ts`**

Narrow `method` with the existing `isHandoverMethod` guard from `../handover-methods` — do not add a second
narrowing helper for the same union:

```ts
const rawMethod = params.get('method') ?? ''
method: isHandoverMethod(rawMethod) ? rawMethod : '',
```

`parse` treats `outstandingOnly` as true only for the exact string `'true'`, checks dates against
`/^\d{4}-\d{2}-\d{2}$/`, and accepts `page` only when `Number.isInteger` and `>= 1`. `serialize` omits
empty strings and `false`, so a defaulted view serializes to `''`. Both schemas share one small internal
`readPage` / `readDate` helper in this file rather than exporting them.

- [ ] **Step 2: Point the history section at the URL**

Keep the draft inputs (`riderIdInput`, `methodInput`, `dateFromInput`, `dateToInput`) and the Apply button — committing on Apply stays, because a native date input reports an empty value mid-typing (see the existing comment in `HandoverHistoryToolbar`). Replace the `filters` state with the hook. `applyFilters` becomes `update({ riderId: riderIdInput ?? '', method: methodInput ?? '', dateFrom: dateFromInput, dateTo: dateToInput })` plus `setExpandedId(null)`. `goToPage` becomes `update({ page }, { keepPage: true })`. `resetFilters` calls the hook's `reset()` and clears the four drafts. `hasFilters` becomes `hasActiveFilters`.

- [ ] **Step 3: Point the balances section at the URL**

Same shape with its own schema key (`'handover-balances'`) so the two sections do not share a memory entry.

- [ ] **Step 4: Verify**

Run: `pnpm lint && pnpm build && pnpm test`

- [ ] **Step 5: Smoke**

1. `/rider-handovers` → pick a rider + method, Apply → URL carries them, table filtered.
2. Expand a row's audit trail, then Back/forward nav away and return → filters restored, expansion collapsed (acceptable — it is not URL state).
3. Reset → `/rider-handovers` clean; sidebar link clean.
4. Balances: search + "outstanding only" → URL shows `search=`/`outstandingOnly=true`, and the history section's params are untouched.
5. Both sections at once: URL carries params from both, and each keeps its own page number.

---

### Task 5: Record the convention

**Files:**
- Modify: `CLAUDE.md` (Architecture bullet list + Conventions section)

- [ ] **Step 1: Add the rule where the next implementer will look**

Under Architecture, add `src/lib/url/` — `useUrlFilters` (URL as the source of truth for list filters) and `list-query-memory.ts` (per-tab last view, cleared by `clearSession`). Under Conventions, add: list-page filters live in the URL via `useUrlFilters`, defaults are omitted so "today" re-resolves on load, every filter write is `replace`, and a new list page must adopt the hook rather than `useState`.

- [ ] **Step 2: Verify**

Run: `pnpm lint && pnpm build`
Expected: unaffected (docs only), confirming a clean tree before handing back.

---

## Follow-on work (not in this plan)

| Page(s) | Why deferred |
|---|---|
| `/reports/orders`, `/reports/shop-statement`, `/reports/rider-collection`, `/reports/rider-payout`, `/dashboard` | Their date range is the whole screen and defaults to a trailing 7 days; each needs its own decision about what "default" means for a report. |
| `/users`, `/shops`, `/customers`, `/riders`, `/townships`, `/partners` | Mechanical once the pattern is reviewed; each is one schema file + a state swap. |
| Shop portal (`/shop/orders`, `/shop/statement`) | Same pattern, different layout shell; no officer workflow depends on it yet. |
| Debounced search | Separate change to how Orders commits filters (see spec, Decision 10). |
