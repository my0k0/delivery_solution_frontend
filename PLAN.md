# Delivery Operations Frontend — Build Plan

This plan tracks office, shop, and rider UI work against the API contract in `../delivery_solution_api/PLAN.md` and generated `src/types/api.ts`. Product/domain decisions remain owned by the backend plan; `docs/delivery-workflow-v2.md` is the authoritative workflow spec.

## Current status

- **Foundation and administration:** COMPLETE (auth, users, roles/permissions, shops, customers, riders, township configuration with a default delivery fee and assignee, delivery partners).
- **Office order operations:** COMPLETE (creation with a township default assignee or an explicit rider/partner, per-order delivery fee override, list/search, category-grouped details, audited editing, assignment, postponement, cancel, approval queue, send-back, partner mark-delivered).
- **Ways and rider commission:** COMPLETE (per-way commission with a configurable rate, optional rider override, order movement, pay-anyway).
- **Reports:** COMPLETE for the delivered set (office order report, shop statement, rider collection, rider payout, office dashboard) with CSV/XLSX export.
- **Rider delivery surface:** COMPLETE (`/rider-board` and `/rider-dashboard`, date-aware board and dashboard, own-order rows with full detail, submit-delivered action).
- **Shop portal:** COMPLETE (shop-scoped order list, order detail, dashboard, and statement at `/shop/*`).
- **Office dashboard:** implemented beyond the first slice — charts, finance series, shop ranking, and township success rates; see `docs/delivery-workflow-v2.md`.
- **Order statuses:** `PENDING → ASSIGNED → AWAITING_APPROVAL → DELIVERED`, with a single terminal `CANCELLED`. The former separate "returned" state was merged into `CANCELLED`.
- **Not implemented:** payment ledger/reconciliation (Phase 6), custody/sign-out, the 5-of-10 rule, and notifications.

## Office dashboard — first slice COMPLETE

### Page and navigation

- The office dashboard is available at `/dashboard` gated by `reports.read`; RIDER users are routed to `/rider-board` (with `/rider-dashboard`) rather than the office pages.
- Gate the route/navigation with `reports.read`. OWNER/ADMIN/OFFICER are allowed; RIDER is denied by backend permission grants. The API is authoritative; do not use client-side filtering as a security boundary.
- Keep the established monochrome, dense, accessible operations UI and mobile-safe layout. Start without a charting package.
- Preserve existing office order detail coverage: the detail dialog groups order/status, customer and shop, delivery, package/notes, and history into labeled sections. Dashboard links into order details should retain this categorized presentation rather than introduce another partial order summary.

### Date and data behavior

- Default to the current calendar day in `APP_TIMEZONE` (default `Asia/Yangon`); support selecting another individual date.
- Treat the date as `YYYY-MM-DD` local calendar semantics. Do not derive it with UTC `toISOString().slice(0, 10)`.
- Fetch the backend dashboard aggregate endpoint through the feature’s `api.ts` and React Query. Do not compute global metrics from paginated `/orders` results or call the rider dashboard endpoint for office data.
- Present loading, error, no-activity, and populated states; ensure the selected day is visible.

### First-slice content

- Summary values: orders created on the selected date; current open `ASSIGNED` orders; delivery attempts delivered on the selected date; failed attempts on the selected date; delivered / (delivered + failed) success rate for attempts completed on that date (0 when there are none). Dated delivered/failed values are attempt counts; retries are distinct attempts. Open assignments and the failed-order attention list are current order-level views.
- Keep labels explicit about different periods: dated creation/delivery/failure metrics use the selected date; “Open assignments” and failed-order attention are current snapshots, not limited to orders created that day.
- Current open work grouped by assigned rider and township. Use current/latest attempt per order; retries and reassignments must not duplicate an order in the open-work totals.
- Bounded recent delivery activity: assignment/reassignment, delivery, failure, and retry events with tracking code, township, rider, event, and timestamp.
- Failed orders requiring office attention, linked to existing order details/operations.
- Prefer compact values and grouped lists. Add charts only after a concrete time-series/comparison need is approved and the `data-visualization` skill has been consulted.

### Metric limitations

- `codAmount` is the order amount, not evidence of a cash collection. Do not display COD sums as “collected”, “reconciled”, or “payable”.
- No promised delivery time or delivery-start timestamp exists; do not show on-time rate or transit time.
- Daily rider sign-out/sign-in, custody returns, shifts/manifests, and the 5-of-10 rule are deferred; do not show custody metrics.
- Refunds, payment reconciliation, and shop payouts remain blocked pending Phase 6 domain decisions. The separate order "returns" concept no longer exists — it was merged into the single `CANCELLED` state.
- Township is an order attribute, not a shop attribute; do not imply a shop-township relation.

### Dependencies and implementation gate

- No new frontend package is needed for the first slice. Existing React Query and UI primitives support the page; introduce charting only for an approved chart requirement.
- Consume API types generated from `delivery_solution_api` OpenAPI; never hand-edit `src/types/api.ts`.
- Delivered and verified with backend e2e role checks (OWNER/ADMIN/OFFICER allowed; RIDER denied), frontend `pnpm lint`, `pnpm build`, existing tests, and generated OpenAPI types.

## Later work

- Broader date-range reports and exports after dashboard usage validates needs and metric definitions.
- Payment/reconciliation UI only after backend Phase 6 is explicitly approved and implemented.
- Daily custody and rider shift/manifest UI only after Phase 3.6 decisions are made and backend support exists.
