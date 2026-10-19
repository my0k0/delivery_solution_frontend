# Implementation plan — rider handovers

**Design (approved):** `docs/superpowers/specs/2026-10-20-rider-handover-design.md`
**Repos:** `../delivery_solution_api` (NestJS 12 + Drizzle 0.45 + Postgres 16), this repo (Vite + React 19 + TS)
**Written for:** an engineer who has not seen either codebase. Where this plan names a file, a symbol or a shape, use it as written — those are decisions, not suggestions. Where it leaves a blank, pick the idiomatic thing for the file you are in.

## 0. Standing rules that override this plan

1. **Nothing is committed or pushed unless the owner asks.** The `Checkpoint` markers are *stop-and-report* points, not commits. Stage nothing.
2. **No new frontend test files** (standing owner instruction). The frontend is proven by `pnpm lint`, `pnpm build` and a real-browser pass; the pre-existing 33 tests must keep passing. **Backend spec files may be added.**
3. **No new dependencies** in either repo. Everything below uses what is installed.
4. **All API money arithmetic stays in Postgres `numeric`.** The service returns decimal strings and never re-adds them (the repo's only JS adder, `moneyAdd`, is float-based). The single frontend computation — the dialog's balance preview — uses the existing bigint helpers in `src/lib/money.ts`.
5. Preserve unrelated working-tree changes in both repos. Both repos currently have uncommitted work; do not revert or "tidy" any of it.
6. `pnpm` in both repos.

## 1. Scope check

One subsystem, one plan: a new API feature module, one additive migration, and one new frontend feature folder. It touches no existing module's behaviour — verified in Task 14 by comparing every pre-existing money figure before and after. Nothing here is split into a second plan.

## 2. What is being built

**The gap.** `orders` models *customer → rider* money exactly (`isPackagePaidToShop`, `isFeePaidToShop`, the canonical `codToCollectSql`). Nothing models *rider → office*. `GET /reports/rider-collection` is a date-ranged derivation of what *should* be in hand, so "how much does this rider owe us right now" has no answer and no handover is recorded anywhere.

**The model.**

```
deliveredCod(R) = Σ COD  over R's DELIVERED orders      (all time)
accepted(R)     = Σ amount over R's handovers
balance(R)      = deliveredCod(R) − accepted(R)          positive → rider owes
```

No allocation: one amount per handover, compared against the rider's running total, so a late handover is a non-event. Corrections are **edits in place with a required reason**, each changed field writing a `rider_handover_audit` row in the same transaction. Commission is never netted; the rider has no UI; partner and cancelled orders cannot enter the sum.

**Shape of the work.**

| layer | what is added |
|---|---|
| permission catalog | one module `rider-handovers` → `create`, `read`, `update` (13/43 → 14/46 keys) |
| database | pg enum `handover_method`, tables `rider_handovers`, `rider_handover_audit`, one additive migration |
| API | `src/rider-handovers/` — 5 endpoints under `/api/v1/rider-handovers` |
| frontend | `src/features/rider-handovers/` — one page (balances on top, history below) + one mode-driven record/edit dialog |
| nav | "Rider handovers" in the **Orders** group, after the approval page |
| separately | the approval page's label becomes **"Confirm deliveries"** (Task 12, independent) |

**Interfaces, locked.** Five endpoints, all `/api/v1`, Bearer JWT, money as decimal strings, dates as `YYYY-MM-DD`:

| method | path | request | response |
|---|---|---|---|
| `GET` | `/rider-handovers` | `riderId?`, `method?`, `dateFrom?`, `dateTo?`, `page=1`, `perPage=50` (≤500) | `{ data: RiderHandoverResponseDto[], meta: PaginationMetaDto }` |
| `GET` | `/rider-handovers/balances` | `search?`, `outstandingOnly?`, `page`, `perPage` | `{ data: RiderHandoverBalanceResponseDto[], meta }` |
| `POST` | `/rider-handovers` | `{ riderId, amount, receivedOn, method, note? }` | `201` `RiderHandoverResponseDto` |
| `PATCH` | `/rider-handovers/:id` | any of the above **plus required `reason`** | `200` `RiderHandoverResponseDto` |
| `GET` | `/rider-handovers/:id/audit` | — | `RiderHandoverAuditResponseDto[]` — a **plain array**, as built; this row said `{ data, meta }` until implementation showed `GET /orders/:id/audit` returns the trail unwrapped |

`RiderHandoverResponseDto` = `id, riderId, riderName, amount, receivedOn, method, note, recordedByName, createdAt, updatedAt`.
`RiderHandoverBalanceResponseDto` = `riderId, riderName, riderStatus, deliveredCod, accepted, balance, lastReceivedOn, oldestUnsettledDeliveredOn`.
`RiderHandoverAuditResponseDto` = `id, handoverId, field, oldValue, newValue, actorId, actorName, reason, createdAt`.

The two **list** responses (`/rider-handovers`, `/rider-handovers/balances`) use `meta: PaginationMetaDto` — **import it from `src/users/dto/user-list-response.dto.js`**. Do not add a third near-copy of the pagination shape (`OrderListMetaDto` already duplicated it once). The audit read is the exception: one handover's trail is not a paged collection, so it returns its array with no `meta`, matching `GET /orders/:id/audit`.

---

# Phase A — API foundation

### Task 1 — the permission catalog, both repos

**Files**
- `../delivery_solution_api/src/common/auth/permission-keys.ts`
- `../delivery_solution_api/scripts/seed.ts`
- `src/types/permission.ts`
- `../delivery_solution_api/src/common/auth/permission-keys.spec.ts` (new)

**Steps**

1. In `MODULE_ACTIONS`, add the entry **at the end**, after `reports`:

```ts
  'rider-handovers': ['create', 'read', 'update'],
```

   `ACTION_ORDER` **needs no new entry** — all three actions are already ordered, and this module uses only those three. (This only looks like a freebie: had corrections stayed a `void` action, the grid would have silently appended a stray column.)
2. In `scripts/seed.ts`, add the three keys to the `OFFICER` array in `GRANTS` (after `'reports.export'`). `ADMIN` is seeded from `PERMISSION_KEYS` and `OWNER` is a system role, so those two need nothing.
3. Mirror it in the frontend's hand-written union: add the same entry to `MODULE_ACTIONS` in `src/types/permission.ts`. `ACTION_ORDER` is unchanged there too.
4. The API spec asserts the counts (14 modules / 46 keys), the trio, key uniqueness and the `module.action` shape. **Do not add a frontend exhaustiveness guard:** an action missing from `ACTION_ORDER` is already tolerated by design — `buildGridLayout` sorts unknown actions into appended columns (`grant-grid.ts:48-61`) so a backend-added action shows up on its own. A guard would defend against documented, deliberate behaviour, and a type-level assertion in `types/permission.ts` is inert anyway (TypeScript does not eagerly check an exported conditional type alias).

**Verify** `cd ../delivery_solution_api && pnpm typecheck && pnpm test`
**Checkpoint** — report; commit only if the owner asks.

### Task 2 — schema: one enum, two tables

**Files (new)** `../delivery_solution_api/src/rider-handovers/rider-handover.schema.ts`, `.../rider-handover-audit.schema.ts`

**`rider-handover.schema.ts`** — declare the enum beside its table, exactly as `src/riders/rider.schema.ts` does for `RIDER_VEHICLE_TYPES`:

```ts
export const HANDOVER_METHODS = ['KPAY', 'CASH', 'BANK_TRANSFER'] as const;
export type HandoverMethod = (typeof HANDOVER_METHODS)[number];
export const handoverMethodEnum = pgEnum('handover_method', HANDOVER_METHODS);
```

Then `riderHandovers` (`'rider_handovers'`):

| column | drizzle | notes |
|---|---|---|
| `id` | `uuid('id').primaryKey().defaultRandom()` | |
| `riderId` | `uuid('rider_id').notNull().references(() => riders.id, { onDelete: 'restrict' })` | a rider with money history cannot be deleted |
| `amount` | `numeric('amount', { precision: 12, scale: 2 }).notNull()` | |
| `receivedOn` | `date('received_on').notNull()` | **no `{ mode: 'date' }`** — the default string mode is what returns `YYYY-MM-DD` |
| `method` | `handoverMethodEnum('method').notNull()` | |
| `note` | `text('note')` | the KPay reference lives here |
| `recordedBy` | `uuid('recorded_by').references(() => users.id, { onDelete: 'set null' })` | |
| `createdAt`, `updatedAt` | `timestamp(..., { withTimezone: true }).notNull().defaultNow()` | |

Extras (third argument, array form — the repo's shape):
- `check('rider_handovers_amount_non_negative', sql`${table.amount} >= 0`)` — `check` is exported from `drizzle-orm/pg-core` in 0.45 and already used by `order.schema.ts:111`;
- `index('rider_handovers_rider_received_idx').on(table.riderId, table.receivedOn)`;
- `index('rider_handovers_received_idx').on(table.receivedOn)`.

**`rider-handover-audit.schema.ts`** — mirror `src/orders/order-field-audit.schema.ts` field for field, swapping `orderId` for `handoverId`:

`'rider_handover_audit'` = `id`, `handoverId` (uuid not null → `riderHandovers.id`, `onDelete: 'restrict'`), `field` (text not null), `oldValue`/`newValue` (`jsonb().$type<unknown>()`), `actorId` (uuid → `users.id`, `onDelete: 'set null'`), `reason` (text), `createdAt`, `updatedAt`; indexes `(handover_id, created_at)` and `(actor_id)`.

**Note the two `restrict`s.** Both `rider_handovers.rider_id` and `rider_handover_audit.handover_id` refuse deletion, so a handover can never be deleted — the audit trail cannot be orphaned. That is the schema enforcing §5's "no handover is ever deleted", not just a service rule.

**Verify** `pnpm typecheck`
**Checkpoint**

### Task 3 — the migration

**Files (new)** `../delivery_solution_api/drizzle/0022_*.sql` + the updated `drizzle/meta/_journal.json` (both generated)

**Steps**

1. `pnpm db:generate` (expect the next index, `0022_`).
2. **Read the generated SQL before applying it.** It must contain exactly: `CREATE TYPE "public"."handover_method"`, two `CREATE TABLE`s, the two `restrict` FKs, the `set null` FK, the `>= 0` check, and three indexes. It must **not** touch `orders` or any existing table; if it does, stop and report — that means the schema file was written against the wrong import.
3. `pnpm db:migrate` against the dev database (`docker compose up -d`; Postgres on `localhost:5434`, database `delivery_db_mk`).

**Verify** `psql` shows the enum, both tables and the check:
```sql
\d rider_handovers
select typname from pg_type where typname = 'handover_method';
```
Then prove the check bites — this is the point of the task:
```sql
insert into rider_handovers (rider_id, amount, received_on, method)
values ('<any rider id>', -1, current_date, 'CASH');   -- must fail
```
**Checkpoint**

---

# Phase B — API behaviour

### Task 4 — DTOs

**Files (new)** under `../delivery_solution_api/src/rider-handovers/dto/`:
`create-rider-handover.dto.ts`, `update-rider-handover.dto.ts`, `list-rider-handovers-query.dto.ts`, `rider-handover-balances-query.dto.ts`, `rider-handover-response.dto.ts`, `rider-handover-balance-response.dto.ts`, `rider-handover-audit-response.dto.ts`

Copy the house style from `src/townships/dto/*` and `src/orders/dto/list-orders-query.dto.ts` (decorators on one line where the file does, `@ApiPropertyOptional` for optionals).

```ts
// create
@IsUUID() riderId: string;
@IsString() @Matches(/^\d{1,10}(\.\d{1,2})?$/) amount: string;   // same regex as township fees; no leading '-' → ≥ 0
@IsDateString() @Matches(/^\d{4}-\d{2}-\d{2}$/) receivedOn: string;
@IsEnum(HANDOVER_METHODS) method: HandoverMethod;
@IsOptional() @IsString() @MaxLength(500) note?: string;
```

`update` = every create field optional, **plus** `@IsString() @MaxLength(500) reason: string` required. `list` = the four filters + `page`/`perPage` (`@Type(() => Number)`, `@Min(1)`, `@Max(500)`, defaults 1/50). `balances` = `search?` (string), `outstandingOnly?` (`@Transform` on `'true'`/`'false'` exactly as `list-orders-query.dto.ts` does for `isPackagePaidToShop`), `page`, `perPage`.

`rider-handover-audit-response.dto.ts` mirrors `OrderFieldAuditResponseDto` (including its `oldValue`/`newValue` documentation comment) and adds `actorName: string | null`.

**Two DTOs deliberately do not exist:** there is no `amount >= 0` service check (the regex plus the DB check already make a negative unrepresentable), and no per-day or per-order field anywhere — allocation is out of scope.

**Verify** `pnpm typecheck`
**Checkpoint**

### Task 5 — the balance SQL, isolated for review

**Files (new)** `../delivery_solution_api/src/rider-handovers/handover-balance.util.ts`

Four functions, each returning one `SQL` fragment, so the arithmetic is reviewable in one place and the service stays readable. `riderColumn` is the outer query's `riders.id`; `orders` is imported so `codToCollectSql` can be reused unchanged.

```ts
export function deliveredCodSql(riderColumn: AnyPgColumn): SQL<string> {
  return sql<string>`coalesce((
    select sum(${codToCollectSql(orders)})
    from ${orders}
    where ${orders.riderId} = ${riderColumn} and ${orders.status} = 'DELIVERED'
  ), 0)::numeric(14, 2)::text`;
}

export function acceptedSql(riderColumn: AnyPgColumn): SQL<string> { /* same shape, sum(amount) over rider_handovers */ }

export function lastReceivedOnSql(riderColumn: AnyPgColumn): SQL<string | null> {
  return sql<string | null>`(
    select to_char(max(${riderHandovers.receivedOn}), 'YYYY-MM-DD')
    from ${riderHandovers} where ${riderHandovers.riderId} = ${riderColumn}
  )`;
}

export function oldestUnsettledDeliveredOnSql(riderColumn: AnyPgColumn, timeZone: string): SQL<string | null> {
  return sql<string | null>`(
    select to_char(min(settled.delivered_on), 'YYYY-MM-DD')
    from (
      select (${orders.deliveredAt} at time zone ${timeZone})::date as delivered_on,
             sum(${codToCollectSql(orders)}) over (
               order by (${orders.deliveredAt} at time zone ${timeZone})::date, ${orders.createdAt}, ${orders.id}
             ) as cumulative_cod
      from ${orders}
      where ${orders.riderId} = ${riderColumn} and ${orders.status} = 'DELIVERED'
    ) settled
    where settled.cumulative_cod > ${acceptedSql(riderColumn)}::numeric
  )`;
}
```

Three things are load-bearing and must survive review:

- **`DELIVERED` only.** `rider-collection` sums `DELIVERED ∪ AWAITING_APPROVAL`; the balance must not. AWAITING_APPROVAL cash has not been accepted by the office yet, so counting it would keep balances permanently positive and make a correct rider look short.
- **FIFO by bucketed delivery date, tie-broken `created_at` then `id`** — a total order, so same-day deliveries cannot reorder between two runs. An order is settled when the running total is `≤ accepted`; `oldestUnsettledDeliveredOn` is the first day the running total **exceeds** it.
- **`to_char(..., 'YYYY-MM-DD')`, never a bare `date`.** `min(date)` through the driver is a `Date`, and serializing that is exactly the UTC-shift bug the repo has already paid for. `to_char` is the house workaround (`reports.service.ts` lines 319/325/415/544).

No spec file was planned: a spec over SQL text pins nothing that a change wouldn't also break. **As built, one was added anyway.** `handover-balance.util.spec.ts` builds this statement against a client that never connects — and that is what catches the failure the live database caught first: every raw `sql` field inside the `.as()`-derived table needs its own `.as()` alias, or drizzle throws while *constructing* the outer `select()`, returning a 500 with no SQL sent. No mocked service spec can see that. The lesson is narrower than "test your SQL": a query *builder* can fail before the database is ever reached, and only building the statement exercises it.

**Checkpoint**

### Task 6 — the service

**Files (new)** `../delivery_solution_api/src/rider-handovers/rider-handovers.service.ts`, `rider-handovers.service.spec.ts`

Constructor mirrors `orders.service.ts:199-207`:

```ts
private readonly timeZone: string;
constructor(private readonly database: DatabaseService, config: ConfigService) {
  this.timeZone = config.get<string>('APP_TIMEZONE') ?? 'Asia/Yangon';
}
```

**Write the spec first.** `vi.fn()` mocks over `DatabaseService`, same as `townships.service.spec.ts` — the spec pins behaviour and guards, not SQL. It must cover:

1. `create` with an unknown `riderId` → `NotFoundException`.
2. `create` with `receivedOn` after today (today from `getDateInTimeZone(new Date(), 'Asia/Yangon')`, **not** `new Date().toISOString().slice(0, 10)` — the server is not in Yangon and the officer is) → `BadRequestException`.
3. `create` maps the joined row to the DTO: `riderName` and `recordedByName` present, `amount` passed through as the decimal string Postgres returned, untouched.
4. `update` with no changed field → `BadRequestException` — an empty edit must not write an empty audit row.
5. `update` writing **one audit row per changed field**, with the old and new value and the actor, in the same transaction as the update; an unchanged field writes none.
6. `getAudit` resolving a `riderId` field change to two **rider names**, not two uuids (§7.5's "no office view renders an id"), with `'Unknown'` when the rider is gone — the same treatment `orders.service.getAudit` gives identifier-valued fields.

Then implement to green:

- `list(query)` — join `riders → users` for `riderName` and `users` (recordedBy) for `recordedByName`; order `received_on desc, created_at desc`; `count(*)` for `meta`. Filters: `riderId`, `method`, `(received_on at time zone tz)::date` between `dateFrom`/`dateTo` (the reports' date-range shape).
- `balances(query)` — **riders-driven**: `riders join users` then `left join`-equivalent correlated fragments from Task 5 in the select list, so a rider with no deliveries but a handover, and a deactivated rider who still owes, both appear. Do **not** copy `rider-collection` (orders-driven, inner join on riders — it would silently drop them) and do **not** filter `users.status = 'ACTIVE'`. `balance` is computed in SQL as `deliveredCod − accepted`; `search` is `ilike` on the rider's name (use `escapeLikeWildcards` from `common/utils/normalize.util.js`); `outstandingOnly` adds `<> 0`; ordered by rider name so pagination is stable.
- `create(input, actorId)` — rider must exist; future-dated `receivedOn` refused; insert; return the row with names resolved.
- `update(id, input, actorId)` — load (404), diff against the current row, 400 if nothing changed, then one transaction: `update` + `insert` of the audit rows. `reason` is written on every audit row.
- `getAudit(id)` — the row's field history, newest first, `actorName` resolved, and a `riderId` change rendered as two rider names rather than two uuids. A flat list: grouping is the page's business, not the endpoint's.

**Never re-add money in JS.** `balance` arrives from Postgres as a string and is passed through. Do not reach for `moneyAdd`.

**Verify** `pnpm test` (the new spec) then `pnpm typecheck`
**Checkpoint**

### Task 7 — controller, module, wiring, codegen

**Files (new)** `.../rider-handovers.controller.ts`, `rider-handovers.module.ts`; **edited** `src/app.module.ts`

- Controller: `@ApiTags('Rider handovers')`, `@ApiBearerAuth('access-token')`, `@Controller({ path: 'rider-handovers', version: '1' })`, one method per endpoint with `@RequirePermissions('rider-handovers.read' | 'rider-handovers.create' | 'rider-handovers.update')`, `@Param('id', ParseUUIDPipe)`, and `@CurrentUser()` typed `AuthenticatedUser` on the two writes (`orders.controller.ts:57` is the template).
- **Route order matters:** declare `balances` and `:id/audit` before `:id` so `balances` is not swallowed by the UUID pipe.
- `rider-handovers.module.ts` provides the service and controller; add `RiderHandoversModule` to the `imports` array in `app.module.ts`. `DatabaseModule` is `@Global`, so nothing else is needed.
- Then regenerate the frontend types **with the API running**: `cd ../delivery_solution_frontend && pnpm codegen`. Confirm the seven new schemas landed in `src/types/api.ts`; the file is generated and never hand-edited.

**Verify** `pnpm lint && pnpm typecheck && pnpm test` (API), then the API booting with the new routes in `/api/v1/docs-json`
**Checkpoint**

---

# Phase C — frontend

### Task 8 — enum, validations, mappers, the one money helper

**Files (new)** `src/features/rider-handovers/handover-methods.ts`, `validations.ts`, `mappers.ts`; **edited** `src/lib/money.ts`

- `handover-methods.ts` mirrors `src/features/riders/vehicle-types.ts`: the tuple `HANDOVER_METHODS`, the derived `HandoverMethod`, `HANDOVER_METHOD_OPTIONS` **at module scope** (Base UI memoises its label map off that array's identity), and `handoverMethodLabel`. Labels: `KPAY` → "KPay", `CASH` → "Cash", `BANK_TRANSFER` → "Bank transfer".
- `validations.ts`: **one mode-aware schema**, `handoverSchema(isEditing)`:

```ts
amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter an amount like 12000.00'),
receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => value <= todayInYangon(), 'The received date cannot be in the future'),
method: z.enum(HANDOVER_METHODS),
note: z.string().max(500),
reason: isEditing ? z.string().min(1, 'A reason is required').max(500) : z.string(),
```

  Both branches of `reason` stay `z.string()` (no `.optional()`), so the inferred value type is `string` and the request body needs no `?? null`. Relax rules by *not adding* them: Zod v4 accumulates string checks, so `z.string().min(1).min(0)` still fails.
- `mappers.ts`: `EMPTY_HANDOVER`, `toHandoverFormValues(row)`, `toHandoverRequestBody(values, isEditing)` — pure, no JSX.
- `src/lib/money.ts`: add **one** exported function beside `sumMoney`, reusing the private bigint helpers:

```ts
/** Exact decimal-string subtraction on the existing bigint minor units. */
export function subtractMoney(left: string, right: string): string {
  return fromMinorUnits(toMinorUnits(left) - toMinorUnits(right))
}
```

  It exists for the dialog's balance preview only. Keep it in `src/lib/money.ts` rather than in the feature: it is general money arithmetic, and a second copy of decimal maths is how the two drift.

**Verify** `pnpm lint && pnpm build`
**Checkpoint**

### Task 9 — `api.ts`

**File (new)** `src/features/rider-handovers/api.ts`, following `src/features/townships/api.ts`

Types come from codegen (`components['schemas']['RiderHandoverResponseDto']`, …) — never hand-written, so a backend rename is a compile error. Key factory, with both tables under one root because one mutation changes both:

```ts
export const riderHandoversKeys = {
  all: ['rider-handovers'] as const,
  list: (filters: HandoverListFilters) => [...riderHandoversKeys.all, 'list', filters] as const,
  balances: (filters: HandoverBalanceFilters) => [...riderHandoversKeys.all, 'balances', filters] as const,
  audit: (id: string) => [...riderHandoversKeys.all, 'audit', id] as const,
}
```

- `useRiderHandovers(filters)`, `useRiderHandoverBalances(filters)`, `useRiderHandoverAudit(id, { enabled })` — the audit hook is **disabled until the officer expands a row**, so the list stays one row per handover and no request is wasted.
- `useSaveRiderHandover()` — one mutation for both modes (create when no `id`, `PATCH` when there is), and `onSuccess` invalidates **`riderHandoversKeys.all`**: recording or editing a handover moves the balance *and* the history, and invalidating only the list would leave the balance stale for the whole `staleTime`. Do not invalidate by hand-picked sub-keys.

**Verify** `pnpm lint && pnpm build`
**Checkpoint**

### Task 10 — the page and its surfaces

**Files (new)** `src/features/rider-handovers/RiderHandoversPage.tsx`, `components/HandoverBalancesTable.tsx`, `components/HandoverHistoryTable.tsx`, `components/HandoverDialog.tsx`, `components/HandoverForm.tsx`

**Page** (`RiderHandoversPage.tsx`) owns filters, the two queries and the composition — no table markup, no inputs. Section order is the officer's order of work:

1. **Balances first** — Rider (+ status badge) | Delivered COD | Accepted | Outstanding | Oldest unsettled | Last handover | Record.
   - money via `formatDecimalAmount` (`@/lib/utils`), the same formatter the Orders surfaces use, right-aligned `font-mono tabular-nums`;
   - rider status through `userStatusLabel` / `userStatusTone` from `src/lib/constants/user-status.ts` — do not re-derive a status map;
   - `balance` negative reads **"Company holds X"** with the warning tone (`badgeClass('warning')`), never a bare minus sign;
   - `oldestUnsettledDeliveredOn` null shows an em dash;
   - the **Record** button per row is rendered only under `rider-handovers.create`, and opens the dialog with that rider fixed.
2. **History below** — Rider | Received | Method | Amount | Note | Recorded by | flags, with filters for rider, method and a received-date range, then pagination.

**Tables** take rows + a callback as props and render nothing stateful themselves. The history table renders a "corrected" flag on rows where `updatedAt !== createdAt` (that is exactly what `updatedAt` moving means) and a History toggle that expands a full-width row containing the audit trail — fetched lazily by the disabled-until-open hook from Task 9.

**Dialog** (`HandoverDialog.tsx`) owns the copy, which mutation runs and the toasts, and contains **no inputs**: `open`/`onClose` as flat props (never a `state={{ open, x }}` wrapper), title "Record cash handover" or "Correct handover", and a submit that runs `useSaveRiderHandover`. It shows the current balance and **previews the balance the entry will produce** using `subtractMoney(balance, amount)` — computed only when the field parses as an amount, so a half-typed value previews nothing rather than previewing a wrong number. That way an over-recording is visible before it is saved rather than only after. `handleClose` calls `form.reset(formValues)`; `useForm({ values })` re-seeds when the target row changes, so there is **no `key={...}` remount hack**.

**Form** (`HandoverForm.tsx`) exports one component, `HandoverFormFields()` — fields only, reading `register`/`control`/`errors` from `useFormContext`, taking only what it cannot derive (`isEditing`, the fixed rider). Rider is a field on create and **fixed text** on edit (the rider can be corrected, but the balance preview is computed against the row's rider, so leaving it as a select on a row opened from the balances table is the confusing case). Layout inside `<Form>`: `DialogHeader` (pinned) → `FormBody` (**the only scroll region, inside `<Form>`**) → `FormAlert` → `FormFooter` (pinned).

**Note the dialog gotchas in this repo, all of which have already shipped a bug once:** `FormBody` must be *inside* `<Form>` or the submit button submits nothing; every element between the popup and the scroll region needs `min-h-0` or `overflow-y-auto` silently never engages; and a controlled `Select` needs its options to include the current value or Base UI shows a raw value.

**Verify** `pnpm lint && pnpm build`, then a real-browser pass (Task 14) — **not** jsdom, which has no layout engine and will happily "pass" an unscrollable dialog.
**Checkpoint**

### Task 11 — route and nav

**Files (edited)** `src/App.tsx`, `src/config/navigation.ts`

- `App.tsx`: import `RiderHandoversPage` and register it inside `AppShell` behind the existing gate idiom:
  `<Route element={<ProtectedRoute perm="rider-handovers.read" />}><Route path="/rider-handovers" element={<RiderHandoversPage />} /></Route>`
- `navigation.ts`: add to the **`orders` group**, after the approval item:
  `{ to: "/rider-handovers", label: "Rider handovers", icon: HandCoins, permission: "rider-handovers.read" }`
  `HandCoins` is available from `lucide-react`; `WalletCards` is already taken by Rider payout, and reusing it would imply the two are the same kind of page (one pays out, this one pays in). Ordering the three items Orders → Confirm deliveries → Rider handovers is the officer's working order: the order, the approval, the money.

The group is permission-filtered already, so an OFFICER without the new keys sees no new item and `firstAllowedPath` needs no change.

**Verify** `pnpm lint && pnpm build` + browser: the sidebar shows the item in the Orders group and the page renders for an OFFICER who holds the keys.
**Checkpoint**

### Task 12 — the approval page's label (independent)

**Files (edited)** `src/config/navigation.ts`, `src/features/orders/ApprovalQueuePage.tsx`, plus doc references

The nav label `"Approval queue"` becomes **`"Confirm deliveries"`** — the old one named a mechanism rather than the work, and the page is where an officer checks and accepts what a rider marked delivered. Sentence-cased to match every other label in the file.

- Page heading moves with it; if the heading and the nav label are separate strings today, keep them consistent.
- **The route stays `/orders/approval`** (breadcrumbs, links and any bookmarks keep working) and the permission stays `deliveries.approve`.
- Sweep the references: `grep -rn "Approval queue"` across both repos and update prose that names the label. `docs/delivery-workflow-v2.md` exists in both repos and must stay byte-identical — edit it here and copy it across (Task 13 shows how).
- Ships independently: it shares nothing with the rest of this plan and can land before, with, or after it.

**Verify** `pnpm lint && pnpm build` + a browser glance at `/orders/approval`
**Checkpoint**

---

# Phase D — docs and verification

### Task 13 — documentation

**Files (edited)** `CLAUDE.md`, `docs/business-flows.md`, `docs/delivery-workflow-v2.md`, `PLAN.md` (both repos)

1. `CLAUDE.md` — the permission paragraph says **13 modules / 43 keys**: make it 14 / 46 and add `rider-handovers` (`create`/`read`/`update`) to the module list, noting the module is `rider-handovers` while the nav label is "Rider handovers" (the same shape as `partners` → "Delivery partners"). Add `features/rider-handovers/` to the feature-folder list and the new page to the rider/orders description.
2. `docs/business-flows.md` — a short section describing the money path as it now is: customer → rider (unchanged), rider → office (handover rows, the running balance, edits with a required reason and per-field history, and what the balance deliberately is *not* — no ledger, no reconciliation, no write-off).
3. `docs/delivery-workflow-v2.md` — add the five endpoint rows so the API reference stays complete. This file is byte-identical in both repos: after editing, `cp docs/delivery-workflow-v2.md ../delivery_solution_api/docs/delivery-workflow-v2.md` and confirm with `diff -q`. (`docs/business-flows.md` exists only in this repo.)
4. `PLAN.md` in both repos — record the feature as shipped-under-this-plan, and that Phase 6 (ledger/reconciliation) is still blocked and now has one less excuse for being asked for.

**Verify** `diff -q docs/delivery-workflow-v2.md ../delivery_solution_api/docs/delivery-workflow-v2.md` is silent.
**Checkpoint**

### Task 14 — verification, the whole story

Automated, in order:

```
cd ../delivery_solution_api && pnpm lint && pnpm typecheck && pnpm test     # 142 existing + the new spec(s)
cd ../delivery_solution_frontend && pnpm lint && pnpm build && pnpm test    # 33 existing tests
```

Then **the SQL cross-check**, which is where the balance arithmetic is actually proven — the one thing no unit spec can reach:

- Pick a rider with delivered orders. Confirm `deliveredCod` from `/rider-handovers/balances` equals the sum over exactly their `DELIVERED` orders of the canonical COD expression, and that it is **not** equal to `rider-collection`'s all-status figure when that rider has an `AWAITING_APPROVAL` order (if none exists, create one — the difference is the whole point of the narrowed filter).
- Confirm `oldestUnsettledDeliveredOn` against a hand-computed FIFO walk for a rider with two delivery dates and a short handover: the date returned must be the first date the running total exceeds `accepted`.

Then **the browser pass** (Playwright MCP tools, against the API on `:3000` and Vite on `:5173`) — not jsdom, which cannot fail any of these:

1. An OFFICER holding the three new keys sees "Rider handovers" in the Orders group; a role without them sees neither the item nor the page (403 via the route gate).
2. The permission grid renders the **14th** module and the OFFICER row has the three keys checked.
3. Record a handover equal to a rider's outstanding balance → the balance reads `0.00`, `oldestUnsettledDeliveredOn` is an em dash, and **the history list and the balances table both update without a manual refresh** (the cross-key invalidation).
4. Record a short handover → the balance stays positive and carries an age from the earlier delivery date.
5. Edit it → the reason is **required** (submitting without it is blocked), the balance moves, and the row's History shows the old value, the actor and the reason.
6. Set one to `0.00` with a reason → the balance returns exactly to its earlier value; the row stays visible.
7. Record against a rider with no deliveries → "Company holds X" in the warning tone.
8. Rejections: a future `receivedOn`, a negative `amount`, and an edit with no changed field — all refused, with a readable message.
9. The dialog at 375px wide and on a 13" viewport: it scrolls, the Save button is reachable, nothing overflows horizontally.
10. **Nothing else moved:** re-read one order's COD/net tiles, one shop-settlement badge, and `/reports/rider-collection` for the same date range, and confirm each is identical to what it read before this work.

Report which of these were observed and which were reasoned — and say plainly if a step could not be performed.
