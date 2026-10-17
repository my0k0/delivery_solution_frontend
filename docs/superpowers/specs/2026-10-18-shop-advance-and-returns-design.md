# Design — shop advances (Phase 1) and returns/reclaims (Phase 2)

**Date:** 2026-10-18
**Repos:** `delivery_solution_api` (NestJS, Drizzle, Postgres), `delivery_solution_frontend` (Vite + React + TS)
**Companion:** `docs/business-flows.md` describes the system as it is today. This document describes one addition to it.
**Status:** designed, **not built**. Nothing here has been implemented.

---

## 1. Intent and why

The delivery company has a money relationship with each shop that goes in **two directions**, and only one of them exists in the system today.

- **Customer → shop.** Online-shop customers sometimes pay the package price and/or the delivery fee to the shop up front. This is modelled by `orders.isPackagePaidToShop` and `orders.isFeePaidToShop`, and it drives **COD** — what the rider collects. Confirmed correct as built.
- **Company → shop.** For a **COD** order (the customer has not paid the shop), the company **advances the shop the package price** so the shop is not left waiting. It advances the package price only, never the delivery fee. This is **not modelled at all**.

Because the second direction is missing, nobody can answer *"which orders for this shop have we advanced, and which have we not?"* — and the settlement figures cannot tell "already settled by us" from "we still owe this".

**The work is staged.**

- **Phase 1 — the advance.** Record what the company paid each shop, and let it reduce what we owe. Independently useful, and it is what most of this document specifies.
- **Phase 2 — returns and reclaims.** A package that comes back leaves the company out of pocket. Designed in §8, **deferred** pending a client discussion, and not to be built now.

## 2. Confirmed business rules (from the business owner)

1. `isPackagePaidToShop` / `isFeePaidToShop` mean **what the customer paid the shop in advance**. Their arithmetic and COD effect stay exactly as built.
2. On a **COD** order the company **advances the shop the package price** — not the delivery fee.
3. There is currently **no** shop↔company prepaid/return relation of any kind.
4. The advance is always **exactly the package price** (no negotiated or partial figures).
5. The **return** half needs a client discussion first, so it is Phase 2.
6. **An order only exists once the package physically reaches the delivery office.** Officers create it when the goods arrive from the shop; it then sits `PENDING` (unassigned — customer unavailable, or another reason) or `ASSIGNED`. There is therefore **no "package never left the shop" case**: the company holds the goods from the moment the order exists, so **every cancelled order implies a package that must be handed back**.

## 3. Goals — Phase 1

- Record, per order, **that and when** the company paid the shop.
- Make the settlement figures reflect it, so an advanced order reads as settled rather than as still-owed.
- Answer *"which orders for this shop are not yet advanced?"* from the orders list.
- **Change no existing figure.** Every order today has no advance, so its numbers must be byte-identical before and after.

## 4. Non-goals

**Phase 1 non-goals (these are Phase 2):**

- Recording a physical return (`returned_to_shop_at`).
- Reclaiming money from a shop, in whole or in part.
- Any shop-portal surface for money owed back.

**Permanent non-goals:**

- No general ledger, double-entry accounting, or bank reconciliation. v2 §2 decision 22 keeps Phase 6 **blocked**; this design does not open it.
- No partial customer payments.
- No multi-currency, no payment gateway, no invoicing.
- No reopening of the `CANCELLED`/`RETURNED` merge (v2 §2 decision 4).

## 5. Anti-goals (what must not happen)

- The **COD formula must not change**, and the meaning of `isPackagePaidToShop` / `isFeePaidToShop` must not be reinterpreted.
- **No historical restatement.** A fixed shop + date range must return identical figures after the migration.
- **No new order status.** The state machine, the transition matrix, and every existing state-derived report must keep working untouched.
- The **shop portal redaction rules must hold** — no rider/partner identity, partner cost, or internal notes leak into any new shop-facing field.
- **The advance must not be an override.** Nothing may let an officer set it to a number other than the package price, and no code path may write it as anything but a snapshot of the package price at the moment of the advance. If a later `packagePrice` edit changed the recorded advance, the settlement would silently drift.

## 6. Constraints

- **API:** Drizzle schema in `src/orders/order.schema.ts`, re-exported from `src/common/database/schema.ts`; ESM `.js` import suffixes; DTOs for every request/response with `@Api*Response({ type })`; money as decimal strings / SQL `numeric`; no `any`.
- **Migrations:** generated with drizzle-kit, applied via `pnpm db:migrate`. Drizzle-kit prompts on rename conflicts and needs a TTY. Hand-editing generated SQL is only acceptable for deliberate statement **ordering** (as done for `0019`), not for rewriting intent. Take a `pg_dump` backup before applying to the dev DB.
- **Frontend:** API types come only from `pnpm codegen` against the running API. **No new test files** in the frontend. Gate on `pnpm lint` + `pnpm build` + a real-browser smoke pass.
- **Permission catalog** lives in `src/common/auth/permission-keys.ts` (source of truth) mirrored in `delivery_solution_frontend/src/types/permission.ts`. Both must stay in lockstep.
- **No commits** in either repo unless explicitly asked.

---

## 7. Phase 1 — the advance

### 7.1 Schema — two columns on `orders`

| Column | Type | Purpose |
|---|---|---|
| `shop_advance_amount` | `numeric(12,2) not null default '0'` | The package price the company actually paid this shop for this order |
| `shop_advanced_at` | `timestamptz null` | When it was paid. `null` = not yet advanced |

Supporting index for the *"not yet advanced"* query: `orders(shop_id, shop_advanced_at)`.

**Why an amount and not a boolean.** It is money the company can chase and reconcile, and it has to be a **snapshot**: if someone edits `packagePrice` next month, the money that actually moved does not change. A boolean cannot express either, and deriving it later from a mutable `packagePrice` would silently restate history. A snapshot column is also what Phase 2 needs to subtract from.

**Why a timestamp as well as the amount.** The amount says *how much*; the timestamp is what makes "not yet advanced" answerable and what lets a period flow be bucketed. A row with `shop_advance_amount > 0` but `shop_advanced_at is null` should not be reachable — the API always writes them together — but the pair is kept explicit rather than inferring "advanced" from a nonzero number.

**Only two columns are added now.** The Phase 2 columns (§8.1) are deliberately **not** created ahead of time.

### 7.2 Money rules

COD is unchanged. One term is added to the settlement:

```
COD to collect   = (customerPrepaidPackage ? 0 : P) + (customerPrepaidFee ? 0 : F)     [unchanged]

net owed to shop = (customerPrepaidPackage ? 0 : P)
                 − (customerPrepaidFee   ? F : 0)
                 − shopAdvanceAmount                                                   [new term]
```

With `shop_advance_amount` defaulting to `'0'`, this is arithmetically identical to today for every existing row. Sanity checks:

| Case | Advance | net owed to shop | Meaning |
|---|---|---|---|
| COD, not advanced | `0` | `P` | Company collected COD; owes the shop the package price |
| COD, advanced in full | `P` | `0` | Already settled; the company keeps only `F` from the COD |
| Customer prepaid the package | `0` | `0` | Nothing flows to the shop; nothing to collect |

Because `CANCELLED` already contributes `0` to every payable expression, this new term changes **delivered and live orders only** — and only when an advance exists.

### 7.3 API surface

| Endpoint | Body | Effect | Permission |
|---|---|---|---|
| `POST /orders/:id/shop-advance` | — | Sets `shop_advance_amount = packagePrice` (snapshot) and `shop_advanced_at = now()` | `orders.shop_settlement` |
| `DELETE /orders/:id/shop-advance` | — | Clears both (correcting a mistake) | `orders.shop_settlement` |

- **No `amount` in the body.** Rule 4 fixes the advance at the package price, and anti-goal §5 forbids an override. The value is read from the order and snapshotted server-side.
- Both write `order_field_audit` rows, and the new column is treated as a **money field** for audit serialisation (decimal-string-preserving).
- No new order status and no new transition — these are field-level facts on an existing state.
- Filters on `GET /orders`: `shopAdvance` (`ADVANCED` \| `NOT_ADVANCED`), and `isPackagePaidToShop` (boolean) since the work list needs it.

**Invariants and guards.**

- **An advance is only recorded where one is due.** `POST` rejects an order whose customer prepaid the package (`isPackagePaidToShop = true`) — there is nothing to advance. A `409` with an explanatory message, consistent with the API's existing conflict style.
- **`shopAdvance=NOT_ADVANCED` is a work list, not a null scan.** It selects orders that need an advance and do not have one — not customer-prepaid, not `CANCELLED` — rather than every row with a null timestamp.
- **An advance cannot be erased once the order is cancelled.** Clearing is refused on `CANCELLED`, because that advance is money the shop owes back and Phase 2 will report it. This guard exists in Phase 1 precisely so Phase 2 can rely on it; without it, Phase 2's reclaim could be deleted by a Phase 1 caller.
- **Late money edits keep the existing rule.** Recording an advance on a **`DELIVERED`** order requires `orders.update_after_approval` **and** a non-empty reason, exactly like every other money-field edit after sign-off; the advance DTO takes an optional `reason`, required in that one case. Meeting `orders.shop_settlement` is not a bypass.

### 7.4 Reporting

- **Shop statement** (`/reports/shop-statement`) gains `advancedToShop` — a **flow**: advances made in the selected period, bucketed by `shop_advanced_at`, so it respects the page's existing `dateBasis`. This is the only new figure in Phase 1.
- **Orders report** (`/reports/orders`) gains a per-row advance column.
- Existing fields keep their current values in every case.

### 7.5 Permissions

Add one key: **`orders.shop_settlement`**. Catalog goes 42 → 43 keys (13 modules, no new module).

**Default grants: OWNER and ADMIN only. OFFICER does not get it** — the business will assign it per role from the UI. (OWNER holds the whole catalog as a system role; ADMIN receives it automatically because `GRANTS.ADMIN = [...PERMISSION_KEYS]`.) No new seed role is created.

Note there is **no FINANCE role in the seed** (`SEED_ROLE_NAMES = OWNER, ADMIN, OFFICER, RIDER, SHOP`). A `FINANCE` role exists in the dev database, but it was created through the UI and holds **0 grants** — it is not a default-grant target and must not be treated as one.

Mirror the key in the frontend's `types/permission.ts`.

### 7.6 Frontend surfaces

- **Order detail** — an "Advance to shop" block showing the amount, when, and by whom, with the record / undo action, gated on `orders.shop_settlement`. A customer-prepaid order shows why no advance applies rather than a dead button.
- **Orders list** — a filter for advance state (and customer-prepaid); no column changes required.

---

## 8. Phase 2 — returns and reclaims (designed, **not built**)

Recorded so the decisions are not lost, and so Phase 1's guards are forward-compatible. **Do not build any of this yet.**

### 8.1 Schema

| Column | Type | Purpose |
|---|---|---|
| `returned_to_shop_at` | `timestamptz null` | When the package physically came back |
| `returned_to_shop_by` | `uuid null` → `users.id` | Who recorded it |
| `reclaim_settled_amount` | `numeric(12,2) not null default '0'` | How much of the reclaim the shop has given back |
| `reclaim_settled_at` | `timestamptz null` | When it was cleared |

### 8.2 Money

```
reclaim outstanding = shop_advance_amount − reclaim_settled_amount
  where status = CANCELLED
    and returned_to_shop_at is not null
```

- **The reclaim is triggered by the physical return, not by the cancellation.** Confirmed rule 6 changes the arithmetic: because the package is in the company's hands from the moment the order exists, a cancelled-but-not-yet-returned order is **not a loss** — the company is holding goods worth the advance, so the shop owes nothing back yet. The shop owes the advance only once it has the package **and** the money. (An earlier draft of this design reclaimed on cancellation alone; that would have claimed money while the goods were still in our depot.)
- **The return step must therefore be part of the cancel flow**, not an optional afterthought. If a cancelled order's package is never marked as handed back, the reclaim never arises — the same class of invisibility this whole feature exists to remove. `POST /orders/:id/return-to-shop` belongs on the cancellation path, and a `CANCELLED` order with an unsettled advance and no recorded return is a **work list** ("goods still with us, money still out"), not a quiet row.
- **Recovery is by netting against the next advance** (business owner's answer), which is why the settlement is an **amount** and not a flag: a reclaim may be given back or netted off in instalments. A boolean `reclaim_settled_at` would have been too blunt.
- Reported as a **separate line with its own sign**, not by weakening the existing payable definitions.

### 8.3 API

| Endpoint | Body | Effect |
|---|---|---|
| `POST /orders/:id/return-to-shop` | — | Sets `returned_to_shop_at` + `returned_to_shop_by`. Valid only on `CANCELLED` |
| `POST /orders/:id/settle-reclaim` | `{ amount: string, reason?: string }` | Adds to `reclaim_settled_amount`, sets `reclaim_settled_at` when fully recovered |

### 8.4 Reports and shop portal

- **Shop statement** gains `returnsOwedBackByShop` — a **stock** (everything currently outstanding for that shop, deliberately not period-scoped, and therefore labelled "as of today" rather than sitting unlabelled among the period figures) — and optionally `reclaimsSettled` as a flow.
- **Office dashboard** surfaces "owed back by shops" as a KPI, same stock semantics and labelling.
- **Shop portal: the shop sees what it needs to give back** (business owner's answer) — each obligation shown **with the reason it exists**, so the shop understands why it owes. Any such field must respect the existing shop-DTO redaction rules (§5).

### 8.5 Still open, pending the client discussion

**Is a delivery fee the shop collected from the customer also reclaimed** when the package is undelivered? If the customer prepaid the delivery fee to the shop and the delivery never happened, the shop is holding a fee for work that was not done — e.g. the customer paid the shop 12,000 (10,000 package + 2,000 delivery), the company advanced nothing because the package was already paid for, and the package came back. The shop keeping the 10,000 is fair (it still holds the package); the 2,000 is the question.

**The business owner's answer was "leave it for the client discussion"** — so the Phase 2 design above reclaims the advance only, and this stays explicitly unresolved rather than assumed away.

### 8.6 Known hole that stays open until Phase 2

**The entire cancelled-order path is unhandled by Phase 1, and it is the common case.** Rule 6 makes the return a routine step: every cancellation needs the package handed back, and only then is the advance reclaimable. Phase 1 can record neither the return nor the reclaim, and it deliberately keeps `CANCELLED` contributing `0` to every payable figure. So an advanced-then-cancelled order shows its advance nowhere.

This is the **original motivating scenario**, so Phase 1 must not be read as "returns are handled". Phase 1 answers *"which orders for this shop are not yet advanced?"*; it does not answer *"what do the shops owe us back?"*.

---

## 9. Migration and verification (Phase 1)

1. `pg_dump` the dev DB before applying, as with `0019`.
2. Generate the migration; expect **two** additive columns plus an index. **No backfill** — the defaults are already the correct historical value.
3. Prove no restatement: capture `/reports/shop-statement` for a fixed shop and date range **before** and **after**, and diff. Every pre-existing field must be identical.
4. API gate: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm db:migrate`.
   - Add unit tests for: net-owed with an advance; a fully advanced COD order settling to `0`; an unadvanced order unchanged; the advance endpoint refusing a customer-prepaid order; clearing an advance being refused on `CANCELLED`; the snapshot not following a later `packagePrice` edit.
5. Frontend: `pnpm codegen`, `pnpm lint`, `pnpm build`, then a real-browser smoke pass (jsdom cannot verify layout).

**Prerequisite: rename one of the two `ShopStatementResponseDto` classes** (office `src/reports/dto/report-response.dto.ts`, shop-portal `src/shop-portal/dto/shop-statement-response.dto.ts`). They collide on name, so OpenAPI exposes only one schema and the generated frontend type takes the shop-portal shape — the new office field of §7.4 would be **invisible** to the frontend without it. It also fixes the blank-card defect in `business-flows.md` §12 for free, since the office page must then be corrected to read the counts its endpoint actually returns (`pendingCount` / `assignedCount` / `awaitingApprovalCount`, not `receivedCount` / `outForDeliveryCount`). Two problems, one rename — do them together.

## 10. Decisions resolved with the business owner (2026-10-18)

| # | Question | Answer |
|---|---|---|
| 1 | Does OFFICER get `orders.shop_settlement` by default? | **No** — OWNER/ADMIN only; assign per role from the UI |
| 2 | Is a shop-collected delivery fee also reclaimed on a return? | **Deferred** — needs a client discussion; hence Phase 2 |
| 3 | How is a reclaim recovered? | **Netted against the next advance** → settlement is an amount, supporting partial recovery |
| 4 | Is the advance always exactly the package price? | **Yes** → no amount override in the API |
| 5 | Does the shop portal see its reclaim obligations? | **Yes** — the shop sees what it must give back, with the reason it exists |
| 6 | Per-order or bulk advance? | **Per order first** |
| 7 | What triggers a reclaim — cancellation, or the physical return? | **The physical return.** An order only exists once the package is at the delivery office, so a cancelled-but-unreturned order still has goods in the company's hands and the shop owes nothing back yet. (This overturned the designer's initial call of "any cancellation".) |

## 11. Calls made by the designer (override freely)

- An **amount** column rather than a boolean, for snapshot correctness.
- **Snapshotting** the advance server-side from `packagePrice`, with no override parameter (per decision 4).
- A **nullable timestamp pair** rather than a new terminal status, protecting v2's single-terminal `CANCELLED`.
- **Phase 1 ships the advance alone.** The return/reclaim half is designed but not built (per decision 2) — accepting that the original motivating scenario (§8.6) stays open until Phase 2.
- A **self-referential guard now for a Phase 2 rule** — refusing to erase an advance on a cancelled order costs nothing today and prevents Phase 2 from inheriting an unsolvable hole.
- **One** new permission key, and **no new seed role**.
- **Filters on the existing orders endpoint** rather than a new report endpoint.
- The reclaim is **derived** every time, never stored.
