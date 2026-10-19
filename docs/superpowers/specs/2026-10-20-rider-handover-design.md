# Design — rider handovers (the cash a rider hands back)

**Date:** 2026-10-20
**Repos:** `delivery_solution_api` (NestJS, Drizzle, Postgres), `delivery_solution_frontend` (Vite + React + TS)
**Companion:** `docs/business-flows.md` describes the system as it is today. This document describes one addition to it.
**Status:** designed, **not built**. No code, migration, seed or UI until the business owner approves.

---

## 1. Intent and why

The company's money path with a rider has two halves, and only the first exists.

- **Customer → rider.** `orders.isPackagePaidToShop` / `orders.isFeePaidToShop` and the canonical `codToCollectSql` expression decide exactly what the rider collects at the door. This is modelled and correct.
- **Rider → office.** Nothing records that the rider handed that cash over.

`GET /reports/rider-collection` computes, per rider per day, `expectedCodToHandBack` (COD of `DELIVERED` orders) and `awaitingApprovalCod`. It is a derivation of **what should be in hand on a given day**, and it resets with the date range. So the two questions the office actually asks have no answer:

- *"How much does this rider owe us right now?"* — a cumulative figure, and no report produces one.
- *"Did he hand yesterday's money in?"* — nothing records a handover at all.

This design adds the missing half: a small record of cash received from a rider, plus the derived running balance per rider. It stays inside the delivery system — no payout, no salary, no wallet (owner's scope call, §2.1).

## 2. Confirmed business rules (from the business owner, 2026-10-20)

1. **Commission is never netted.** Riders are paid commission with their salary, outside this system. A handover is the **full COD collected**, never "COD minus commission". Salary and payout are out of scope for this design.
2. **Approval comes first, cash second.** Cash is only accepted for deliveries the office has already approved, so the balance counts `DELIVERED` orders only. `awaitingApprovalCod` stays a report figure and is never a balance input.
3. **The rider has no surface.** The handover is a physical act; the **officer** who counts and accepts it is the only actor, and his acceptance *is* the record.
4. **The officer compares against the rider's total collected**, not against a single day. Late handover is normal: riders usually transfer from home in the evening, sometimes the next day.
5. **Handovers are mostly KPay transfers.** Cash in person is the exception; online banking is the third case.
6. **No historical data to preserve.** The system is pre-launch and the owner is content to wipe and re-seed. There is therefore **no opening balance and no cutover date** — balances start from an empty database.
7. **A delivered order can never be un-delivered** (terminal status; `PATCH /orders/:id` refuses it with 409) **and its COD can never change** afterwards. A rider's expected total therefore only ever grows, and a negative balance can only come from a recording mistake.
8. **No allocation.** One amount per handover — not per order, not per day.

## 3. Goals

- Record every handover: rider, amount, the date the office received it, the method, a note, and who recorded it.
- Answer *"how much does this rider owe us right now?"* from one page.
- Show **how old** the outstanding amount is, so a rider who is merely late tonight is not confused with one who is in real arrears.
- Let a mistake be corrected without destroying the trail.
- Change no existing figure, report, permission or order surface.

## 4. Non-goals

- No rider-facing UI, no rider wallet, no rider float or advance.
- No commission, salary or payout change. The rider-payout report is untouched.
- No per-order cash attribution ("this handover covered orders X, Y, Z").
- No per-day matching and no daily reconciliation.
- No general ledger, double-entry accounting, bank/KPay statement import or reconciliation. Phase 6 stays blocked (v2 §2 decision 22).
- No receipts, PDFs or proof uploads. A handover is a money fact, not a document store.
- No multi-currency, no payment gateway, no invoicing.
- No write-off or forgiveness mechanism for a departed rider's balance.

## 5. Anti-goals (what must not happen)

- **No existing money figure changes.** COD to collect, net owed to shop, the shop settlement state, every report row, total and export must be byte-identical after this ships.
- **No handover is ever deleted.** A correction is an edit in place with a required reason, and every changed field keeps its old value, the actor and the reason (§7.4).
- The expected total must never be computed from `AWAITING_APPROVAL` orders, from cancelled orders, or from partner orders.
- No change to `orders`, no new order status, no new order transition.
- The balance must never be presented as a payment ledger, a reconciled bank figure, or as company cash for shop-settlement purposes.

## 6. Constraints

- Money stays `numeric(12, 2)` in Postgres and decimal strings over the wire; aggregate sums cast `::numeric(14, 2)::text`, exactly as the reports do.
- Dates the officer enters are `date` columns sent and returned as `YYYY-MM-DD` — never ISO-sliced.
- Day bucketing uses the API's report timezone (`at time zone <api timezone>`), the same expression `rider-collection` uses for its daily rows.
- The permission catalog is fixed and seeded from `MODULE_ACTIONS`; adding a module is a code change plus a re-seed, and the frontend's typed union mirrors it.

## 7. The model

### 7.1 The balance

For rider *R*:

```
deliveredCod(R) = Σ codToCollectSql(order)
                  where order.riderId = R and order.status = 'DELIVERED'

accepted(R)     = Σ amount
                  where handover.riderId = R

balance(R)      = deliveredCod(R) − accepted(R)
```

- Positive → the rider owes that much.
- `0.00` → clear.
- Negative → the company holds that much. By §2.7 that is a recording mistake, never a business event.

Partner orders carry `riderId = null` and drop out on their own. Cancelled orders never reach `DELIVERED`, so they are excluded twice over. `deliveredCod` is `rider-collection`'s `expectedCodToHandBack` with the status filter narrowed from `DELIVERED ∪ AWAITING_APPROVAL` to `DELIVERED`, and the totals are all-time rather than date-ranged.

**Computed in SQL, never in JavaScript.** Both sums, the difference and the FIFO running total are Postgres `numeric` expressions, reusing `codToCollectSql` unchanged and casting `::numeric(14, 2)::text` on the way out. The service returns decimal strings and never re-adds them: the repo's only JS money adder is `moneyAdd` (`Number(a) + Number(b)`), which is acceptable for the two-term shop statement and wrong for a cumulative balance.

**The balances query is riders-driven, not orders-driven.** It walks `riders → users` with a `LEFT JOIN` to the delivered COD and another to the handovers, so a rider with no deliveries but a handover (§8.7) and a deactivated rider who still owes (§8.8) both appear. Neither existing template can be copied: `rider-collection` is orders-driven with an `INNER JOIN` on riders and would silently drop them, and the existing riders lookups hard-filter `users.status = 'ACTIVE'`.

### 7.2 Schema — two new tables

`rider_handovers`:

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `rider_id` | uuid not null → `riders.id`, `on delete restrict` | same FK behaviour as `orders.rider_id`: a rider with money history cannot be deleted |
| `amount` | numeric(12,2) not null, check `>= 0` | the cash received; `0.00` is what a duplicate or a reversed transfer becomes (§7.4) |
| `received_on` | date not null | **the day the office received it**, not the day it was collected |
| `method` | `handover_method` not null | `KPAY` / `CASH` / `BANK_TRANSFER` |
| `note` | text null | free text; the KPay reference goes here |
| `recorded_by` | uuid null → `users.id`, `on delete set null` | the officer who accepted it |
| `created_at`, `updated_at` | timestamptz not null default now() | house style |

Indexes: `(rider_id, received_on)` for the history list and the balance join, plus `(received_on)` for date-range filtering.

A new pg enum `handover_method` is declared **in `src/rider-handovers/rider-handover.schema.ts`, beside its table**, exactly as `RIDER_VEHICLE_TYPES` / `riderVehicleTypeEnum` sit beside the riders table in `src/riders/rider.schema.ts`: tuple → derived union → pg enum. The *frontend* mirror (`src/features/rider-handovers/handover-methods.ts`) carries the tuple, the derived union, `*_OPTIONS` and the label helper, the way `src/features/riders/vehicle-types.ts` does.

And a second small table, `rider_handover_audit`, mirroring `order_field_audit` field for field — `handover_id` (`on delete restrict`), `field`, `old_value` (jsonb), `new_value` (jsonb), `actor_id` (`on delete set null`), `reason`, `created_at`. One row per changed field per edit, written in the same transaction as the update. That is where the previous value of a corrected amount lives, and it is what lets the row be read as a history rather than only as its current state.

Indexes on the audit table follow `order_field_audit`: `(handover_id, created_at)` and `(actor_id)`.

### 7.3 Money rules

- One handover is one row, one amount, one method. A mixed handover (part cash, part transfer) is two rows.
- `amount` is never negative. `0.00` is legal and means "this row no longer counts" — how a duplicate or a reversed transfer is expressed (§7.4). A *balance* that goes negative is a different thing: a mistake to fix, not a state the system treats as meaningful.
- The three methods are descriptive only — they change no arithmetic and no report total.
- Nothing is allocated: the balance is the difference of two sums, in either direction.

### 7.4 Corrections: edit in place, with history

Owner's call, 2026-10-20. The alternative (void the row, record a fresh one) was designed first and rejected: one row per handover reads better at the counter.

- Every field stays editable — rider, amount, date, method, note — and **an edit requires a reason**.
- Each changed field writes a `rider_handover_audit` row (old value, new value, actor, reason, when) in the same transaction, so nothing is lost and the change stays visible on the row itself rather than in a log nobody opens.
- A duplicate entry, or a KPay transfer the rider reverses, has no "correct number" to edit to. The amount becomes **`0.00`** and the reason records what happened: *"duplicate of the 14th"*, *"transfer reversed"*. The row stays visible and the balance maths is unaffected.
- This is the repo's existing pattern, not a new idea: `order_field_audit` already carries every field change on an order, including the shop advance.
- **What we accept by choosing this:** a figure someone read yesterday can read differently today. The mitigation is that the change, its actor and its reason sit on the row.
- The row's history is fetched per handover (`GET /rider-handovers/:id/audit`), the same shape the order detail page already uses, so the list itself stays one row per handover.

### 7.5 API surface

All `/api/v1`, Bearer JWT. Money as decimal strings, dates as `YYYY-MM-DD`. Every response resolves names server-side (`riderName`, `recordedByName`, and the audit's `actorName`) — no office view renders an id.

| method | path | notes |
|---|---|---|
| `GET` | `/rider-handovers` | filters `riderId`, `method`, `dateFrom`, `dateTo`, `page`, `perPage` → `{ data, meta }`; newest first by `received_on`, then `created_at` |
| `GET` | `/rider-handovers/balances` | per rider: `riderId`, `riderName`, `riderStatus`, `deliveredCod`, `accepted`, `balance`, `lastReceivedOn`, `oldestUnsettledDeliveredOn`; filters `search` (rider name), `outstandingOnly` (`balance <> 0.00`); paginated like the list |
| `POST` | `/rider-handovers` | `{ riderId, amount, receivedOn, method, note? }` → 201 row |
| `PATCH` | `/rider-handovers/:id` | `{ riderId?, amount?, receivedOn?, method?, note?, reason }` → 200 row; 404 if unknown. Any subset of fields; **`reason` is always required** |
| `GET` | `/rider-handovers/:id/audit` | the row's field history, newest first — mirrors `GET /orders/:id/audit` |

**List row** (`GET /rider-handovers`): `id`, `riderId`, `riderName`, `amount`, `receivedOn`, `method`, `note`, `recordedByName`, `createdAt`, `updatedAt`. Because `updatedAt` only moves on an edit, the list can flag a corrected row (`updatedAt !== createdAt`) without carrying the audit trail itself.

**Pagination** follows `OrderReportQueryDto`: `page` default 1, `perPage` default 50, maximum 500. The balances endpoint uses the same defaults so the two tables behave alike.

Validation: `amount` a decimal string `>= 0` with at most 2 decimals; `receivedOn` a real date **not in the future**; `riderId` must exist (404 otherwise); `method` within the enum; `note` ≤ 500; `reason` required on every edit, ≤ 500. An edit that changes nothing is rejected rather than writing an empty audit row.

### 7.6 The age of the balance

The balance alone cannot tell "he transfers every night and tonight is no different" from "he has owed this for two weeks". With partial handovers, `lastReceivedOn` alone hides the second case too: a rider who transfers a token amount today looks current.

So the balances endpoint also returns **`oldestUnsettledDeliveredOn`**: the delivery date of the oldest delivery still carrying part of the balance, computed on the convention that cash settles **oldest deliveries first** (FIFO by delivery date over the rider's delivered orders, cumulative COD against `accepted`). It is derived on read — nothing is stored, so there is no allocation to keep in sync. Precisely:

- Take the rider's `DELIVERED` orders, one row each, with their COD.
- Their date is the bucketed delivery date, `(delivered_at at time zone <api timezone>)::date` — the same expression `rider-collection` uses, so the two reports never disagree about which day a delivery belongs to.
- Order by that date, then by `created_at`, then by `id` — a total order, so same-day deliveries can never reorder between two runs.
- Walk the running total; an order is **settled** while the running total up to and including it is `≤ accepted`. `oldestUnsettledDeliveredOn` is the date of the first order where the running total **exceeds** `accepted`, i.e. the first order a short handover did not fully cover.

It is `null` when the balance is `0.00` or negative ("nothing outstanding"). No threshold and no configurable aging: the page shows the date, and the officer judges.

### 7.7 Permissions

One new module in `MODULE_ACTIONS`:

```ts
'rider-handovers': ['create', 'read', 'update'],
```

That takes the catalog from **13 modules / 43 keys to 14 / 46**. The frontend's hand-written mirror (`src/types/permission.ts`) moves with it, so a rename stays a compile error. Two things worth stating explicitly:

- `MODULE_ACTIONS` gains the module in both repos. **`ACTION_ORDER` needs no new entry** — this module uses the standard `create` / `read` / `update` trio, all three already ordered. (Had corrections stayed as a `void` action it would have needed a new entry, and the grid would have tolerated the omission silently by appending a stray column.)
- **One name, three surfaces:** the catalog module is `rider-handovers`, the API path is `/rider-handovers`, the nav label is "Rider handovers". That is the existing shape for this repo, not a new inconsistency — the `partners` module is served at `/delivery-partners` and labelled "Delivery partners".

Seeds (`scripts/seed.ts`): OWNER holds everything (system role) and ADMIN is seeded from `PERMISSION_KEYS`, so only OFFICER's explicit list needs the three new keys — the officer is the actor by §2.3. An existing database needs them granted once through the permission grid, or a re-seed.

### 7.8 Frontend surfaces

- Route `/rider-handovers`, gated `rider-handovers.read`, nav item **"Rider handovers"** in the **Orders** group after the approval page — owner's call, 2026-10-20: the officer who approves deliveries is the officer who takes the cash, so the two belong together. (The designer had put it under Reports beside "Rider collection" and called it "Rider remittances"; both overridden.)
- New feature folder `src/features/rider-handovers/`: `api.ts` (key factory + hooks), `validations.ts` (one mode-aware schema), `mappers.ts` (DTO ↔ form state, pure), `handover-methods.ts` (enum source of truth), `RiderHandoversPage.tsx`, `components/HandoverDialog.tsx` + `components/HandoverForm.tsx`.
- **One dialog for record and edit**, mode-driven: create and edit share every editable field (rider, amount, date, method, note), and edit adds the required `reason`. That is the users pattern, not the roles pattern — the roles rule about two forms applies only when the modes share no editable field. `handoverSchema(isEditing)` keeps the reason required on edit and absent on create, and the dialog is seeded from the row when editing.
- **Page:** the balances table first — Rider | Delivered COD | Accepted | Outstanding | Oldest unsettled | Last handover | Record — then the handover history with rider/date/method filters. Amounts use the shared `formatDecimalAmount`; a negative balance reads **"Company holds X"** in the warning tone; a row whose `updatedAt` moved past its `createdAt` shows a quiet "corrected" flag, and expanding it loads the field history from the audit endpoint.
- **Dialog:** rider fixed from the row, showing the current balance and previewing the balance the entry will produce, so an over-recording is visible *before* it is saved rather than only after.
- The dialog/form split follows the repo rules: `XDialog` owns copy, mutation and toasts; `XFormFields` owns fields only; `mappers.ts` holds the translation; reset on close; `FormBody` inside `Form`; one schema per entity.
- `/reports/rider-collection` is **not changed** — per-day expected COD answers a different question from the running balance.

**Wiring, so it is not left to the builder's taste:** the API registers the feature module in `app.module.ts` alongside the other features (`DatabaseModule` is `@Global`, so nothing else is needed); the frontend registers `/rider-handovers` in `App.tsx` wrapped in `<ProtectedRoute perm="rider-handovers.read">`, and the nav item is added to `NAV_GROUPS` in `src/config/navigation.ts`. Recording or editing a handover changes **both** the history list and the balances table, so the mutations invalidate both query keys — cross-key invalidation is mandatory in this repo, and invalidating only the list would leave the balance stale for the whole `staleTime`.

**Separate, independent change — the approval page's label.** Owner's call (2026-10-20): the nav label **"Approval queue"** becomes **"Confirm deliveries"**, sentence-cased like every other nav label in `navigation.ts`. Only the label and the page heading move; the route stays `/orders/approval` and the permission stays `deliveries.approve`, so it is a copy change plus the doc references. It is bundled with nothing in this design and can ship before, with, or after it.

## 8. Edge cases

| # | case | behaviour |
|---|---|---|
| 1 | Handover arrives the next day | Normal. The balance simply clears later; nothing is allocated or re-dated. |
| 2 | Several days paid in one transfer | One record. |
| 3 | Short handover | Recorded as-is. The balance stays positive and carries its age. |
| 4 | Duplicate entry | Edit that row's amount to `0.00` with the reason "duplicate of the 14th". |
| 5 | Reversed / bounced transfer | Edit the amount to `0.00` with the reason "transfer reversed"; the balance returns to its earlier value and the row's history keeps the reversal. |
| 6 | `accepted` exceeds `deliveredCod` | Allowed and labelled "Company holds X". A mistake to fix, not a block — blocking would trap the officer when the error *is* the entry. |
| 7 | No deliveries, but a handover | Visible as a negative balance (almost always the wrong rider). Fix the rider if that was the error, or set the amount to `0.00` if the money was never received. |
| 8 | Rider deactivated | The balance stays visible so arrears are not lost; late cash can still be recorded. |
| 9 | Rider deletion | Blocked at the FK while handovers exist. Be aware the existing delete path issues a bare `delete` inside a transaction with no constraint handling, so this surfaces as a raw Postgres error rather than a clean 409 — the same rough edge `orders.rider_id` already has. Softening it is a separate improvement, deliberately not bundled here. |
| 10 | Partner deliveries | `rider_id` is null; never part of any rider's balance. |
| 11 | Delivery sent back before approval | Never `DELIVERED`, never counted — and by §2.2 it never carried cash. |
| 12 | Cancelled order | Never `DELIVERED`; excluded already. |
| 13 | Rider leaves owing money | The balance stays on the page. No write-off (out of scope). |
| 14 | Future-dated or zero amount | Rejected by validation. |

## 9. Migration, seeding and verification

- **One additive migration:** the enum, the two tables, the indexes. No change to `orders`, no backfill, no data seeding.
- **Seeds:** the catalog picks `rider-handovers.*` up from `MODULE_ACTIONS` automatically; OFFICER's explicit grant list gains the three keys. The dev database may be wiped and re-seeded (owner's call, §2.6).
- **Verification:** API `pnpm lint`, `pnpm typecheck` and the existing suite; frontend `pnpm lint`, `pnpm build` and the existing 33 tests. Then a manual smoke against a real rider with delivered COD: confirm the permission grid renders the new 14th module and that an OFFICER holds the three keys; record a handover matching the balance and confirm it clears; record a short one and confirm the balance and its age; edit it and confirm the balance moves, the `reason` was required, and the old value is in the row's history; set one to `0.00` and confirm the balance returns; record one against a rider with no deliveries and confirm "company holds"; confirm a future date, a negative amount and an edit with no reason are all rejected; confirm `/reports/rider-collection` and every order figure are byte-identical to before.

## 10. Decisions resolved with the business owner (2026-10-20)

1. Full COD handed over; commission is never netted (it rides on salary, outside the system).
2. Approval first, cash second — the balance counts `DELIVERED` only.
3. The officer records; the rider has no surface.
4. Comparison is against the rider's running total, so late handovers need no special handling.
5. KPay is the usual method, cash in person the exception, online banking the third.
6. Pre-launch: data may be wiped and re-seeded, so no opening balance and no cutover.
7. No per-order and no per-day allocation.
8. Commission, salary, payout and per-order attribution are out of scope.
9. Corrections are **edits in place with a required reason**, keeping the old value and the actor on the row (§7.4). Voiding the row and recording a replacement was offered first and rejected.
10. **Naming and placement:** the feature is **"Rider handovers"** — `rider-handovers` across the nav label, route, permission module, API path and feature folder — not "remittances", and it sits in the **Orders** group. Separately, the existing approval page's nav label becomes **"Confirm deliveries"**.

## 11. Calls made by the designer (override freely)

1. **Edit in place, with a per-field audit table** (§7.4) — the owner's choice over void-and-re-record. It is the repo's existing pattern (`order_field_audit`) and it costs one extra table.
2. **`oldestUnsettledDeliveredOn` via oldest-first FIFO** (§7.6) rather than an aging threshold or a stored allocation.
3. The **balances endpoint lives in the rider-handovers module** and is gated `rider-handovers.read`, not `reports.read`.
4. The **new page is the balance's home**; `/reports/rider-collection` is untouched.
5. ~~Nav placement under **Reports**, beside "Rider collection".~~ **Overridden by the owner (2026-10-20):** it goes in the **Orders** group, after the approval page, because the officer who approves a delivery is the officer who takes that rider's cash.
6. **`BANK_TRANSFER` is kept** even though KPay dominates today.
7. **No method filter on the balance table** — method belongs to the history list.
8. The **KPay reference goes in `note`**; no structured reference column until something reconciles against a statement.
9. **`received_on` is the date received**, never the collection date, which is what makes next-day handovers a non-event.
10. **No write-off mechanism** for a departed rider's balance.
11. **All money arithmetic stays in SQL.** The API returns decimal strings and never re-adds them, because the repo's only JS adder is float-based (`moneyAdd`).
12. **The balances query is riders-driven with `LEFT JOIN`s**, so a rider with no deliveries but a handover, and a deactivated rider with a balance, both appear.
13. **`oldestUnsettledDeliveredOn` is FIFO by bucketed delivery date**, tie-broken by `created_at` then `id`, with an order settled exactly when the running total is `≤ accepted`.
14. **A duplicate or a reversed transfer becomes a `0.00` row**, not a deletion — which is why `amount` is checked `>= 0` while a *balance* below zero stays a mistake.

## 12. Still open

Nothing blocks the build. Deliberately later: write-offs, per-order attribution, and any reconciliation against a KPay statement or bank account.

## 13. Post-approval adjustments (2026-10-20, after the first live pass)

Direction from the owner once the feature was in use. None of these changes the model in §7; they change how the page presents it.

1. **Recording starts from the rider's row, not a page-level button.** The header "Record handover" button is gone. This also restores §7.8's intent — the rider is fixed on create and a choice only on a correction — which the first build had loosened to an editable select on both modes. An editable select there was a lie: the preview kept the opening row's balance while the rider under it changed.
2. **The preview is labelled "Outstanding amount"**, not "Balance", matching the balances table's column.
3. **An amount above the outstanding amount asks for a confirmation** — it is not refused, because cash before approval is real, and it is not silent, because a mistyped amount otherwise only shows up as a smaller balance. The confirmation names the balance, the amount and the difference. Corrections are not gated this way; they already require a reason.
4. **The audit trail reads oldest first**, matching `GET /orders/:id/audit` (the endpoint's order changed with it), so the newest correction is the last line.
5. **Each trail line shows the time as well as the date**, because two corrections of one handover on the same day are otherwise indistinguishable.
6. **The row flag reads "Modified"**, not "Corrected" — the page's verb for this action is *modify*, and the flag describes the row, not the workflow.

