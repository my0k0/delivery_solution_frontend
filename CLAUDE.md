# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vite + React (SPA) + TypeScript frontend for a single delivery company's operations backend (`d_api`, NestJS). Built: login, user management CRUD, roles CRUD, the role-permission grant grid, change-password, shops, riders, customers, township configuration, office order management/dashboard, and the RIDER delivery board. Sibling repos live in `../` (parent `delivery_solution/`): `d_api` (backend), `drizzle`. Nothing committed yet — only commit/push when the user explicitly asks.

**Locked decisions (user):**
- **Vite + React SPA + TypeScript** — not Next.js (internal ops tool, pure JSON API, no SSR).
- **Tailwind CSS + shadcn/ui** (copy-paste Radix-based components, light mode only in this pass).
- **Design system:** black & white (monochrome) — near-black `--primary` / light-gray `--accent`, neutral whites/grays, gray focus ring. Fira Sans body / Fira Code numerals. Status colors (green/amber/red via `--success`/`--warning`/`--destructive`) are functional indicators for ACTIVE/INACTIVE + badges, not chrome. Dense, scannable ops-dashboard style (not landing-page style). **Colors come from CSS tokens in `src/index.css` ONLY — never hardcode hex or named color classes (`bg-blue-*`, `text-red-*`) in components.**
- Deps to add (`src/`): `react-router-dom`, `@tanstack/react-query`, `zustand`, `axios`, `lucide-react`. Panel manager: `pnpm`, consistent with `d_api`.

## Commands

```bash
cd ../d_api && pnpm start:dev   # backend on :3000 (DB: docker compose up -d, seed: owner@mail.com + admin1/admin2@mail.com / Password1234)
pnpm dev                        # Vite dev server on :5173, proxies /api to backend
pnpm build                      # tsc + vite build
pnpm lint                       # ESLint
pnpm test                       # Vitest unit (**/*.spec.ts)
pnpm test -- <path>             # single test file / filter
```

**Do not write new tests in this repo** (standing user instruction). The pre-existing Vitest suite stays and must keep passing, but new work is gated by `pnpm lint` + `pnpm build` + manual smoke against `d_api`, never by a new spec file.

## API contract (from `d_api`, all `/api/v1`, Bearer JWT)

Source of truth: **`GET /api/v1/docs-json`** — regenerate types with `pnpm codegen` (`openapi-typescript`, needs `d_api` running), never hand-wire shapes. Key shapes to be aware of:
- `POST /auth/login` → `{ accessToken, user: UserResponseDto (id,name,email,phone,roleId,role,status,createdAt,updatedAt), permissions: string[] }`
- `GET /auth/me` → `{ user, permissions }` (call on boot to restore/validate session); `POST /auth/change-password` → 204 (backend invalidates old tokens → frontend must force logout).
- Users: `GET /users` (`search`,`roleId`,`status`,`page`,`perPage` → `{ data, meta }`), `POST /users`, `GET/PATCH/DELETE /users/:id` — gated `users.create/read/update/delete`.
- Roles: `GET /roles` / `GET|PATCH|DELETE /roles/:id` / `POST /roles` — `{ id, name, description, isSystem, userCount }`, gated `roles.*` (`roles` has 4 actions: no `export`/`import`).
- Permissions: `GET /permissions` (catalog grouped by `module`) gated `permissions.read`; `GET/PUT /permissions/roles/:roleId` (`PUT` body `{ permissions: string[] }`, replace-set) gated **`permissions.update`**. **The catalog is fixed and read-only from the frontend: `POST /permissions` and `DELETE /permissions/:name` are gone (404).**

RBAC is **dynamic** (spatie-style: `roles`/`permissions`/`role_permissions` + `users.role_id`, OWNER/ADMIN manage everything from the UI). UI must mirror backend rules:
- **The grid is fixed**: 12 modules / 62 keys across actions (`create, read, update, delete, export, import`). `view ≡ read`, `edit ≡ update`; the key is `{module}.{action}`, lowercase. `src/types/permission.ts` mirrors it as a typed union so a backend rename is a build error, not a silent 403. There is no `pickups` module or `deliveries.claim` permission; township endpoints use `orders.*`.
- `is_system` roles (OWNER): hold every permission, rows read-only/locked, zero grant rows — so read the grid from `isSystem`, **never** from `GET /permissions/roles/:roleId` (that returns empty for OWNER).
- ADMIN: manages OFFICER/created roles only; OWNER + ADMIN rows read-only; can grant only keys ADMIN itself holds; own role read-only.
- role `name` immutable after create (`PATCH /roles/:id` takes `{ description? }` only); delete-role blocked when `userCount > 0` (409 surfaces backend message).
- Offer only catalog keys in the grid (`PUT` of unknown keys 404s). A module × action the catalog doesn't define renders as an inert `·` cell. `PUT` replaces the whole set, so keys no longer in the catalog are pruned on save.

### Phase 3.5 operations flows

- Contract details, exact rider-board fields, permissions, query parameters, and office/rider route behavior are recorded in `BACKEND_PHASE_3_5_HANDOFF.md`; use it alongside generated `src/types/api.ts`.
- `src/features/townships/` owns office township list/create/edit/delete. Each township has a required `defaultDeliveryFee` (decimal string) shown in the list and prefilled into order entry, and a required integer `leadTimeDays` that drives the order's estimated delivery date. There is no `selectable` field or `selectable=true` query. Townships can be deleted (`DELETE /townships/{id}`, gated on `townships.delete`), except while orders still reference them — the API answers 409.
- `src/features/riders/` owns rider administration and the assignable-rider list (`GET /riders/assignable`) used by order creation. Township and rider are independent — riders have no `townshipIds`; do not send or render township coverage. The flattened rider API's `id` is the account identity used for rider updates/deletion.
- `src/features/orders/` owns office order creation/list/detail. Creation loads all townships via `GET /townships`, requires a township and an active rider chosen from `GET /riders/assignable`, prefills the editable delivery fee from the township's `defaultDeliveryFee`, and submits `townshipId`, `riderId`, and the fee shown. The rider list is the same for every township. Order editing and reassignment are out of scope; do not add an edit modal. Show the returned township and rider in office surfaces and surface API errors on submit.
- Office order detail is organized into labeled sections for order/status, customer and shop, delivery, package/notes, and order history. Keep new office order detail surfaces consistent with that grouping.
- `src/features/rider-board/` is a RIDER-only route at `/rider`, outside the office `AppShell`. The authenticated root/login redirect sends RIDER users there. Rider APIs self-scope from the JWT; do not authorize by query params or request office orders for rider views. RIDER must not receive `orders.read`.
- Every rider-board row is the authenticated rider's own order with full details and a `deliveryAttemptId`; there is no `mine|all` filter (do not send `filter`) and no colleague redaction branch. `isMine` is deprecated and always `true` — do not rely on it. Send a calendar date string (`YYYY-MM-DD`) without UTC ISO slicing; metrics and rows share the selected assignment date. COD values remain decimal strings; display formatting must not change values used in calculations.
- Only `status === 'ASSIGNED'` shows complete/fail actions. `deliveryAttemptId` is always present on rider-board rows.
- Order/delivery statuses are `ASSIGNED | DELIVERED | FAILED`. No unassigned pool, claim/start action, pickup flow, `OUT_FOR_DELIVERY`, `STARTED`, or `RETURNED` order state. Shift/manifest, custody-return, and failure-threshold workflows are deferred.
- The office dashboard is a separate, read-only `/dashboard` surface gated by `reports.read`. The backend permits OWNER/ADMIN/OFFICER and denies RIDER. Follow `PLAN.md` and `../d_api/PLAN.md` (“Office dashboard — first slice COMPLETE”); do not reuse rider dashboard APIs for office totals, and do not present status-derived COD sums as cash collected/reconciled or invent on-time/custody metrics.

## Architecture (planned layout)

- `src/lib/api/` — thin `http` wrapper (axios): attaches `Authorization: Bearer <token>`; on 401 clears session + redirects `/login` (skip loop on `/auth/login` and boot-time `/auth/me`). Request/response types come from `src/types/api.ts`, generated by `openapi-typescript` (see Types & Codegen).
- `src/lib/store/` (zustand) — auth store: `token`, `user`, `permissions`, `setSession`, `clearSession`, `hasPermission(key: PermissionKey)`; token persisted in `localStorage`. `permissions` stays `string[]` (server data); `PermissionKey` is assignable to it.
- `usePermission` hook + `<ProtectedRoute perm="users.read">`: route-level gate → 403 page; button/link-level gate hides element. Both take a `PermissionKey`, so a stale key fails to compile. Mirrors backend grants so UI hides what the API would 403.
- `src/components/layout/AppShell` — sidebar (desktop ≥1024px, mobile collapsible drawer), topbar with role badge + dropdown (Change Password / Logout), `<Outlet/>`.
- `src/features/auth|users|roles|permissions|settings|shops|riders|customers|townships|orders|dashboard|rider-board/` — one folder per domain, each owning its **`api.ts`** (query-key factory + fetch fns + `use*` hooks), **`validations.ts`** (zod schemas + inferred `*Values` types), optional **`mappers.ts`** (pure DTO↔form-state translation), and its pages/dialogs/forms. Cross-feature access is a **direct feature→feature import** (`features/users/api.ts` imports `rolesKeys` from `@/features/roles/api`) — no `lib/` indirection layer. Example: `features/settings/ChangePasswordPage.tsx` imports from `@/features/auth/api` + `@/features/auth/validations`.
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
- Correctness bar: `pnpm lint` zero errors and `pnpm build` (tsc) green before calling work done, plus a manual smoke pass against `d_api`. No new spec files — see Tests above.

### Types & Codegen (do right after scaffold)

- DevDep `openapi-typescript`; script `"codegen": "openapi-typescript http://localhost:3000/api/v1/docs-json -o src/types/api.ts"` (`d_api` must be running). Commit the generated `src/types/api.ts` — it is the **source of truth** for all request/response types.
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
