# Frontend ↔ API Compatibility Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one frontend branch that carries both divergent development lines — Line A's workflow-v2 modules (ways, reports, shop portal, delivery partners, order workflow) and Line B's CRUD/forms/permissions — so every endpoint in the live API is reachable from the UI.

**Architecture:** Base the work on `main` (Line B, the branch that dropped Line A's files) and restore Line A's modules from commit `9fc8841` as *additive* directories, then reconcile the shared wiring (`App.tsx`, `navigation.ts`, `types/permission.ts`) and delete Line B's two features that call endpoints the current API no longer has (`dashboard/`, `rider-board/`). Regenerate `src/types/api.ts` from the live spec so the restored modules type-check against real schemas.

**Tech Stack:** Vite, React 19, TypeScript, React Router 7, TanStack Query 5, axios, react-hook-form + zod, Tailwind 4. Backend: NestJS at `../delivery_solution_api`, running at `http://localhost:3000`.

**Spec:** the live OpenAPI document at `http://localhost:3000/api/v1/docs-json` (56 paths) is the source of truth. The two divergent frontend lines are `git show 9fc8841:…` (Line A) and `git show main:…` (Line B).

## Global Constraints

- Work happens in the worktree `/Users/yanmyoaung/.local/share/opencode/worktree/cea5bc/workflow-v2-api-compat` on branch `rebuild/api-compat` (base `main` @ `9c4cf53`).
- API base URL is `/api/v1`; the API must be running for `pnpm codegen`.
- Do not add dependencies. `react-hook-form`, `zod`, `@hookform/resolvers`, `@tanstack/react-query`, axios are already present.
- Line A commit to restore from: `9fc8841`. Line B is `main`.
- Verification commands, in order: `pnpm codegen`, `pnpm build` (runs `tsc -b && vite build`), `pnpm lint`, `pnpm test`.
- `src/types/api.ts` is generated — never hand-edit it.
- Every task ends with `pnpm build` green before commit.

## Review Focus

- **Regenerating types while the API is down.** `pnpm codegen` against an unreachable API must not silently produce a truncated file. Assert the fresh file contains 56 paths and includes `/ways`, `/shop/orders`, `/reports/orders`.
- **Re-introducing the superseded generic CRUD.** Line A carries `src/features/master-data/` and `src/features/operations/`. Restoring them would create a second shops/customers/riders UI alongside Line B's. They must NOT be restored.
- **Stale permission mirror.** Line B's `src/types/permission.ts` lacks `townships`, `partners`, `ways`, `shop-portal`, `shop-reports`, `deliveries.approve`, and the extra order actions. If not replaced, restored modules fail to compile and gates silently mis-evaluate.
- **Two implementations of orders.** Line A's `orders/` (workflow-complete) and Line B's `orders/` (create/read only) share the same paths. Line A's must win wholesale; a mix leaves the approval/assign dialogs orphaned or the RPC calls missing.
- **`usePermission` import path.** Line A modules import `usePermission` from `@/lib/auth/gate`; Line B moved it to `@/lib/auth/usePermission`. Without a re-export, ~20 restored files fail to resolve.

---

### Task 1: Integrate both lines into one green tree

**Files:**
- Restore from `9fc8841`: `src/features/ways/**`, `src/features/reports/**`, `src/features/shop-portal/**`, `src/features/partners/**`, `src/features/orders/**`, `src/features/riders/RiderBoardPage.tsx`, `src/features/riders/RiderDashboardPage.tsx`, `src/types/permission.ts`, `src/App.tsx`, `src/config/navigation.ts`, `src/components/layout/**`
- Delete: `src/features/dashboard/**`, `src/features/rider-board/**`
- Modify: `src/lib/auth/gate.tsx` (re-export `usePermission`), `src/types/api.ts` (regenerated)
- Keep from `main` (do not touch): `src/features/shops/**`, `src/features/customers/**`, `src/features/riders/**` except the two added files, `src/features/townships/**`, `src/features/users/**`, `src/features/roles/**`, `src/components/form/**`, `src/lib/**`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `@/lib/auth/gate` exports `usePermission`, `Can`, `ProtectedRoute`, `RequireAuth`; `@/types/permission` exports the full API key union; `@/types/api` matches the live spec.

- [ ] **Step 1: Regenerate types from the live spec**

```bash
cd /Users/yanmyoaung/.local/share/opencode/worktree/cea5bc/workflow-v2-api-compat
curl -sf http://localhost:3000/api/v1/health >/dev/null || { echo "API DOWN — start it before continuing"; exit 1; }
pnpm codegen
```

- [ ] **Step 2: Verify the fresh types contain the workflow-v2 surface and no dead paths**

```bash
grep -c '"/api/v1/' src/types/api.ts           # expect 56
grep -q '"/api/v1/ways"' src/types/api.ts && echo "ways OK"
grep -q '"/api/v1/shop/orders"' src/types/api.ts && echo "shop OK"
grep -q '"/api/v1/reports/orders"' src/types/api.ts && echo "reports OK"
grep -q '/api/v1/deliveries/{id}' src/types/api.ts && echo "UNEXPECTED: dead deliveries path" || echo "no dead deliveries path — OK"
```

- [ ] **Step 3: Restore Line A's modules additively**

```bash
git checkout 9fc8841 -- \
  src/features/ways \
  src/features/reports \
  src/features/shop-portal \
  src/features/partners \
  src/features/orders \
  src/features/riders/RiderBoardPage.tsx \
  src/features/riders/RiderDashboardPage.tsx \
  src/types/permission.ts \
  src/App.tsx \
  src/config/navigation.ts \
  src/components/layout
```

- [ ] **Step 4: Delete Line B's features that call removed endpoints**

Rationale: `/rider/board`, `/rider/dashboard`, `/office/dashboard`, `/deliveries/*` do not exist in the live API (verified: 0 matches in the 56-path spec). Their replacements are Line A's `riders/RiderBoardPage.tsx`, `riders/RiderDashboardPage.tsx`, and `reports/OfficeDashboardPage.tsx`.

```bash
git rm -r src/features/dashboard src/features/rider-board
```

- [ ] **Step 5: Add the `usePermission` re-export to `gate.tsx`**

Append to `src/lib/auth/gate.tsx` so both import paths resolve, and keep `usePermission.ts` as the single definition:

```ts
export { usePermission } from './usePermission'
```

- [ ] **Step 6: Verify `permission.ts` matches the API catalog**

```bash
grep -q "townships" src/types/permission.ts && \
grep -q "partners" src/types/permission.ts && \
grep -q "ways" src/types/permission.ts && \
grep -q "'shop-portal'" src/types/permission.ts && \
grep -q "approve" src/types/permission.ts && echo "permission mirror OK"
```

- [ ] **Step 7: Build and fix import mismatches**

```bash
pnpm build
```

Expected failures and their fixes (typographical, not design):
- `Cannot find name 'usePermission'` in a restored module → Step 5 re-export missing.
- `Module '"@/features/orders/api"' has no exported member 'fetchDeliveryPartners'` → Line A's `orders/api.ts` did not land; re-run Step 3 for `src/features/orders`.
- `Property '…' does not exist on type 'components["schemas"]'` → types not regenerated; re-run Step 1.
- Missing `@/lib/money` or `@/features/orders/money` → both exist (`main` has `src/lib/money.ts`; Line A's `orders/money.ts` came with Step 3).
Iterate until `pnpm build` exits 0.

- [ ] **Step 8: Run the test suite**

```bash
pnpm test
```

Expected: PASS. If a `gate.spec.tsx` / `filterAssignableRoles.spec.ts` case fails, it is a real behavioural regression in the merged auth lib — fix the lib, do not delete the test.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: reintegrate workflow-v2 modules onto main and refresh API types"
```

---

### Task 2: Use the dedicated assignable-riders endpoint

**Files:**
- Modify: `src/features/orders/api.ts`, `src/features/orders/AssignOrderDialog.tsx`

**Interfaces:**
- Consumes: regenerated `@/types/api` (Task 1) with `AssignableRiderResponseDto`.
- Produces: `fetchAssignableRiders(): Promise<AssignableRider[]>` where `AssignableRider = { id: string; name: string }`.

- [ ] **Step 1: Add the fetcher to `src/features/orders/api.ts`**

```ts
export async function fetchAssignableRiders(): Promise<AssignableRider[]> {
  return (await http.get<AssignableRider[]>('/riders/assignable')).data
}
```

- [ ] **Step 2: Point `AssignOrderDialog` at it**

Replace the `fetchRiders({ status: 'ACTIVE' })` query with `useQuery({ queryKey: ['assignable-riders'], queryFn: fetchAssignableRiders })`; map `riderOptions` from the returned `{ id, name }[]`.

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/orders
git commit -m "feat(orders): assign to riders via /riders/assignable"
```

---

### Task 3: Pin the shop-channel requirement with a test

**Files:**
- Test: `src/features/shops/validations.spec.ts`

**Interfaces:**
- Consumes: the shops zod schema exported by `src/features/shops/validations.ts` (whatever its current export name is — read it first).
- Produces: a failing-then-passing test proving a shop body without `channelType`/`channelName` is rejected, mirroring `CreateShopDto`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { shopSchema } from './validations'   // use the actual export name

describe('shopSchema', () => {
  it('rejects a shop without a channel', () => {
    const result = shopSchema.safeParse({ name: 'Probe Shop' })
    expect(result.success).toBe(false)
  })
  it('accepts a shop with channelType and channelName', () => {
    const result = shopSchema.safeParse({ name: 'Probe Shop', channelType: 'VIBER', channelName: 'ProbeShop' })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run it**

Run: `pnpm test -- src/features/shops/validations.spec.ts`
Expected: the "rejects" case FAILS if the schema does not require the channel (that is the bug this pins); the "accepts" case PASSES.

- [ ] **Step 3: Make the schema require the channel**

Add `channelType: z.enum(CHANNEL_TYPES, …)` and `channelName: z.string().min(1)` (non-optional) to the exported shop schema, matching `CreateShopDto`.

- [ ] **Step 4: Run it again**

Run: `pnpm test -- src/features/shops/validations.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/shops
git commit -m "test(shops): require channelType and channelName like the API"
```

---

### Task 4: Endpoint audit and final verification

**Files:**
- Modify: none (audit + any final small fixes it surfaces)

**Interfaces:**
- Consumes: the whole tree from Tasks 1–3.
- Produces: evidence that every live endpoint has a caller or an explicit justification.

- [ ] **Step 1: Build a caller list from the tree**

```bash
grep -rhoE "http\.(get|post|patch|put|delete)<[^>]*>\('[^']+'" src | sed -E "s/.*\('//" | sort -u
```

- [ ] **Step 2: Compare against the live spec and record gaps**

```bash
curl -s http://localhost:3000/api/v1/docs-json \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const s=JSON.parse(d);for(const p of Object.keys(s.paths).sort())console.log(p)})"
```

Justified non-callers (document in the commit body, do not "fix"): `GET /health`; per-id GETs (`/users/{id}`, `/roles/{id}`, `/riders/{id}`, `/customers/{id}`, `/delivery-partners/{id}`, `/townships/{id}`, `/shops/{id}`) — the UI is list-driven; `GET /orders/{id}/history` — history is embedded in `GET /orders/{id}`.

- [ ] **Step 3: Full verification**

```bash
pnpm codegen && pnpm build && pnpm lint && pnpm test
```

Expected: codegen 56 paths; build 0; lint 0 errors; tests PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify frontend covers every live API endpoint"
```

---

## Self-Review

**Spec coverage:** the live spec's 56 paths map to: auth (Line B), users/roles/permissions (Line B), shops/customers/riders CRUD (Line B, API-complete), townships (Line B), orders + all RPCs (Task 1, Line A), ways (Task 1), reports + exports (Task 1), shop portal + exports (Task 1), delivery partners (Task 1), rider board/dashboard on live endpoints (Task 1), assignable riders (Task 2). Covered.

**Type consistency:** `fetchAssignableRiders` (Task 2) is the only new symbol; its return type is defined in its own Interfaces block. `usePermission` name is shared by `gate.tsx` re-export and `usePermission.ts`.

**Review Focus:** the five failure modes each have an owning assertion — types freshness (Task 1 Steps 2), no master-data/operations restore (Task 1 Step 3 path list), permission mirror (Task 1 Step 6), single orders implementation (Task 1 Step 3 + Step 7 fix list), `usePermission` re-export (Task 1 Step 5 + Step 7).

**Proportion:** one integration task, two small feature tasks, one audit task — proportional to a merge that touches ~60 files but decides ~6 things.

---

## Outcome (what actually happened)

Executed inline on branch `rebuild/api-compat` (base `9c4cf53`): `82ee591`,
`8a83341`, `a791e44`, `cf63781`, `7223ba9`. Build green, lint 0 errors,
33 tests pass, endpoint audit clean.

**Deviations from this plan, and why:**

1. **Tests: none were kept.** This repo forbids new spec files
   (`CLAUDE.md:26`, `AGENTS.md:8`). This plan prescribed TDD, but a plan is not
   the explicit user request the rule requires, so the three spec files written
   under Tasks 2 and 3 were removed. Every behaviour they covered was verified
   by live probe instead (recorded in the commit bodies).
2. **Task 2 did not add a fetcher.** `fetchAssignableRiders` /
   `useAssignableRiders` already existed in `features/riders/api.ts` and were
   dead after Task 1; the dialog was pointed at those instead of duplicating a
   function into `orders/api.ts`.
3. **Task 3 needed no production change.** The plan assumed the shops schema
   did not require the channel — that was the *other* line's gap. This tree
   keeps the shops module that already required `channelType`/`channelName`
   and already sent them, so Task 3 became a regression guard only.
4. **`@/features/operations/api` was not restored.** The restored modules were
   repointed to the per-feature APIs; a second hand-typed API layer is what
   drifted from the live schema in the first place.
5. **Extra fixes the review turned up**, beyond this plan's scope: riders
   landing on a deleted `/rider` route after login (main's `LoginPage` hardcoded
   it), `TownshipsPage` actions gated on `orders.*` instead of `townships.*`,
   and three dead townships writers in `orders/api.ts`.

**Open items handed back to the user (not fixed here):**

- **Client field limits drift from the API's DTOs** — 15 sites let the user
  submit values the server rejects with HTTP 400 (e.g. shop `channelName`
  allows 200, the DTO caps 100; `users.name`/`phone` and `roles.description`
  have no client cap at all). A further few are stricter than the server.
- **No township delete UI** — `DELETE /townships/{id}` exists in the API and in
  the permission catalogue (`townships.delete`) with no frontend caller.
- **Rider-only pages are visible to office users** — `/rider-dashboard` and
  `/rider-board` are gated on `deliveries.read`, which OWNER and OFFICER also
  hold, but `/riders/me/*` returns 403 for non-riders. Office users see two
  nav items that always error.
- **`/orders/approval` gate mismatch** — nav gates on `deliveries.approve`, the
  route on `orders.read`; latent until a custom role holds only one.
- **`AssignOrderDialog` needs `orders.create`** (via `/riders/assignable`) but
  opens for `orders.update`, and shows a silently empty picker on 403.
