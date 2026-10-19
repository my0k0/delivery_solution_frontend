# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vite + React (SPA) + TypeScript frontend for a single delivery company's operations backend (`delivery_solution_api`, NestJS). Built: login, user CRUD, role CRUD, the role-permission grant grid, change-password, shops, riders, customers, township configuration, delivery partners, per-order rider commission, office order management (create/edit/audit, assign, postpone, cancel, the delivery-confirmation queue, send-back, partner mark-delivered), rider cash handovers, office and rider reports, and the shop portal. The backend lives in the sibling repo `../delivery_solution_api`; the order lifecycle and detailed API behavior are recorded in `docs/delivery-workflow-v2.md`. Work is committed on branch `feature/main_v2`; the standing rule is still to commit/push only when the user explicitly asks.

**Locked decisions (user):**
- **Vite + React SPA + TypeScript** — not Next.js (internal ops tool, pure JSON API, no SSR).
- **Tailwind CSS + shadcn/ui** (copy-paste Radix-based components, light mode only in this pass).
- **Design system:** black & white (monochrome) — near-black `--primary` / light-gray `--accent`, neutral whites/grays, gray focus ring. Fira Sans body / Fira Code numerals. Status colors (green/amber/red via `--success`/`--warning`/`--destructive`) are functional indicators for ACTIVE/INACTIVE + badges, not chrome. Dense, scannable ops-dashboard style (not landing-page style). **Colors come from CSS tokens in `src/index.css` ONLY — never hardcode hex or named color classes (`bg-blue-*`, `text-red-*`) in components.**
- Dependencies (`src/`): `react-router-dom`, `@tanstack/react-query`, `zustand`, `axios`, `lucide-react`. Package manager: `pnpm`, consistent with `delivery_solution_api`.

## Commands

```bash
cd ../delivery_solution_api && pnpm start:dev   # backend on :3000 (DB: docker compose up -d, seed: owner@mail.com + admin1/admin2@mail.com / Password1234)
pnpm dev                        # Vite dev server on :5173, proxies /api to backend
pnpm build                      # tsc + vite build
pnpm lint                       # ESLint
pnpm test                       # Vitest unit (**/*.spec.ts)
pnpm test -- <path>             # single test file / filter
```

**Do not write new tests in this repo** (standing user instruction). The pre-existing Vitest suite stays and must keep passing, but new work is gated by `pnpm lint` + `pnpm build` + manual smoke against `delivery_solution_api`, never by a new spec file.

## API contract (from `delivery_solution_api`, all `/api/v1`, Bearer JWT)

Source of truth: **`GET /api/v1/docs-json`** — regenerate types with `pnpm codegen` (`openapi-typescript`, needs `delivery_solution_api` running), never hand-wire shapes. Key shapes to be aware of:
- `POST /auth/login` → `{ accessToken, user: UserResponseDto (id,name,email,phone,roleId,role,status,createdAt,updatedAt), permissions: string[] }`
- `GET /auth/me` → `{ user, permissions }` (call on boot to restore/validate session); `POST /auth/change-password` → 204 (backend invalidates old tokens → frontend must force logout).
- Users: `GET /users` (`search`,`roleId`,`status`,`page`,`perPage` → `{ data, meta }`), `POST /users`, `GET/PATCH/DELETE /users/:id` — gated `users.create/read/update/delete`.
- Roles: `GET /roles` / `GET|PATCH|DELETE /roles/:id` / `POST /roles` — `{ id, name, description, isSystem, userCount }`, gated `roles.*` (`roles` has 4 actions: no `export`/`import`).
- Permissions: `GET /permissions` (catalog grouped by `module`) gated `permissions.read`; `GET/PUT /permissions/roles/:roleId` (`PUT` body `{ permissions: string[] }`, replace-set) gated **`permissions.update`**. **The catalog is fixed and read-only from the frontend: `POST /permissions` and `DELETE /permissions/:name` are gone (404).**

RBAC is **dynamic** (spatie-style: `roles`/`permissions`/`role_permissions` + `users.role_id`, OWNER/ADMIN manage everything from the UI). UI must mirror backend rules:
- **The grid is fixed**: 14 modules / 46 keys, and each module holds only the actions it actually guards — `create`/`read`/`update`/`delete` is the common set, with `export` on `reports`/`shop-reports`, `create`/`read`/`update` with **no delete** on `rider-handovers`, and the extras `orders.cancel`/`orders.update_after_approval`/`orders.shop_settlement` and `deliveries.approve`. Modules: `users`, `roles`, `permissions`, `shops`, `customers`, `riders`, `orders`, `deliveries`, `townships`, `partners`, `shop-portal`, `shop-reports`, `reports`, `rider-handovers` (the list follows `MODULE_ACTIONS` order). There is no `*.import` action, and no key exists without an endpoint behind it. `view ≡ read`, `edit ≡ update`; the key is `{module}.{action}`, lowercase. `src/types/permission.ts` mirrors it as a typed union (`MODULE_ACTIONS` + `ACTION_ORDER`) so a backend rename is a build error, not a silent 403. There is no `pickups` module or `deliveries.claim` permission. The `returns`, `payments`, and `notifications` modules were deleted, and townships and partners have their own `townships.*` / `partners.*` keys.
- `is_system` roles (OWNER): hold every permission, rows read-only/locked, zero grant rows — so read the grid from `isSystem`, **never** from `GET /permissions/roles/:roleId` (that returns empty for OWNER).
- ADMIN: manages OFFICER/created roles only; OWNER + ADMIN rows read-only; can grant only keys ADMIN itself holds; own role read-only.
- role `name` immutable after create (`PATCH /roles/:id` takes `{ description? }` only); delete-role blocked when `userCount > 0` (409 surfaces backend message).
- Offer only catalog keys in the grid (`PUT` of unknown keys 404s). A module × action the catalog doesn't define renders as an inert `·` cell. `PUT` replaces the whole set, so keys no longer in the catalog are pruned on save.

### Workflow v2 operations flows

The authoritative spec is `docs/delivery-workflow-v2.md` (synced from the API repo, including its **As built** section); use it alongside generated `src/types/api.ts`. `BACKEND_PHASE_3_5_HANDOFF.md` is the historical Phase 3.5 handoff and is superseded.

- **Order lifecycle:** `PENDING → ASSIGNED → AWAITING_APPROVAL → DELIVERED`, with `DELIVERED` and `CANCELLED` terminal — no transition out of either, and **no edit in**: `PATCH /orders/:id` refuses a terminal order with 409, so the detail page offers no Edit action for it. The shop advance is a settlement rather than an edit, so it keeps its own endpoints. Clearing the assignee or postponing returns an order to `PENDING`; `CANCELLED` covers both a called-off delivery and a package that came back to the shop (the former `RETURNED` state was merged into it). All transitions go through the API's order-state service and are written to order history.
- **Order actions:** create (`POST /orders`), audited edit (`PATCH /orders/:id`, `GET /orders/:id/audit`), assign, postpone, cancel, approve, send-back, and partner mark-delivered. Riders submit delivered via `POST /riders/me/orders/:id/delivered`; officers confirm deliveries at `/orders/approval` (the page is headed **Confirm deliveries** — the route and the `deliveries.approve` permission did not change).
- **No office view renders an id.** `GET /orders/:id` resolves `shopName` / `customerName` / `townshipName` / `assigneeName`, each history row carries `changedByName`, and the audit read resolves identifier values (`shopId`, `customerId`, `townshipId`, `riderId`, `partnerId`) to the referenced record's name. An OFFICER holds `orders.read` without `shops.read` / `customers.read` / `riders.read`, so a client-side lookup cannot do this — keep the resolution server-side.
- `src/features/townships/` owns township list/create/edit/delete, gated by `townships.*`. Each township has a required `defaultDeliveryFee` (decimal string), a required `defaultCommissionFee` (decimal string), and a required integer `leadTimeDays`. A township carries **no** assignee and no coverage list — the optional default assignee (rider or partner) was removed from both repos on 2026-10-18. There is no `selectable` field. A township can be deleted except while orders still reference it — the API answers 409.
- `src/features/partners/` owns delivery-partner administration (`partners.*`; the API path is `/delivery-partners`). Partner orders never carry a rider commission — the API forces `commissionFee` to `'0'` for a PARTNER assignee — and are marked delivered by an officer directly.
- `src/features/riders/` owns rider administration and the rider pages: `RiderBoardPage` (`/rider-board`) and `RiderDashboardPage` (`/rider-dashboard`). Riders have no `townshipIds` — township and rider are independent in both directions, so do not send or render township coverage, and a township has no default assignee to point at a rider.
- **Rider commission is per order, not per way.** `orders.commissionFee` is prefilled from the township's required `defaultCommissionFee` (an officer can still override it per order, and a rider-level override is gone). A terminal order cannot be edited, so there are no post-approval money edits; the shop advance on a delivered order is the one post-approval money change and needs `orders.update_after_approval` with a reason. The `ways` module, `orders.update_costs`, `riders.commissionPerWayOverride`, and the `pay-anyway` flow were all removed; a partner order's commission is always `'0'`.
- **Rider handovers (`src/features/rider-handovers/`, route `/rider-handovers`, nav "Rider handovers" in the Orders group):** the office records cash a rider hands back — `POST /rider-handovers` (rider, amount, received method, required received date, optional note), `PATCH /rider-handovers/:id` (correct in place; the reason is required), `GET /rider-handovers` (history, filterable, paginated), `GET /rider-handovers/:id/audit` (a plain array, oldest first, like `GET /orders/:id/audit`), and `GET /rider-handovers/balances` (one row per rider). Gated by `rider-handovers.create`/`read`/`update` with **no delete**: a correction keeps the row and writes each changed field to `rider_handover_audit`, and a duplicate or reversed transfer is corrected down to `0.00` rather than removed. Recording starts from the rider's balances row rather than a page-level button, so the entry is always checked against that rider's outstanding amount; an amount above it is confirmed by the officer (naming the balance, the amount and the difference) and then recorded, not refused. A balance is all-time `DELIVERED` COD minus everything accepted, computed in Postgres `numeric` and returned as a decimal string; awaiting-approval COD counts toward neither side, a handover is never net of commission, and a negative balance stays visible (`outstandingOnly` filters `balance <> 0`). The balance is an aggregate, not a ledger: it does not reconcile against specific orders, and no screen may present it as reconciled.
- Office order detail groups order/status, customer and shop, delivery, package/notes, and history into labeled sections; keep new detail surfaces consistent with that grouping.
- **Rider boundary:** the rider routes are RIDER-only and now sit inside the office `AppShell`. Rider APIs self-scope from the JWT; do not authorize by query params or request office orders for rider views. RIDER must not receive `orders.read`. Riders see only their own orders — there is no `mine|all` filter, colleague redaction, or `deliveryAttemptId` (delivery attempts were retired in v2).
- Send calendar dates as `YYYY-MM-DD` without UTC ISO slicing; money values (COD, fees, partner cost, commission) stay decimal strings, and display formatting must not change the values used in calculations.
- `src/features/shop-portal/` owns the shop surface at `/shop/*`. Shop scope comes from the authenticated user's `shopId` server-side; shop DTOs exclude rider/partner identity, partner cost, internal notes, and audit fields.
- Reports live under `src/features/reports/` (`/dashboard`, `/reports/orders`, `/reports/shop-statement`, `/reports/rider-collection`, `/reports/rider-payout`), all gated by `reports.read`. Do not reuse rider dashboard APIs for office totals, and do not present status-derived COD sums as cash collected/reconciled or invent on-time/custody metrics. Phase 6 (payment ledger, reconciliation, shop prepayments) remains blocked.

## Architecture (planned layout)

- `src/lib/api/` — thin `http` wrapper (axios): attaches `Authorization: Bearer <token>`; on 401 clears session + redirects `/login` (skip loop on `/auth/login` and boot-time `/auth/me`). Request/response types come from `src/types/api.ts`, generated by `openapi-typescript` (see Types & Codegen).
- `src/lib/store/` (zustand) — auth store: `token`, `user`, `permissions`, `setSession`, `clearSession`, `hasPermission(key: PermissionKey)`; token persisted in `localStorage`. `permissions` stays `string[]` (server data); `PermissionKey` is assignable to it.
- `usePermission` hook + `<ProtectedRoute perm="users.read">`: route-level gate → 403 page; button/link-level gate hides element. Both take a `PermissionKey`, so a stale key fails to compile. Mirrors backend grants so UI hides what the API would 403.
- `src/components/layout/AppShell` — sidebar (desktop ≥1024px, mobile collapsible drawer), topbar with role badge + dropdown (Change Password / Logout), `<Outlet/>`.
- `src/features/auth|users|roles|permissions|settings|shops|riders|customers|townships|partners|orders|rider-handovers|reports|shop-portal|errors/` — one folder per domain, each owning its **`api.ts`** (query-key factory + fetch fns + `use*` hooks), **`validations.ts`** (zod schemas + inferred `*Values` types), optional **`mappers.ts`** (pure DTO↔form-state translation), and its pages/dialogs/forms. The rider board (`/rider-board`) and rider dashboard (`/rider-dashboard`) pages live in `features/riders/`. Cross-feature access is a **direct feature→feature import** (`features/users/api.ts` imports `rolesKeys` from `@/features/roles/api`) — no `lib/` indirection layer. Example: `features/settings/ChangePasswordPage.tsx` imports from `@/features/auth/api` + `@/features/auth/validations`.
- `src/config/` — app-level static config (e.g. `src/config/navigation.ts` — sidebar `NAV_ITEMS` + `firstAllowedPath`). NOT in `lib/`.
- `src/types/` — `api.ts` (codegen, read-only) + `permission.ts` (hand-written mirror of the backend's `permission-keys.ts`: `MODULE_ACTIONS`, `PermissionKey`, `ACTION_ORDER`). The catalog is fixed, so keys autocomplete at compile time; which cells *exist* still comes from the API response.
- `src/components/ui/` — shadcn components: `button`, `input`, `label`, `card`, `dialog`, `table`, `dropdown-menu`, `badge`, `select`, `alert-dialog`, `sonner`, `skeleton`, `pagination`, `checkbox`.
- `src/components/form/` — field primitives, one responsibility each: `Form` (`FormProvider` + `<form>`, `noValidate`), `FormBody` (scroll region), `FormField` (label + control + inline error), `FormFooter` (Close/Submit), `FormAlert` (root/API error), `TextField`, `SelectField`, `CheckboxField`, `FilterSelect`. `SelectField` is RHF-bound (needs `control`); `FilterSelect` is the controlled, RHF-free one for filter toolbars.
- `src/lib/constants/` — shared cross-feature values: `user-status.ts` (`USER_STATUSES`, `UserStatusValue`, `USER_STATUS_OPTIONS`, `userStatusLabel`, `userStatusTone`, `toUserStatus`). Feature-owned enums stay in the feature: `features/riders/vehicle-types.ts`, `features/shops/channel-types.ts`.

## Naming conventions (mandatory)

- **No abbreviations.** Full words: `permission`/`permissions`, not `p`/`perm`; `role` not `r`; `user` not `u`. Single letters only for loop indexes. No crypto-short file names either — `navigation.ts` not `nav.ts`, `nullable.ts` not `narrow.ts`.
- **Files** — kebab-case components in `components/`, PascalCase page files in `features/`: `UsersPage.tsx`, `LoginPage.tsx`, `RoleDialog.tsx`, `usePermission.ts`. Helper/util files: `auth.store.ts`, `http.ts`. Types: `api.ts` (codegen), `permission.ts`.
- **Components** — PascalCase, `<XxxPage>` / `<XxxDialog>` / `<XxxForm>`: `UsersPage`, `AppShell`, `EmptyState`.
- **Functions & hooks** — camelCase, verb-first; `use` prefix for hooks: `usePermission`, `filterAssignableRoles`, `hasPermission`, `setSession`, `clearSession`.
- **Variables** — camelCase, descriptive: `permissions` (array), `role`, `currentUser`, `dirtyState`.
- **Constants** — UPPER_SNAKE_CASE: `VITE_API_URL`, query keys.
- **Booleans** — `is`/`has`/`can` prefix: `isSystem`, `hasPermission`, `isDirty`.
- **Types & interfaces** — PascalCase, `Props` suffix on component props, DTO-suffixed on API shapes: `UserResponseDto`, `LoginPageProps`. Generated types (codegen) are read-only inputs, never hand-edited.

## Dialogs & forms (mandatory)

The user asked for **one responsibility per file, separate files** — do not co-locate a dialog with its form.

- `XDialog.tsx` owns the dialog and nothing else: `open`/`onClose` (flat props, never a `state={{ open, x }}` wrapper), the copy, which mutation runs, and the toasts. It contains **no inputs**.
- `XForm.tsx` exports the fields and nothing else — one component, `XFormFields()`. It reads `register`/`control`/`errors` from `useFormContext`, so it takes only what the form genuinely can't derive (mode, query-backed options).
- `mappers.ts` (feature root) holds the pure DTO↔form-state functions: `toXFormValues`, `toXRequestBody`, `EMPTY_X`. Pure, no JSX — keeps the form file to a single component export and avoids `react-refresh/only-export-components` warnings.
- **One schema per entity, mode-aware**: `xSchema(isEditing)` instead of paired create/update schemas. Relax a rule by *not adding it*, never by `.min(0)` — Zod v4 accumulates string checks, so `z.string().min(1).min(0)` still fails. Keep both branches `z.string()` rather than `.optional()` so the inferred value type stays `string` and the request body needs no `?? null` on a field a form can't leave absent.
- **No `key={xToEdit?.id ?? 'new'}` remount hacks.** `useForm({ values })` re-seeds when the target changes; `handleClose` calls `form.reset(formValues)` for the same-mode reopen case. Reset on close is load-bearing — half-typed input and a stale 409 banner must not survive a reopen.
- Two forms are correct ONLY when the modes share no editable field (roles: `name` is immutable after create). Users share 4 of 5 fields, so they stay one mode-driven form.
- Structure inside `<Form>`: `DialogHeader` (pinned) → `FormBody` (the only scroll region) → `FormAlert` → `FormFooter` (pinned).
- `FormBody` must be **inside** `<Form>` — the submit button only submits fields in the same `<form>` element.

## Enum values (mandatory)

One source of truth per value set; never hand-write a union a second time.

- Feature-owned sets get a module in the feature folder: `vehicle-types.ts`, `channel-types.ts`. Cross-feature ones go in `src/lib/constants/` (user status is read by both `users` and `riders`).
- Each exports the tuple (`CHANNEL_TYPES`), the derived union (`ChannelType`), `*_OPTIONS` **derived from the tuple**, and a `*Label`/`*Tone` helper. The tuple feeds `z.enum(...)` directly, so a backend rename is a compile error, not a silent validation hole.
- Keep `*_OPTIONS` at module scope — Base UI memoises its `items` label map off that array's identity, and an inline literal rebuilds it every render.
- Shared badge colour is `badgeClass(tone: BadgeTone)` in `lib/utils`, keyed on `'positive' | 'warning' | 'negative'` — **not** on a domain value. A caller asks for the colour it wants; a caller that has a status maps it first via `userStatusTone`.

## Skills — invoke before writing frontend code

Check the table at the start of every task touching UI; if a row matches, invoke the skill before writing code. Multiple can apply.

| Task touches | Invoke |
|---|---|
| App screens, CRUD, forms, components, responsive layouts | `ui-ux-pro-max` (or `ui-ux-pro-max:ui-styling` for styling-only) |
| Landing/marketing pages, visual polish, aesthetic direction | `taste` (on top of `ui-ux-pro-max`) |
| Any dashboard metric summary, chart, graph, KPI tile, or data visualization | `data-visualization` (before implementation; confirm metric definitions against the API contract first) |
| Logos, banners, decks, icon sets, brand assets | `ui-ux-pro-max:design` |
| Library/framework/SDK docs question | `ctx7` CLI (see `~/.claude/rules/context7.md`) |
| Code review / quality pass on changes | `code-review` |

Layering: `ui-ux-pro-max` (usability/structure) → `taste` (visual polish) — `taste` never overrides usability/accessibility. Pure-logic/API work needs no skill; when unsure, invoke anyway.

## Conventions

- One primary CTA per screen; touch targets ≥40px; loading skeletons on data fetch; visible field labels, inline errors below fields, show/hide password toggle.
- React Query keyed on filter state (search/role/status/page) with refetch-on-mutation; pagination control wired to `meta`.
- Create-dialog role Select must be restricted per the same hierarchy rule that restricts ADMIN (hide OWNER/ADMIN for ADMIN callers).
- Keep contrast ≥4.5:1; focus rings visible; 375px viewport must not scroll horizontally. Defer dark mode.
- Correctness bar: `pnpm lint` zero errors and `pnpm build` (tsc) green before calling work done, plus a manual smoke pass against `delivery_solution_api`. No new spec files — see Tests above.

### Types & Codegen (do right after scaffold)

- DevDep `openapi-typescript`; script `"codegen": "openapi-typescript http://localhost:3000/api/v1/docs-json -o src/types/api.ts"` (`delivery_solution_api` must be running). Commit the generated `src/types/api.ts` — it is the **source of truth** for all request/response types.
- Keep hand-written types in a separate file (not in `api.ts`) so codegen never clobbers them.

### shadcn / Base UI (base-nova) — gotchas

- Menu/Dropdown items fire **`onClick`**, NOT Radix's `onSelect`. Use native event handlers.
- Menu items and `DropdownMenuLabel` must nest inside a `<DropdownMenuGroup>` — Base UI throws `MenuGroupContext is missing` (white screen) otherwise.
- Do NOT compose triggers via `render={<Button/>}` when the inner component itself uses `useRender` (base-nova Button) — it double-owns the DOM node and breaks the menu context. Prefer a plain `<DropdownMenuTrigger className="...">` styled with tokens.
- `<Label>` has no `required` visual — mark requiredness with text; Zod enforces.
- **A `fixed`, viewport-centred popup overflows off BOTH screen edges and is unscrollable** unless it has a `max-height`. `body` cannot scroll a `fixed` element, so an uncapped dialog hides its own first field and its submit button. This shipped a real bug: the 12-field rider form was taller than a 13" MacBook's ~760px viewport and its Save button sat at y=881, unreachable. `DialogContent` is now `flex flex-col` + `max-h-[calc(100vh-2rem)]` + `supports-[height:100dvh]:…` + `overflow-hidden`.
- **Every element between the popup and the scroll region needs `min-h-0`** — the popup, the `<form>`, and the scroll `div`. A flex item defaults to `min-height: auto` and refuses to shrink below its content, so `flex-1` alone silently does nothing and `overflow-y-auto` never engages. This is the single most likely cause of "my dialog won't scroll" — check the whole ancestor chain, not just the div that has `overflow`.
- Don't add `flex-1` (basis 0) to the `<form>`: a short form would then collapse the popup to zero height. Content-sized basis + `min-h-0` is the combination that shrinks only when it has to.
- Base UI `Select` resolves the trigger's label from the **`items` map, not the `SelectItem` children**. If a current value is excluded from the rendered options (e.g. an ADMIN editing a role they may not assign), the trigger shows a raw id — include it in the options to keep the name visible.
- Two conflicting `max-h-*` utilities (e.g. `100vh` and `100dvh`) have equal specificity and Tailwind's class order decides the winner unpredictably. Use `supports-[height:100dvh]:` for the progressive override instead.

### Type safety / code quality (mandatory)

- **No `any`** anywhere. Type everything: components props with explicit interfaces, event/param types, axios error handling via `unknown` + narrowing (one shared `ApiError` helper reading `error.response?.data`). `@typescript-eslint/no-explicit-any` stays on.
- No `@ts-ignore` / `@ts-expect-error` / bare `!`. Codegen output may carry `Record<string, never>`/loose union stubs — narrow with a typed helper or explicit DTO interface instead of casting to `any`.
- Use `unknown` at trust boundaries, then narrow with type guards. Prefer `satisfies` for const config arrays bounded by a broader type.
- Route/button gates read the zustand `permissions[]` via one shared `usePermission`/`<Can>` — never duplicate the permission-matrix in components.
- **One component export per file** in a `components/` folder. A file that exports a component *and* a constant or helper trips `react-refresh/only-export-components`; move the non-component to `mappers.ts` / `lib/` rather than suppressing the rule.
- `useFormContext` is only safe *inside* `<Form>`. A fields component rendered outside it throws at runtime, and `tsc` cannot catch that — keep the provider in the parent dialog, never in the fields file.
- A controlled `Select` needs its options list to include the current value (see Base UI gotchas). Narrow the callback's `string` with a real `options.some(...)` type guard, not `as` — a hand-written `value === 'A' || value === 'B'` chain silently does nothing when an option is added.
- **No `setState` inside `useEffect` keyed on a fresh-reference value** (`new Set()`, `new Array()`, `[]` via `?? default` when a React Query is disabled/error/`undefined`). This causes an infinite render loop ("Maximum update depth exceeded" → page freezes). Instead: derive the display value from the query response directly, or use the derive-or-own draft pattern (`useState<{roleId: string; set: Set<string>} | null>(null)`) — no effect, no loop.
- `react-hooks/exhaustive-deps` is **error**, not warn. Never `eslint-disable` it — that's how the freeze shipped. If a dep is genuinely unsafe, isolate the value with `useRef` or restructure; do not suppress the rule.
- **Verify layout in a real browser, not jsdom.** jsdom has no layout engine, so `max-h`, `overflow-y-auto` and `min-h-0` all "pass" while the real page is broken. For any height/scroll/position change, build (`pnpm build`), hand-write a throwaway HTML harness under `dist/` that reuses the built CSS and mirrors the real DOM structure, serve it (`python3 -m http.server`), and measure `clientHeight`/`scrollHeight`/`getBoundingClientRect()` with `agent-browser`. Delete the harness afterwards. This is how the unreachable-Save-button bug was found and confirmed fixed.


### React Query (mandatory)

- **Cross-key invalidation**: a mutation must invalidate ALL query keys whose data it affects, not just its home domain. Example: user create/update/delete invalidate `usersKeys.all` **and** `rolesKeys.all` — `role.userCount` is derived from membership, so only invalidating users leaves RolesPage stale for 60s.
- **QueryClient defaults** (`src/App.tsx`): `retry` only on 5xx or network error (`status == null || status >= 500`) — never retry a 403/404 (it will fail 3× more); default `staleTime: 10_000`.
- **Per-query `staleTime` overrides** are still fine for stale-but-correct static catalogs (roles, permission catalog = 60s). Mutation invalidation bypasses `staleTime`, so edits still refetch instantly.
- Grant grid: keep `staleTime` on `useRoleGrants`, and always reset the derive-or-own `draft` on role switch and after save. A system (OWNER) role's checked set comes from `layoutDefinedKeys(buildGridLayout(catalog))`, never from the grants query.
