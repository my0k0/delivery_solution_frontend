# Business flows — per-order rider commission and shop settlement

**Status:** as-built description of the system after the change from per-way commission to per-order rider commission. Written from the code, not from intent; every claim below is traceable to a file.

**Relationship to `delivery-workflow-v2.md`:** that document is the approved v2 requirement record. This one describes **current behaviour** and supersedes its ways/commission sections: v2 §2 decisions 14–15 and 20, §3 (`ways`, `app_setting.commissionPerWay`, `orders.way_id`, `riders.commission_per_way_override`), §4 (the `orders.update_costs` rule), §5 (ways and pay-anyway), §7 (`/ways` endpoints, "rider payout = ways × rate") and the corresponding "As built" notes are all **stale**. Everything else in v2 still holds.

Repos: `delivery_solution_api` (NestJS, Drizzle, Postgres) and `delivery_solution_frontend` (Vite + React + TS). All paths are under `/api/v1`.

---

## 1. The actors and the money at stake

| Actor | Role in the flow | Sees |
|---|---|---|
| **Office / officer** (OWNER, ADMIN, OFFICER) | Enters orders, assigns, approves, cancels, edits money | Everything |
| **Rider** (RIDER) | Delivers; taps "submit delivered". No fail/reject action | Own orders only; no fee/margin/partner/shop-finance data |
| **Shop** (SHOP) | Sends the package with the company; one login per shop | Own orders and own settlement estimate; never rider/partner identity, partner cost, or internal notes |
| **Customer** | Receives the package, pays COD to the rider | Nothing in the system |
| **Delivery partner** (external company) | Carries a package instead of an own rider | Nothing in the system |

Money that moves in the real world: **package price** (the shop's goods value), **delivery fee** (the company's income), **partner fee** (what the company pays an external carrier — an internal cost), and **rider commission** (what the company pays its rider per delivered order).

The single most important structural fact: **the system is a derivation engine over the `orders` table, not a ledger.** There is no cash book, no payment record, no account balance anywhere. Every money figure an officer sees is computed from order fields at read time.

---

## 2. Order creation — what happens, and what it touches elsewhere

`POST /orders` — permission `orders.create`.

### 2.1 What the API does

1. **Validates references:** shop exists, customer exists, township exists (if an id was sent).
2. **Resolves the assignee**, in this precedence:
   - an explicit `riderId` or `partnerId` on the request wins (sending both is a 400); the target must exist, and a partner must be `isActive` or it is a 400;
   - otherwise the township's default assignee, if the township has one;
   - otherwise nobody.
3. **Sets the initial status:** `PENDING` when there is no assignee, `ASSIGNED` when there is. It is never created directly as `AWAITING_APPROVAL`, `DELIVERED`, or `CANCELLED`.
4. **Prefills money and dates from the township** (each one overridable by the request):

   | Order field | Rule on create |
   |---|---|
   | `packagePrice` | request value, else `'0'` |
   | `deliveryFee` | request value, else `township.defaultDeliveryFee`, else `'0'` |
   | `commissionFee` | `'0'` when the assignee is a **PARTNER**; otherwise request value, else `township.defaultCommissionFee`, else `'0'` |
   | `partnerFee` | request value, else `'0'` |
   | `isPackagePaidToShop` / `isFeePaidToShop` | request value, else `false` |
   | `estimatedDeliveryDate` | request value, else today in `APP_TIMEZONE` + `township.leadTimeDays`, else `null` |
   | `trackingCode` | generated server-side; unique index, up to 3 attempts before a 409 |

5. **Writes everything in one transaction:** the order row, plus exactly **one** `order_status_history` row — `null → PENDING|ASSIGNED`, note `"Order registered"`, `newAssignee` = the resolved assignee (or null).

### 2.2 What changes in other modules

**Nothing else.** This is the direct answer to "when an order is created, what takes effect in other places":

- No shop balance, credit, or prepayment record is created or touched — `shops` has no money columns at all.
- No rider or partner record changes (no counter, no assignment queue, no way/route object).
- No commission is accrued; `commissionFee` is stored as a plain expected amount on the order.
- No inventory/stock is decremented; packages are collected outside the system and the office keys the order in afterwards.
- No notification, no payment, no ledger entry.
- Reports don't change: every report is computed on read from `orders`.

So an order's *only* footprint is the order row and its history. If you need to know "what did creating this order cause?", the complete answer is "one order, one history line".

---

## 3. Assignment, reassignment, and postponement

| Action | Endpoint | Permission | Status effect | History written |
|---|---|---|---|---|
| Assign / reassign | `POST /orders/:id/assign` (also expressible via `PATCH /orders/:id` with `riderId`/`partnerId`) | `orders.update` | any → `ASSIGNED` | `"Order assigned or reassigned"`, with previous/new assignee |
| Unassign (clear the assignee) | `PATCH /orders/:id` with only one of `riderId`/`partnerId` set to `null`, or `assign` with neither | `orders.update` | any → `PENDING` | `"Order unassigned"` |
| Postpone | `POST /orders/:id/postpone` | `orders.update` | any → `PENDING`, assignee cleared | `"Delivery postponed"` + shop-visible reason |
| Cancel | `POST /orders/:id/cancel` | `orders.cancel` | any non-terminal → `CANCELLED` | `"Order cancelled"` + shop-visible reason |

Details that matter operationally:

- **Reassigning to the same status still writes history.** `ASSIGNED → ASSIGNED` is an allowed transition, so a reassignment is always auditable.
- **No-op assignments write nothing.** If the assignee and status are already what was asked, the service returns early with no history row.
- **There is no way/route object any more.** Assigning a rider does not create, join, or touch any per-day grouping. There is no custody sign-out, no "N of M" rule, and no auto-join.
- Postponing always clears the assignee — the order returns to the unassigned pool.
- Changing the township (`PATCH`) can re-apply the township's fee, commission, and default assignee, but only when the client explicitly asks (`applyTownshipFee` / `applyTownshipAssignee`); otherwise the existing values are kept.

---

## 4. Delivery — two different paths

The exact same customer-visible outcome ("delivered") travels two different routes depending on who carries the package.

### 4.1 Own rider (`assigneeType = RIDER`)

1. The rider opens **My deliveries** (`GET /riders/me/orders`), which lists **only** `ASSIGNED` orders where they are the assignee.
2. The rider taps **Submit delivered** → `POST /riders/me/orders/:id/delivered`.
   - Scoped by the JWT: the caller must be the rider assigned to that order, and the order must be a RIDER order. Anything else is a 404 (not a 403 — an unassigned order is simply invisible to them).
   - Effect: `ASSIGNED → AWAITING_APPROVAL`, and **`deliveredAt` is stamped with now()**.
   - History: `"Rider submitted delivery for approval"`.
3. The order disappears from the rider's board (the board filters `ASSIGNED` only) and appears in the officer's **Approval queue**.
4. The rider has **no** reject, fail, or "could not deliver" button. A failure is an officer decision (§3).

### 4.2 Delivery partner (`assigneeType = PARTNER`)

1. The office assigns the order to a partner and keys the partner's own tracking number into `partnerTrackingNo`.
2. When the partner reports back, an officer uses **Mark delivered** → `POST /orders/:id/mark-delivered` (gated `deliveries.approve`, the same permission as approving a rider delivery).
   - Effect: `ASSIGNED → DELIVERED` **directly** — this single action *is* the approval; there is no separate approval step and no approval queue entry.
   - `deliveredAt` is stamped with now(). History: `"Partner order marked delivered by office"`.
3. Partner orders **never** carry a rider commission: the service forces `commissionFee = '0'` on create and on update whenever the effective assignee is a partner, regardless of what the request sent. The company's cost on a partner order is `partnerFee`.

### 4.3 Why `deliveredAt` is stamped at submit, not at approval

`deliveredAt` records when the delivery physically happened (rider's tap, or the officer's mark for a partner order). Reports that group by delivery date use this timestamp, so an order delivered late on the 17th and approved on the 18th is reported on the 17th. `AWAITING_APPROVAL` is shown to the shop as "Out for delivery".

---

## 5. Approval — the moment money and commission become real

`POST /orders/:id/approve` — permission `deliveries.approve`. Only valid from `AWAITING_APPROVAL`.

The transition is just a status flip to `DELIVERED` (history: `"Delivery approved"`). It writes **no amount anywhere** — and yet it is the single most consequential event in the system, because every money figure is derived from status:

| Becomes true at approval | Consequence |
|---|---|
| COD counts as **collected** | `codCollected` on the shop statement, and the company's revenue figures, include the order |
| COD stops counting as **expected** | It leaves `codExpected` / the office dashboard's "COD to collect today" |
| The rider's commission flips **pending → earned** | It leaves the rider's `commissionPending` and joins `commissionEarned` |
| Fee income and margin become real | `deliveryFee` and `deliveryFee − partnerFee − commissionFee` are only counted for `DELIVERED` |
| A delivered–cancelled ratio is fixed | Township success rate = `delivered / (delivered + cancelled)` |

**Send back** (`POST /orders/:id/send-back`, also `deliveries.approve`) is the rejection path: `AWAITING_APPROVAL → ASSIGNED`, with a shop-visible `reason` and an internal-only `internalNote`. History: `"Delivery submission sent back for correction"`. The commission was never earned (it never left "pending"), and after send-back it counts as neither earned nor pending until the order is approved.

---

## 6. Cancellation

`POST /orders/:id/cancel` — permission `orders.cancel`. From any non-terminal status → `CANCELLED` (terminal), storing the shop-visible reason in `cancelReason` and writing `"Order cancelled"` to history.

`CANCELLED` deliberately covers **two real-world events under one state**: a delivery that was called off, and a package that came back to the shop (the former `RETURNED` state was merged into it). There is no separate returned status, no returned-at timestamp, and no restock concept.

Effects: the order is excluded from every payable total (§8), so it drops out of COD, net-owed, and shop-statement money figures. It stays visible in order lists and in the statement's `cancelledCount`.

---

## 7. Status model

```
PENDING            → ASSIGNED, CANCELLED
ASSIGNED           → PENDING (unassign/postpone), ASSIGNED (reassign),
                     AWAITING_APPROVAL (rider submit), CANCELLED
AWAITING_APPROVAL  → DELIVERED (approve), ASSIGNED (send back)
DELIVERED          → terminal
CANCELLED          → terminal
```

Partner orders use a shortcut transition `ASSIGNED → DELIVERED` that the matrix otherwise disallows; it is permitted only through `markPartnerDeliveredInTransaction` and is further guarded by `assigneeType = 'PARTNER'`.

Every transition is applied by a guarded `UPDATE … WHERE status = <expected>` inside a transaction, so two officers acting at once cannot double-apply one. If the guard misses, the caller gets a 409 "Order … is not in status …". Shop-facing vocabulary maps `PENDING → RECEIVED`, `ASSIGNED`/`AWAITING_APPROVAL` → `OUT_FOR_DELIVERY`.

---

## 8. The money model (exact)

All amounts are decimal strings / SQL `numeric`. Let `P = packagePrice`, `F = deliveryFee`.

```
COD to collect      = (isPackagePaidToShop ? 0 : P) + (isFeePaidToShop ? 0 : F)
net owed to shop    = (isPackagePaidToShop ? 0 : P) − (isFeePaidToShop ? F : 0)
company fee income  = F
margin              = F − partnerFee − commissionFee
```

Sign convention for net owed: **positive** = the company owes the shop; **negative** = the shop owes the company.

Which orders count, by figure:

| Figure | Statuses included |
|---|---|
| COD **collected** | `DELIVERED` only |
| COD **expected** | `PENDING`, `ASSIGNED`, `AWAITING_APPROVAL` only |
| Package/fee/partner-fee totals | `PENDING`, `ASSIGNED`, `AWAITING_APPROVAL`, `DELIVERED` |
| Fee income / margin / commission earned | `DELIVERED` only |
| Rider commission **pending** | `AWAITING_APPROVAL` only |
| **Every** payable figure | `CANCELLED` contributes 0 |

Editing any money field (`packagePrice`, `deliveryFee`, `isPackagePaidToShop`, `isFeePaidToShop`, `partnerFee`, `commissionFee`) is gated by `orders.update` like any other edit. If the order is already `DELIVERED`, it additionally requires `orders.update_after_approval` **and** a non-empty reason; every changed field is written to `order_field_audit` with old value, new value, actor, and reason. Money fields are stored in the audit log as strings, so no precision is lost.

---

## 9. Rider commission lifecycle

Commission is a **per-order** amount stored in `orders.commission_fee`, defaulted from the township's `default_commission_fee` and editable by an officer.

| Stage | Status | Where it shows |
|---|---|---|
| Expected, not yet delivered | `PENDING` / `ASSIGNED` | Nowhere as commission |
| **Pending approval** | `AWAITING_APPROVAL` | Rider payout "Pending approval"; rider dashboard "Commission pending approval" |
| **Earned** | `DELIVERED` | Rider payout "Earned"; rider dashboard "Commission earned" |
| Never earned | `CANCELLED` | Excluded everywhere |
| Not applicable | partner order | Forced to `'0'` |

Rules:

- **A rider earns commission only when the order reaches `DELIVERED`** — i.e. only after an officer approves it in the Approval queue. Submitting a delivery earns nothing; it only moves the amount into the pending bucket.
- Earned commission is attributed to the **local date of `deliveredAt`**, not the approval date and not the entry date.
- The rider payout report is a **single row per rider** over the selected date range (delivered orders → earned; awaiting-approval orders → pending). There is no per-day or per-way breakdown, and no "pay anyway" override — that concept was deleted along with ways.
- The rider payout page has **no date-basis control**: the report fixes the basis internally per bucket (earned by `deliveredAt`, pending by `createdAt`), because a per-order commission has no single meaningful date to pivot on.
- Post-approval changes to `commissionFee` are possible under `orders.update_after_approval` with a reason, and are audited like any other money field.

What the rider sees: **My deliveries** (own `ASSIGNED` orders, with the COD to collect), and **My dashboard** (delivered counts for today/week/month, commission earned, commission pending, COD to hand back today, and delivered orders per day).

---

## 10. Shop settlement — what exists today

This is the area where the system is thinnest, so it is worth being blunt about what it does and does not hold.

### 10.1 The only payment state the system knows

Two booleans on each order, set **by hand** by an officer when creating or editing the order (frontend: the "Already paid to shop" box with **Package price paid** / **Delivery fee paid** checkboxes):

- `isPackagePaidToShop`
- `isFeePaidToShop`

They are covered combinations: both / price only / fee only / nothing.

**Confirmed semantics (correct as built):** these two flags record **what the customer paid the shop in advance** — online-shop customers sometimes pay the package price and/or the delivery fee up front. When the customer prepaid, the rider collects nothing for those parts, so COD drops accordingly; when the customer is on COD, the rider collects package price + delivery fee.

There is **no amount, no date, and no payment record** behind them, and — the important part — they say nothing about the **other direction**: the money the delivery company itself pays the shop. That is a separate axis with no representation at all (see §11).

### 10.2 Where an officer can see payment state

| Surface | What it shows | Can you tell prepaid from it? |
|---|---|---|
| Order detail (`/orders/:id`) | "Payment to shop: Package paid · Fee unpaid" | **Yes, explicitly** |
| Order form (edit) | The two checkboxes | Yes |
| Orders list (`/orders`) | Tracking, status, created, est. date, COD to collect, net owed | Only indirectly — a fully prepaid order shows COD `0.00` |
| Orders report (`/reports/orders`) | Per-order package price, fee, COD to collect, net owed, + filter totals | Only indirectly, from the COD / net-owed columns |
| Shop statement (`/reports/shop-statement`) | Per shop: price total, fee total, COD collected, COD expected, net owed · delivered, net owed · pending | Aggregated only |
| Shop portal (shop's own view) | Per order: COD to collect, net settlement; plus statement cards | The API sends `isPackagePaidToShop`, but **the shop UI does not render it** |

The shop statement page carries an explicit warning, which is the most honest summary of this whole area:

> "Net owed to shop follows the delivery workflow money rules. Positive means the company owes the shop; negative means the shop owes the company. It is an estimate derived from order fields — the system holds no record of money actually received or paid, so treat it as an expectation, not a settled balance."

### 10.3 What is missing

- **No company→shop payment record.** Nothing records that the company paid a shop, when, or how much. No `payments`/`prepayments` table, no shop balance column, no advance row. (v2 §2 decision 22 keeps "payment ledger, reconciliation, prepayments to shops" deliberately **blocked**.)
- **No cross-shop register.** There is no screen answering "which orders for which shop have been advanced and which have not".
- **No filter for prepaid status.** `GET /orders` accepts `search`, `status`, `shopId`, `townshipId`, `assigneeId`, `customerId`, `dateFrom/dateTo`, `dateBasis` — and **nothing** for `isPackagePaidToShop` or for the company's advance. So an officer cannot ask "show me the orders for this shop that are not prepaid yet"; they must open orders individually or infer from the orders report's COD column.
- **The two directions of money are not separated.** "The customer paid the shop" (modelled) and "the company paid the shop" (not modelled) are different facts from different counterparties, and only the first exists in the schema. Because the company's advance is invisible, the settlement figures cannot tell "already settled by us" from "we still owe this".
- **No settlement events.** There is no "mark this shop's period as paid", no partial payment, and no reconciliation.

---

## 11. The uncovered case: undeliverable order → return to shop → reclaim

### 11.1 The business event

A **COD** order is entered: the customer will pay the rider package price + delivery fee. Because the customer has not paid the shop, the **company advances the shop the package price** — deliberately the package price only, not the delivery fee. The package then fails to deliver: the recipient cancels through the shop, the address is unreachable, the customer refuses. The package must go **back to the shop**, and the company must get the **advanced package price back** from the shop — unless that particular order had not been advanced yet.

Note the two directions, which the system keeps apart for the first time in this document:

- **Customer → shop** (modelled): whether the customer prepaid. Drives COD.
- **Company → shop** (not modelled): the advance the company pays the shop. Drives settlement and the reclaim.

### 11.2 Why the current system cannot express it

1. **There is no return event.** Cancelling puts the order in the single terminal `CANCELLED` state with a free-text reason. The system cannot distinguish "called off, never dispatched" from "package physically returned to the shop". Nothing records that the package is back in the shop's hands.
2. **The money vanishes instead of reversing.** `CANCELLED` contributes `0` to every payable figure. So the moment an order is cancelled, the fact that the company is out of pocket the package price disappears from every report. The reclaim obligation — the shop owing the company `P` — is not just untracked, it is actively *not shown*.
3. **There is no negative/owed direction on a cancelled order.** `netOwedToShop` would go negative (shop owes company) if computed for a cancelled order, but the payable expressions exclude `CANCELLED` entirely, so it is computed as `0`.
4. **Nothing records the advance.** Whether the company has actually paid the shop for this order, when, and how much, is nowhere in the schema. So "the shop owes us back for this returned package" cannot be derived even in principle — there is no advance to reverse.
5. **The shop's own view hides it too.** The shop's statement excludes cancelled orders from its settlement cards, so neither side sees the outstanding reclaim.

### 11.3 Recommended shape — agreed, staged, **not built**

Recorded as a design: `docs/superpowers/specs/2026-10-18-shop-advance-and-returns-design.md`. **Nothing is implemented.** The business owner has ruled on the open questions and split the work in two phases.

**Phase 1 — the advance (this is the part that closes most of the gap):**

1. **Add the missing axis as data, not as a reinterpretation of the existing flags.** `orders.shopAdvanceAmount` (numeric, **snapshot** of the package price) + `orders.shopAdvancedAt` — what the company actually paid this shop for this order, and when. Default `'0'`/null, so every existing order keeps its current figures exactly.
2. **Let the advance reduce what we owe the shop** (`net owed` gains a `− shopAdvanceAmount` term). An order advanced in full settles to `0`; an order not advanced is unchanged.
3. **No amount override** — the advance is always exactly the package price, read from the order and snapshotted server-side.
4. **Make it findable:** a `shopAdvance` filter (a real work list — orders that need an advance and don't have one), plus a per-row advance column in the orders report and an `advancedToShop` period flow on the shop statement.

**Phase 2 — returns and reclaims (deferred, pending a client discussion):**

5. **Record the return** as `orders.returnedToShopAt` (+ actor) on the cancelled order — a nullable timestamp, not a new terminal status, so the state machine and every existing report keep working.
6. **Derive the reclaim** as `shopAdvanceAmount − reclaimSettledAmount` on a `CANCELLED` order **recorded as returned to the shop**. The trigger is the **physical hand-back, not the cancellation** — because an order is only created once the package reaches the office, a cancelled-but-unreturned order still has goods in the company's hands, so the shop owes nothing back yet. That makes the return step part of the cancel flow rather than an optional extra. Recovery is by **netting against the next advance**, so the settlement is an **amount** — a reclaim can be given back in instalments. No new ledger table; Phase 6 stays blocked.
7. **Show it, rather than weakening the payable definitions:** a "returns — owed back by shop" line on the shop statement, "owed back by shops" on the office dashboard, and — for the shop itself — its reclaim obligations **with the reason each one exists**.

**One hole Phase 1 does not close, deliberately:** Phase 1 can record neither the return nor the reclaim, and it keeps `CANCELLED` contributing `0` to every payable figure — so an advanced-then-cancelled order shows its advance nowhere. Because an order only exists once the package is at the office, every cancellation needs a hand-back, which makes this the **common** path rather than an edge case. It is the original motivating scenario, so Phase 1 must not be mistaken for "returns are handled": it answers *"which orders are not yet advanced?"*, not *"what do the shops owe us back?"*

Still open, for the client: whether a return also reclaims a **delivery fee** the shop collected from the customer for a delivery that never happened.

---

## 12. Defects found while writing this

Not caused by the commission change; both are live and unrelated to it.

1. **Office shop statement shows two blank cards.** Two different DTO classes share the name `ShopStatementResponseDto` — `reports/dto/report-response.dto.ts` (`pendingCount`, `assignedCount`, `awaitingApprovalCount`, `deliveredCount`, `cancelledCount`) and `shop-portal/dto/shop-statement-response.dto.ts` (`receivedCount`, `outForDeliveryCount`, `deliveredCount`, `cancelledCount`, `netOwedToShopTotal`). The OpenAPI document can only expose one class per name, and the generated frontend type takes the shop-portal shape. The office page therefore reads `receivedCount` / `outForDeliveryCount`, which the office endpoint never returns. Verified live on `/reports/shop-statement`: the four status cards render `["", "", "3", "5"]` — **"Received" and "Out for delivery" are blank**, and the underlying `pendingCount`/`assignedCount`/`awaitingApprovalCount` are never displayed. A side effect is that the office page cannot type-safely read the counts it actually receives.
2. **Superseded — the COD formula is correct.** An earlier draft suspected `isPackagePaidToShop` was being used to mean the company's advance and that COD was therefore under-collected. Confirmed wrong (see §13). No defect.

---

## 13. Resolved: what each flag means, and what is genuinely missing

This section replaces an earlier open question. **Confirmed with the business owner:**

- `isPackagePaidToShop` / `isFeePaidToShop` record **what the customer paid the shop in advance** (online shops). The COD formula is **correct as built**:

  ```
  COD to collect = (isPackagePaidToShop ? 0 : P) + (isFeePaidToShop ? 0 : F)
  ```

  - the customer prepaid the package price and/or the delivery fee → the rider collects nothing for those parts;
  - the customer is on COD → the rider collects package price + delivery fee.

- The **company → shop** relation is real and separate: on a COD order the company **advances the shop the package price** — deliberately not the delivery fee. The system has **no representation of it** (no advance, no return, no reclaim), which is the gap in §11.

So there is no defect in the COD arithmetic and no need to reinterpret the existing flags. What is missing is a **new axis**, not a fix to an old one. The earlier suspicion that the prepaid flag was standing in for the company's advance — and that COD was therefore under-collected — was **wrong**; it is recorded here only so the reasoning isn't repeated.
