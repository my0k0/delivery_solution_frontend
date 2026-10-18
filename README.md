# Delivery Solution — Frontend

Vite + React + TypeScript operations SPA for the Delivery Solution API (`../delivery_solution_api`, NestJS). Uses React Router, TanStack Query, Zustand, Axios, Tailwind CSS, and the project’s shadcn-style UI components.

## Features

- Authentication, user and role management, and role-permission grants.
- Shop, customer, rider, township, and delivery-partner administration.
- Ways and rider commission: per-way rate, optional rider override, pay-anyway override.
- Office order management: creation with a township default assignee or an explicit rider/partner, audited editing, assignment, postponement, cancel, the approval queue, send-back, and partner mark-delivered.
- Office and rider reports: order report, shop statement, rider collection, rider payout, and the office dashboard, with CSV/XLSX export.
- Rider surface: own-order delivery board and an assignment-date dashboard.
- Shop portal: shop-scoped order list, order detail, dashboard, and statement exports.

## Local development

Start the backend in one terminal:

```bash
cd ../delivery_solution_api && pnpm start:dev  # backend at http://localhost:3000
```

Then run the frontend and checks from this repository in another terminal:

```bash
pnpm dev                       # frontend at http://localhost:5173
pnpm lint
pnpm build
pnpm test
```

The Vite server proxies `/api` to the backend. Seed credentials and database setup are documented in `../delivery_solution_api/README.md` and the project instructions in `CLAUDE.md`.

## Contract types

`src/types/api.ts` is generated from the running backend’s `GET /api/v1/docs-json`. Do not hand-edit it. With the API running, regenerate it with:

```bash
pnpm codegen
```

`src/types/permission.ts` is the frontend mirror of the fixed backend permission catalog. The catalog has 13 modules / 42 keys; townships and delivery partners have their own `townships.*` / `partners.*` permissions, and riders receive `deliveries.read` / `deliveries.update` for their own surface.

## Order workflow

- Office staff register an order after the package arrives at the office. Creation requires a township and a shop/customer, and takes an assignee: an explicit rider or delivery partner, or the township default. A township with no default assignee leaves the order `PENDING`.
- Each township carries a `defaultDeliveryFee` and a `leadTimeDays`. Selecting a township prefills the order’s editable fee (overridable per order) and the estimated delivery date.
- Townships and riders are independent; riders have no township coverage. A township may name a default assignee, and one rider can cover many townships.
- Order edits are audited field-by-field and require `orders.update`. An order that has ended (`DELIVERED`, `CANCELLED`) cannot be edited at all, so there are no post-approval money edits; the shop advance on a delivered order still needs `orders.update_after_approval` and a reason.
- Riders submit an assigned order as delivered (`AWAITING_APPROVAL`); an officer approves it or sends it back. Partner orders are marked delivered by an officer directly.
- Riders are routed to `/rider-board` (with `/rider-dashboard`) inside the office shell and see only their own orders. The board uses `YYYY-MM-DD` in the office timezone and defaults to `Asia/Yangon`.
- Order states are `PENDING`, `ASSIGNED`, `AWAITING_APPROVAL`, `DELIVERED`, and `CANCELLED`. Clearing the assignee returns an order to `PENDING`; `DELIVERED` and `CANCELLED` are terminal, and a terminal order cannot be edited. `CANCELLED` now also covers a package that came back to the shop. There is no claim/start action, pickup flow, or shift/custody workflow.
- The shop portal serves `/shop/*` with dedicated shop DTOs that exclude rider/partner identity, partner cost, internal notes, and audit data.

## Project conventions

See `CLAUDE.md` for the app architecture, permission rules, UI conventions, and contribution checks. Do not add tests in this repo; keep the existing suite passing and verify feature changes with lint, build, and a manual smoke against the backend.

## OpenCode

Run `opencode .` from the frontend repository root. `opencode.json` loads `CLAUDE.md` as project instructions, and `AGENTS.md` provides OpenCode-specific notes for Claude-only skill references and repository workflow. Use `/verify` to run lint, build, and the existing test suite. Provider authentication stays in your local OpenCode configuration, not this repository.
