# Backend Phase 3.5 — Frontend Implementation Handoff

**Status:** HISTORICAL — SUPERSEDED by workflow v2. This is the Phase 3.5 handoff as it stood before workflow v2 shipped; keep it for historical context only. The current order lifecycle, endpoints, permission catalog, and shop/rider behavior are in `docs/delivery-workflow-v2.md` (see its **As built** section). Everything below describes the pre-v2 system and is out of date: order/delivery statuses are no longer `ASSIGNED | DELIVERED | FAILED`, the rider board no longer uses `deliveryAttemptId` or `GET /rider/board`, order creation no longer requires `GET /riders/assignable`, the rider route is `/rider-board` inside the office shell rather than `/rider`, townships do have a delete endpoint, and the permission catalog is 14 modules / 69 keys rather than 12 / 62.

**Frontend repository:** Vite + React + TypeScript SPA. Follow the existing `CLAUDE.md` conventions. The frontend project instructions prohibit adding new test files.

## Start here

1. If the backend API changes, start `../delivery_solution_api` with `pnpm start:dev` and ensure migrations and seed grants are applied.
2. Regenerate the API contract with `pnpm codegen` after an API change. `src/types/api.ts` is generated and must not be hand-edited.
3. Follow the implementation details below when maintaining or extending these flows.
4. Run `pnpm lint`, `pnpm build`, and the existing tests; manually smoke against the backend. Do not add new test files in this repository.

The backend OpenAPI contract at `GET /api/v1/docs-json` is the authoritative source if a detail in this handoff and generated schema ever differ.

## Business flow

- Someone outside this system collects packages from customers and brings them to the office. That pickup journey is not in the application.
- Office staff insert an order only after its package is at the office.
- Order creation requires a township and an explicit active rider chosen by the staff member from `GET /riders/assignable`. Township and rider are independent — there is no round-robin and no township coverage.
- There is no unassigned queue, claim action, pickup state, `OUT_FOR_DELIVERY`, `STARTED`, or delivery-start tap.
- The rider marks an assigned order delivered or failed directly. Failed orders are retried by an office user; maximum attempts remains three.
- The separate daily sign-out/return/re-sign workflow and the client's 5-of-10 rule are deferred. Do not add shift, custody, or undelivered-return UI in this phase.

## Backend contract

All routes use `/api/v1` and bearer authentication.

### Townships

| Method and path | Permission | Result / use |
|---|---|---|
| `GET /townships` | `orders.read` | All townships with `defaultDeliveryFee`. No `selectable` field, and no `selectable=true` query (unsupported). |
| `POST /townships` | `orders.create` | Body `{ name: string, defaultDeliveryFee: string }`. |
| `PATCH /townships/:id` | `orders.update` | Body `{ name?: string, defaultDeliveryFee?: string }`. No delete endpoint. |

Township DTO: `{ id, name, defaultDeliveryFee, createdAt, updatedAt }`. `defaultDeliveryFee` is a required decimal string (`200`, `200.5`, `200.00`). It is prefilled into order entry but is **not** changed by creating an order; an order stores its own explicit fee. Existing townships were backfilled to `0.00` and can be updated through township administration.

### Rider assignment

- `GET /riders/assignable` requires `orders.create` and returns `{ id, name }[]` for active riders only.
- The assignable list is independent of the selected township. Do not filter riders by township.
- `POST /riders` and `PATCH /riders/:id` no longer accept `townshipIds`, and `RiderResponseDto` no longer returns it. Sending `townshipIds` fails validation.
- An inactive rider is not eligible for new assignments. There is no `isAvailable` field.

### Orders and delivery state

- `POST /orders` requires `townshipId`, `riderId`, and `deliveryFee` in addition to the existing required `shopId` and `customerId`.
- The rider must be an active, assignable rider. A missing/unknown township or rider returns HTTP 400; show the API's message.
- If `deliveryFee` is omitted the backend falls back to the township's `defaultDeliveryFee`, but the UI always sends the fee shown in the editable input. An explicit order fee is stored on that order and does **not** change the township default.
- An order is returned already `ASSIGNED`, with the selected rider. The create response includes `townshipId`, `townshipName`, `riderId`, `riderName`, and nullable `riderPhone` as well as the existing order fields.
- Order editing and reassignment are out of scope for this change; do not add an edit modal or reassignment UI.
- `OrderStatus` is exactly `ASSIGNED | DELIVERED | FAILED`.
- `DeliveryStatus` is exactly `ASSIGNED | DELIVERED | FAILED`.
- `DeliveryHistoryEvent` no longer contains `STARTED`.
- There is no `RETURNED` state in this phase. The later custody-return state is a different concept and has not been implemented.
- Office order rows/details should show township and assigned rider name. Rider phone is useful in office detail, but is not present on rider-board entries.

### Rider board and dashboard

#### `GET /rider/board`

Query parameters:

```text
date=YYYY-MM-DD       optional, defaults to today's date in APP_TIMEZONE (Asia/Yangon by default)
page=1                optional, defaults to 1
perPage=50            optional, max 100
```

`filter=mine|all` is temporarily accepted but **ignored**; do not send it. Results are always limited to the authenticated rider.

Response:

```ts
{
  date: string;
  data: RiderBoardOrder[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}
```

Every row is the authenticated rider's own order and contains full details:

```ts
{
  id: string;                  // order id
  trackingCode: string;
  status: 'ASSIGNED' | 'DELIVERED' | 'FAILED';
  townshipId: string;
  townshipName: string;
  shopName: string;
  deliveryAttemptId: string;   // use this id for complete/fail actions
  attemptNumber: number;
  isMine: boolean;             // deprecated: always true; do not rely on it
  createdAt: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  packageInfo: Record<string, unknown> | null;
  deliveryFee: string;
  codAmount: string;
  notes: string | null;
}
```

There is no redaction and no colleague-order branch: every returned row is the rider's own. `isMine` is returned as `true` only for temporary client compatibility and must not be used to gate UI.

Date is an office-local **calendar date**, not a UTC instant. Keep the selected date as `YYYY-MM-DD`; do not generate it via `toISOString().slice(0, 10)`, which can shift the day in Myanmar time. The board filters by order-creation date in `APP_TIMEZONE`.

#### Own-order actions

- Only render actions for `status === 'ASSIGNED'`. `deliveryAttemptId` is always present.
- Complete: `POST /deliveries/:deliveryAttemptId/complete`, no body.
- Fail: `POST /deliveries/:deliveryAttemptId/fail`, body `{ reason: FailureReason, note?: string }`.
- The API checks rider ownership. On success, refresh the board and dashboard.
- There is **no claim button** and **no start button**. Do not call a `/start` route.

`GET /rider/dashboard?date=YYYY-MM-DD` returns:

```ts
{
  date: string;
  assigned: number;       // open attempts in the selected assignment-date cohort
  delivered: number;
  failed: number;
  successRate: number;    // percent 0..100, zero when no completed attempts
  codCollected: string;   // decimal, e.g. "12000.00"
  codOutstanding: string; // decimal, e.g. "45000.00"
}
```

Dashboard metrics are grouped by attempt **assignment date** in `APP_TIMEZONE`; the statuses shown are the latest attempt states for that date cohort. COD strings are decimal amounts, not floating-point numbers. Format them for display without changing the API value used in calculations.

`GET /riders/me/deliveries` remains available, but the board has the order details, own/other distinction, date selection, and attempt ID required for this UI.

### Office-only delivery routes and permissions

- Riders keep `deliveries.read` and `deliveries.update` for their self-scoped rider surfaces/actions. Do not grant riders `orders.read`.
- Rider-specific board/dashboard endpoints require `deliveries.read` and self-scope by JWT.
- Office order/delivery-history reads use `orders.read`. In particular, `GET /deliveries/:id` and `GET /orders/:orderId/deliveries` are office-only now.
- Office reassign uses `PATCH /deliveries/:attemptId/reassign` and `orders.update`.
- Office assignment override and retry use `deliveries.create`; they are not rider actions.
- A rider must not be routed into the office orders page or shown office management actions. The current frontend uses permission-only gates; add an explicit role-aware rider route/shell and make the authenticated root redirect send RIDER users to the rider surface.

## Frontend work items

1. **Regenerate contract** after starting the current backend; use `components`/operation types from generated `src/types/api.ts` rather than hand-copying DTOs.
2. **Permission mirror and grant grid:** remove the `pickups` entry from `src/types/permission.ts`. The fixed catalog is now 12 modules / 62 keys, down from 13 / 68. Do not add `deliveries.claim` or a `townships.*` permission. Remove pickup-specific UI/navigation/actions.
3. **Rider admin:** no township coverage. Handle the flattened user fields and rider identity `id`, and do not send `townshipIds`. Preserve the existing split dialog/form and mapper patterns.
4. **Township configuration:** provide an office screen to create/edit townships and their required `defaultDeliveryFee`. Townships have no `selectable` flag and no delete endpoint.
5. **Office order entry/list/detail:** require a township and an active rider chosen from `GET /riders/assignable`; prefill the editable delivery fee from the township default and allow per-order override; show township/rider on list and detail; surface API 400 messages. Do not add order editing or reassignment UI.
6. **Rider route and board:** keep the explicit RIDER-only route and navigation/root redirect that does not use the office `AppShell`; keep shared date navigation, pagination, dashboard metrics, status badges, and complete/fail actions on `ASSIGNED` orders. Do not send the `filter` query and do not add a `mine|all` toggle or any redaction branch.
7. **Remove old pickup/claim/start UI:** no pickup pages, unclaimed pool, claim button, `OUT_FOR_DELIVERY` label, delivery start control, or `RETURNED` order label in this phase.
8. **Manual smoke:** OWNER/OFFICER can create a township with a fee, edit that fee, and see it listed; create an order by choosing a township and an active rider and overriding the prefilled fee; a RIDER sees only their own full-detail rows, can complete/fail only their own assigned attempt, and cannot open office order data.

## Explicitly deferred

Do not implement daily shifts/manifests, office sign-out/sign-in, failed-package custody returns, the 5-of-10 failure rule, or the related future order status. Phase 3.6 still needs client decisions on re-signing to the same/next rider and whether the threshold is enforced or reported. Phase 6 COD reconciliation questions also remain open.
