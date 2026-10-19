# Delivery Operations Frontend — Build Plan

This plan tracks office, shop, and rider UI work against the API contract in `../delivery_solution_api/PLAN.md` and generated `src/types/api.ts`. Product/domain decisions remain owned by the backend plan; `docs/delivery-workflow-v2.md` is the authoritative workflow spec.

## Current status

- **Foundation and administration:** COMPLETE (auth, users, roles/permissions, shops, customers, riders, township configuration with a required default delivery fee, default commission fee and lead time, delivery partners).
- **Office order operations:** COMPLETE (creation with an optional explicit rider/partner, per-order fee and commission overrides, list/search, category-grouped details, audited editing, assignment, postponement, cancel, the delivery-confirmation queue at `/orders/approval`, send-back, partner mark-delivered).
- **Rider commission:** COMPLETE (per order, prefilled from the township's required `defaultCommissionFee` and overridable per order). The earlier per-way model — ways, the configurable per-way rate, per-rider overrides, order movement, and pay-anyway — was removed on 2026-10-18.
- **Reports:** COMPLETE for the delivered set (office order report, shop statement, rider collection, rider payout, office dashboard) with CSV/XLSX export.
- **Rider delivery surface:** COMPLETE (`/rider-board` and `/rider-dashboard`, date-aware board and dashboard, own-order rows with full detail, submit-delivered action).
- **Shop portal:** COMPLETE (shop-scoped order list, order detail, dashboard, and statement at `/shop/*`).
- **Rider handovers:** COMPLETE (`/rider-handovers`, in the Orders group) — the office records cash a rider hands back (received method, required received date, optional note) and sees each rider's outstanding balance. A correction edits in place with a required reason and leaves a per-field history; there is deliberately no delete.
- **Office dashboard:** implemented beyond the first slice — KPI cards, four charts, and pending-order age; see `docs/delivery-workflow-v2.md`.
- **Order statuses:** `PENDING → ASSIGNED → AWAITING_APPROVAL → DELIVERED`, with `DELIVERED` and `CANCELLED` terminal: no transition out of either, and no edit into either (`PATCH /orders/:id` answers 409). The former separate "returned" state was merged into `CANCELLED`.
- **Not implemented:** returns/reclaims (Phase 2 of the shop advance design), payment ledger/reconciliation (Phase 6), custody/sign-out, the 5-of-10 rule, and notifications.

## Office dashboard — COMPLETE

### Page and navigation

- The office dashboard is available at `/dashboard` gated by `reports.read`; RIDER users are routed to `/rider-board` (with `/rider-dashboard`) rather than the office pages.
- Gate the route/navigation with `reports.read`. OWNER/ADMIN/OFFICER are allowed; RIDER is denied by backend permission grants. The API is authoritative; do not use client-side filtering as a security boundary.
- Keep the established monochrome, dense, accessible operations UI and mobile-safe layout. The charts are hand-built SVG; no charting package was added.
- Preserve existing office order detail coverage: the detail dialog groups order/status, customer and shop, delivery, package/notes, and history into labeled sections. Dashboard links into order details should retain this categorized presentation rather than introduce another partial order summary.

### Date and data behavior

- Default to the current calendar day in `APP_TIMEZONE` (default `Asia/Yangon`); support selecting another individual date.
- Treat the date as `YYYY-MM-DD` local calendar semantics. Do not derive it with UTC `toISOString().slice(0, 10)`.
- Fetch the backend dashboard aggregate endpoint through the feature’s `api.ts` and React Query. Do not compute global metrics from paginated `/orders` results or call the rider dashboard endpoint for office data.
- Present loading, error, no-activity, and populated states; ensure the selected day is visible.

### Content (as built)

- Five KPI cards, deliberately mixing date-scoped and current figures: today's orders (created on the selected date), COD to collect today (expected COD on orders created that date) and fee income today (delivery fees on orders delivered that date), alongside two **current** snapshots — awaiting approval, and delayed orders (open orders whose `estimatedDeliveryDate` has passed). Label the two snapshots so they are not read as that day's activity.
- `ordersPerDayByStatus`: order counts per day across the selected range, grouped by status, using the chosen date basis (created or delivered).
- `feeIncomeVsPartnerCostVsCommission`: per-day fee income, partner cost, earned commission, and margin over the range, from delivered orders only.
- `topShops`: shops ranked by order count in the range.
- `townshipSuccessRates`: per township, delivered ÷ (delivered + cancelled) as a percentage, `0.00` when a township has neither in the range.
- `averagePendingAgeDays`: the average age in days of orders still active in the range, drawn on a seven-day scale.
- The rider dashboard is a separate endpoint with its own DTO (today/week/month delivered counts, commission earned and pending, orders per day, COD to hand back); do not derive office metrics from it or vice versa.

### Metric limitations

- COD and net owed to shop are **derived** from `packagePrice`, `deliveryFee`, `isPackagePaidToShop` and `isFeePaidToShop`. They are expectations, not evidence of a cash collection. Do not display COD sums as “collected”, “reconciled”, or “payable”. (`orders.codAmount` is still in the schema but is not read by application code.)
- Approval (`DELIVERED`) confirms the delivery and starts expecting the COD back from the rider — it records no cash itself. A **rider handover** is the one record of cash actually received: it is per rider and aggregate, never allocated to an order, so it settles that rider's balance without turning any order's COD into a "collected" figure.
- No promised delivery time or delivery-start timestamp exists, so on-time rate, transit time, and any delivery-attempt success rate cannot be computed. `estimatedDeliveryDate` is an office-set target date, and `deliveredAt` is stamped when the rider submits, before an officer has checked anything.
- Daily rider sign-out/sign-in, custody returns, shifts/manifests, and the 5-of-10 rule are deferred; do not show custody metrics.
- Refunds, payment reconciliation, and shop payouts remain blocked pending Phase 6 domain decisions. Rider handovers are a receipt record, not reconciliation: the running balance reconciles against no order. The separate order "returns" concept no longer exists — it was merged into the single `CANCELLED` state.
- Township is an order attribute, not a shop attribute; do not imply a shop-township relation.

### Dependencies and implementation gate

- No new frontend package was needed: the dashboard uses React Query, the existing UI primitives, and hand-built SVG charts.
- Consume API types generated from `delivery_solution_api` OpenAPI; never hand-edit `src/types/api.ts`.
- Delivered and verified with backend e2e role checks (OWNER/ADMIN/OFFICER allowed; RIDER denied), frontend `pnpm lint`, `pnpm build`, existing tests, and generated OpenAPI types.

## Later work

- Broader date-range reports and exports after dashboard usage validates needs and metric definitions.
- Payment/reconciliation UI only after backend Phase 6 is explicitly approved and implemented.
- Rider-handover follow-ups only on an explicit request: the office surface is complete, and it stays a receipt record — no ledger, no reconciliation against orders, and no write-off / opening-balance screen until backend Phase 6 is approved.
- Daily custody and rider shift/manifest UI only after Phase 3.6 decisions are made and backend support exists.
