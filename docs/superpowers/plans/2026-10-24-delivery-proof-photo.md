# Delivery Proof Photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A rider must photograph a delivery to submit it, the office sees that photo when approving and afterwards, and no `DELIVERED` rider order exists without accepted evidence.

**Architecture:** The image goes browser → NestJS → Cloudflare R2 under a per-environment key prefix; a row in `order_delivery_proofs` binds it to the order in the same transaction as the `ASSIGNED → AWAITING_APPROVAL` transition. The approve transaction stamps `approved_at` on the newest row, which is the rule that separates "evidence" from "a capture that was rejected". Two repos change together: `delivery_solution_api` (storage, schema, endpoints) then `delivery_solution_frontend` (capture UI, evidence surfaces, regenerated types).

**Tech Stack:** NestJS 12 + drizzle-orm/postgres + vitest (backend); `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` + multer via `@nestjs/platform-express`; Vite + React 19 + TanStack Query + axios + Canvas API (frontend).

**Spec:** `docs/superpowers/specs/2026-10-24-delivery-proof-photo-design.md` (frontend repo)

## Global Constraints

- Backend repo path: `../delivery_solution_api`. All backend paths below are relative to it; frontend paths are relative to this repo.
- `pnpm` only. Backend ESM: every relative import ends in `.js`.
- No `any`, no `@ts-ignore`, no non-null assertions. `unknown` + narrowing at boundaries.
- No new frontend dependencies. No new frontend spec files (existing Vitest suite must stay green).
- No new permission keys. The catalog is fixed; reuse `deliveries.update`, `deliveries.approve`, `orders.read`.
- Monochrome tokens only — never a hardcoded hex or `bg-blue-*` class. Status colour goes through `badgeClass(tone)`.
- Money stays a decimal string; nothing in this feature formats or recomputes COD.
- Backend spec files are colocated `*.spec.ts`; e2e files are `test/*.e2e-spec.ts`. Frontend has no new specs.
- **Do not commit or push.** The user commits explicitly, never as a side effect of a task.
- 5 MB is a code constant (`MAX_DELIVERY_PROOF_BYTES`), not configuration — one source of truth, enforced by the multer limit and re-checked in the service.

## Review Focus

The five conditions most likely to bite a real user, each pinned by a test in the task that owns the code:

1. **Double-tap submit** — a rider on a flaky connection taps twice. Expect exactly one proof row and one transition; the second attempt fails cleanly, never two rows or two history entries. (Task 3)
2. **Undecodable file (HEIC from an iPhone)** — expect a visible, actionable message and no upload attempt, never a dialog that sits at "Submitting…". (Task 7)
3. **Android camera photo with EXIF rotation** — expect it upright in the office view, with GPS/EXIF stripped from the stored bytes. (Task 7)
4. **Partner order detail** — partner deliveries never have a rider photo. Expect "no capture" copy, no request error, no broken thumbnail. (Task 8)
5. **Expired signed URL** — an officer leaves the approval screen open past the 5-minute URL lifetime. Expect a visible "link expired, refresh" state instead of a broken image. (Task 9)

---

### Task 1: Storage module, image validation, and R2 configuration

**Files:**
- Create: `src/storage/delivery-proof-file.ts`
- Create: `src/storage/delivery-proof-file.spec.ts`
- Create: `src/storage/storage.service.ts`
- Create: `src/storage/storage.module.ts`
- Modify: `src/config/env.validation.ts`
- Modify: `src/config/env.validation.spec.ts`
- Modify: `.env.example`
- Run: `pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- Run: `pnpm add -D @types/multer`

**Interfaces:**
- Produces:
  - `MAX_DELIVERY_PROOF_BYTES = 5 * 1024 * 1024`
  - `DELIVERY_PROOF_URL_TTL_SECONDS = 300`
  - `type SupportedImageType = 'image/jpeg' | 'image/png' | 'image/webp'`
  - `sniffImageType(buffer: Buffer): SupportedImageType | null`
  - `extensionForImageType(type: SupportedImageType): 'jpg' | 'png' | 'webp'`
  - `deliveryProofObjectKey(prefix: string, orderId: string, proofId: string, extension: string): string`
  - `interface DeliveryProofUpload { buffer: Buffer; mimetype: string; size: number }`
  - `StorageService.putObject(key: string, body: Buffer, contentType: string): Promise<void>`
  - `StorageService.deleteObject(key: string): Promise<void>`
  - `StorageService.signedGetUrl(key: string, expiresInSeconds: number): Promise<string>`

- [ ] **Step 1: Write the failing spec for byte sniffing and key building**

`src/storage/delivery-proof-file.spec.ts` — assert with real magic-byte prefixes:

```ts
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);

it('recognises jpeg, png and webp from bytes, ignoring the declared type', () => {
  expect(sniffImageType(JPEG)).toBe('image/jpeg');
  expect(sniffImageType(PNG)).toBe('image/png');
  expect(sniffImageType(WEBP)).toBe('image/webp');
});
it('rejects a file that is not an image even if it claims to be', () => {
  expect(sniffImageType(Buffer.from('not an image'))).toBeNull();
});
it('builds the prefixed key from the environment namespace', () => {
  expect(deliveryProofObjectKey('demo', 'order-1', 'proof-1', 'jpg'))
    .toBe('demo/delivery-proofs/order-1/proof-1.jpg');
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test src/storage/delivery-proof-file.spec.ts`
Expected: FAIL — cannot resolve `./delivery-proof-file.js`.

- [ ] **Step 3: Implement `src/storage/delivery-proof-file.ts`**

Sniff by prefix: JPEG `ff d8 ff`, PNG the 8-byte signature, WebP `RIFF` at 0 and `WEBP` at 8. Key = `` `${prefix}/delivery-proofs/${orderId}/${proofId}.${extension}` ``. Export the three constants, the union type, and `DeliveryProofUpload`.

- [ ] **Step 4: Run the spec green**

Run: `pnpm test src/storage/delivery-proof-file.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Implement `StorageService` and `StorageModule`**

`StorageService` constructs one `S3Client({ region: 'auto', endpoint, credentials })` from `ConfigService` — `endpoint` is `R2_ENDPOINT` or `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`. `signedGetUrl` uses `getSignedUrl(this.client, new GetObjectCommand({...}), { expiresIn: expiresInSeconds })`. `StorageModule` is a normal module exporting `StorageService` (not `@Global`); only `OrdersModule` imports it.

- [ ] **Step 6: Add the R2 variables to validation, and fix its existing spec**

`env.validation.ts`: add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_KEY_PREFIX` to `EnvironmentVariables`, to the `required` array, and to the returned object. `R2_KEY_PREFIX` is trimmed of leading/trailing slashes; `R2_ENDPOINT` defaults to the derived form.

`env.validation.spec.ts` currently builds `baseEnv` with two variables — add the five R2 values there, or its "complete environment" test fails. Add one case asserting a missing `R2_KEY_PREFIX` throws `Missing required environment variable: R2_KEY_PREFIX`.

- [ ] **Step 7: Update `.env.example` and run the backend gates**

Add the five R2 keys with empty/`demo` placeholders and a comment that `R2_KEY_PREFIX` namespaces this environment inside a shared bucket.

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: clean, all specs green.

---

### Task 2: `order_delivery_proofs` table and migration

**Files:**
- Create: `src/orders/order-delivery-proof.schema.ts`
- Modify: `src/common/database/schema.ts` (add one export line after `order-field-audit.schema.js`)

**Interfaces:**
- Produces: `orderDeliveryProofs` table with columns `id, orderId, storageKey, contentType, byteSize, checksumSha256, uploadedBy, uploadedByName, capturedAt, approvedAt, approvedBy`; plus `type OrderDeliveryProofRow = typeof orderDeliveryProofs.$inferSelect`.

- [ ] **Step 1: Write the table**

Mirror `order-field-audit.schema.ts`'s style. `orderId` → `orders.id`, `onDelete: 'restrict'`, not null. `uploadedBy` / `approvedBy` → `users.id`, nullable, `onDelete: 'set null'`. `uploadedByName` text not null. `storageKey` text not null with `uniqueIndex('order_delivery_proofs_storage_key_unique')`. `byteSize` integer not null. `capturedAt` / `approvedAt` `timestamp({ withTimezone: true })`, `capturedAt` not null default now, `approvedAt` nullable. Add `index('order_delivery_proofs_order_idx').on(table.orderId, table.capturedAt)` — the read always filters by order and orders by capture time.

No `relations()` entry: nothing queries it relationally, and adding one would mean touching `ordersRelations` and `usersRelations` for no gain.

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: a new `drizzle/0023_*.sql` creating the table, its unique index and its indexes. Read it. It must contain no `ALTER` on `orders`.

- [ ] **Step 3: Apply and verify**

Ensure Postgres is up (`docker compose up -d`), then run `pnpm db:migrate` and confirm `\d order_delivery_proofs` shows both FKs and `on delete SET NULL` on the two user columns.

---

### Task 3: Rider submission requires the photo

**Files:**
- Modify: `src/orders/orders.module.ts` (import `StorageModule`)
- Modify: `src/riders/riders.controller.ts:54-61`
- Modify: `src/orders/orders.service.ts:823-837`
- Create: `test/support/delivery-proof-fixture.ts`
- Modify: `test/orders-workflow.e2e-spec.ts` (three `/delivered` call sites; storage override in `beforeAll`)
- Modify: `test/reports.e2e-spec.ts` (three `/delivered` call sites; storage override)

**Interfaces:**
- Consumes: `StorageService`, `sniffImageType`, `extensionForImageType`, `deliveryProofObjectKey`, `MAX_DELIVERY_PROOF_BYTES`, `DeliveryProofUpload`, `orderDeliveryProofs`.
- Produces: `submitRiderDelivered(id: string, actor: { id: string; name: string }, photo: DeliveryProofUpload | undefined): Promise<RiderDeliveredResponseDto>`; `POST /api/v1/riders/me/orders/:id/delivered` accepts `multipart/form-data` with a required `photo` part.

- [ ] **Step 1: Write the failing e2e assertion first**

In `test/orders-workflow.e2e-spec.ts`, extend the existing `submits a rider delivery for approval and approves it` test with a preceding case: posting `/delivered` **without** a file expects `400`. Then add the concurrency case required by Review Focus #1, as a new `it` in the same file:

```ts
it('accepts only one proof when the rider submits the same order twice', async () => {
  const order = await createOrder({ riderId });
  const orderId = order.id as string;
  const [first, second] = await Promise.all([
    request(app.getHttpServer()).post(`/api/v1/riders/me/orders/${orderId}/delivered`)
      .set('Authorization', `Bearer ${riderToken}`).attach('photo', PNG_1X1, 'proof.png'),
    request(app.getHttpServer()).post(`/api/v1/riders/me/orders/${orderId}/delivered`)
      .set('Authorization', `Bearer ${riderToken}`).attach('photo', PNG_1X1, 'proof.png'),
  ]);
  expect([first.status, second.status].sort()).toEqual([200, 409]);
  const proofs = await database.db.select().from(orderDeliveryProofs).where(eq(orderDeliveryProofs.orderId, orderId));
  expect(proofs).toHaveLength(1);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test:e2e test/orders-workflow.e2e-spec.ts -t 'only one proof'`
Expected: FAIL — the endpoint answers 200 to a bodyless JSON post.

- [ ] **Step 3: Create the fixture and the storage override**

`test/support/delivery-proof-fixture.ts` exports `PNG_1X1` (base64 of a 1×1 PNG) and `FAKE_STORAGE` — an object with `putObject`/`deleteObject` returning `Promise.resolve()` and `signedGetUrl` returning `` Promise.resolve(`https://r2.test/${key}`) ``. In both e2e files, build the testing module then `.overrideProvider(StorageService).useValue(FAKE_STORAGE)` before `.compile()`, and add `.attach('photo', PNG_1X1, 'proof.png')` to every existing `/delivered` request. Import `orderDeliveryProofs` from `../src/orders/order-delivery-proof.schema.js` for the new assertions. A support file that is not `*.spec.ts` will not run as a test.

The override fakes the network, not the configuration: `envValidation` still runs at boot, so the R2 variables must be present in `.env` for the e2e suite. That is the accepted cost of validating configuration at boot.

- [ ] **Step 4: Change the controller to multipart**

`@UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_DELIVERY_PROOF_BYTES, files: 1 } }))`, `@ApiConsumes('multipart/form-data')`, and `@ApiBody({ schema: { type: 'object', required: ['photo'], properties: { photo: { type: 'string', format: 'binary' } } } })` so codegen emits the multipart shape. Take `@UploadedFile() photo?: Express.Multer.File` and pass `photo` plus `{ id: currentUser.id, name: currentUser.name }` to the service.

- [ ] **Step 5: Rewrite `submitRiderDelivered`**

Order of operations, all guarded as noted: resolve the rider row from `userId` (403 if none); find the owned `ASSIGNED` `RIDER` order (404 as today); `photo` missing → `BadRequestException('A delivery photo is required to submit this delivery')`; `sniffImageType(photo.buffer)` null → `BadRequestException('Photo must be a JPEG, PNG or WebP image')`; `photo.size > MAX_DELIVERY_PROOF_BYTES` → `BadRequestException`. Then `proofId = randomUUID()`, key from `R2_KEY_PREFIX`, `sha256` of the buffer, `putObject`, and inside `await this.database.db.transaction(...)` insert the proof row and call `orderState.submitRiderDeliveredInTransaction(...)`. Wrap the transaction in `try/catch` and `await this.storage.deleteObject(key).catch(() => undefined)` before rethrowing, so a failed transition leaves no orphan object. The response DTO stays `{ id, status, deliveredAt }` — no consumer needs the proof id.

The concurrent case resolves itself: the state service's status-guarded update throws `ConflictException` for the loser, which the catch deletes the loser's object for. Add a comment saying so.

Two error mappings to keep deliberate: an over-size upload is rejected by multer's limit **before** the service runs, so Nest answers `413 Payload Too Large` — do not "fix" it to 400. A storage SDK failure (`putObject` throwing) is wrapped in `ServiceUnavailableException('Could not store the delivery photo. Check the connection and try again.')` so the rider reads an instruction, not a stack trace; the order stays `ASSIGNED`.

- [ ] **Step 6: Run the e2e green**

Run: `pnpm test:e2e test/orders-workflow.e2e-spec.ts` and `pnpm test:e2e test/reports.e2e-spec.ts`
Expected: PASS. Then `pnpm lint && pnpm typecheck && pnpm test`.

- [ ] **Step 7: Upload to the real bucket once, by hand**

`pnpm start:dev`, log in as the seeded rider, submit a delivery with a real JPEG, then confirm in the Cloudflare dashboard that `demo/delivery-proofs/<orderId>/<proofId>.jpg` exists and `select * from order_delivery_proofs` shows one row with a 64-character checksum.

---

### Task 4: Read endpoint for the office

**Files:**
- Create: `src/orders/dto/delivery-proof-response.dto.ts`
- Modify: `src/orders/orders.controller.ts` (add a `@Get(':id/delivery-proofs')` beside `@Get(':id/history')`)
- Modify: `src/orders/orders.service.ts`

**Interfaces:**
- Produces: `OrdersService.listDeliveryProofs(orderId: string): Promise<DeliveryProofResponseDto[]>`; `GET /api/v1/orders/:id/delivery-proofs` (`orders.read`) returning newest first.

- [ ] **Step 1: Write the DTO**

`DeliveryProofResponseDto`: `id`, `url`, `contentType`, `byteSize`, `capturedAt`, `uploadedByName`, `approvedAt`, `approvedByName` — every field `@ApiProperty()`, dates typed `string`, `approvedAt` and `approvedByName` nullable. Codegen turns nullable dates into stubs, so keep the fields `string | null` and let the frontend narrow them (Task 6).

- [ ] **Step 2: Implement the service method**

`await this.orderOrThrow(orderId)` first so a bad id is 404 rather than `[]`. Then one `select` from `orderDeliveryProofs` left-joined to `users` on `approvedBy` for the approver name (the *capturer's* name comes from the snapshot column, so a deleted rider account keeps its attribution). Order `desc(capturedAt)`. Map `capturedAt` / `approvedAt` through `.toISOString()` and mint `url` with `this.storage.signedGetUrl(row.storageKey, DELIVERY_PROOF_URL_TTL_SECONDS)`.

- [ ] **Step 3: Wire the controller route**

Add `@Get(':id/delivery-proofs')` with `@RequirePermissions('orders.read')` and `@ApiOkResponse({ type: [DeliveryProofResponseDto] })`. Place it beside the existing `:id/audit` and `:id/history` routes, which are already declared before `:id` — keep that ordering.

- [ ] **Step 4: Verify by hand**

`curl -H "Authorization: Bearer $TOKEN" localhost:3000/api/v1/orders/<id>/delivery-proofs | jq` → one row with a signed URL. Paste the URL in a browser: the image renders. Wait 5 minutes and reload it: R2 answers `Request has expired`. Then run `pnpm lint && pnpm typecheck && pnpm test`.

---

### Task 5: Approve stamps the accepted proof

**Files:**
- Modify: `src/orders/orders.service.ts:692-694` (`approve`) and add a private `stampAcceptedProof`
- Modify: `test/orders-workflow.e2e-spec.ts` (the approve test, and the send-back test)

**Interfaces:**
- Produces: `approve` writes `approved_at` / `approved_by` on the newest proof row inside the transition's transaction. `sendBack` writes nothing.

- [ ] **Step 1: Write the failing assertions**

In `submits a rider delivery for approval and approves it`, after the approve call, assert the newest proof for the order has a non-null `approvedAt` and `approvedBy === ownerId`. In `sends a submitted delivery back ...`, after the send-back, assert its proof still has `approvedAt === null`. Add the resubmission case:

```ts
it('keeps the rejected capture and accepts only the resubmission', async () => {
  // submit → send back → submit again → approve
  // expect 2 rows, exactly one with approvedAt set, and it is the later one
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test:e2e test/orders-workflow.e2e-spec.ts -t 'accepts only the resubmission'`
Expected: FAIL — both rows have `approvedAt === null`.

- [ ] **Step 3: Implement**

`approve` stops delegating to `changeState` and opens its own transaction: `SELECT ... FOR UPDATE` the order (404 if absent), `orderState.applyTransitionInTransaction(transaction, { orderId, fromStatus: current.status, toStatus: 'DELIVERED', changedBy: actorId, note: 'Delivery approved' })`, then `stampAcceptedProof(transaction, id, actorId)`. Preserve the existing `Invalid order status transition` → 400 behaviour, which `applyTransitionInTransaction` already gives.

`stampAcceptedProof` selects the newest proof id for the order (`orderBy(desc(capturedAt)).limit(1)`); if one exists, updates it with `approvedAt: new Date(), approvedBy: actorId`. A missing proof is **not** an error here — partner deliveries never have one, and making it an error would break `mark-delivered`. Instead note in a comment that the rider invariant is asserted by the test above.

- [ ] **Step 4: Run green**

Run: `pnpm test:e2e test/orders-workflow.e2e-spec.ts` then `pnpm lint && pnpm typecheck && pnpm test`.

---

### Task 6: Frontend types and API client

**Files:**
- Run: `pnpm codegen` (backend must be running)
- Modify: `src/types/api.ts` (generated — commit as-is, never hand-edit)
- Modify: `src/features/orders/api.ts`

**Interfaces:**
- Produces:
  - `type DeliveryProof` — `{ id, url, contentType, byteSize, capturedAt, uploadedByName, approvedAt: string | null, approvedByName: string | null }`
  - `orderKeys.proofs(orderId: string)`
  - `fetchDeliveryProofs(orderId: string): Promise<DeliveryProof[]>`
  - `submitRiderDelivered(orderId: string, photo: File): Promise<RiderDelivered>`

- [ ] **Step 1: Regenerate**

Start the backend, then `pnpm codegen`. Confirm `DeliveryProofResponseDto` appears in `src/types/api.ts` and that `RidersController_submitDelivered_v1` now has a multipart request body rather than none.

- [ ] **Step 2: Add the types and functions**

Add `proofs: (orderId: string) => ['workflow-orders', 'proofs', orderId] as const` to `orderKeys`. Type `DeliveryProof` off the generated DTO with the same `Omit` + re-narrow pattern the file already uses for `Order` and `OrderHistory` (codegen emits `Record<string, never>` stubs for nullable dates). `submitRiderDelivered` builds `FormData` and posts it **without** setting `Content-Type` — axios must add the boundary itself.

- [ ] **Step 3: Verify the build**

Run: `pnpm lint && pnpm build`
Expected: green. No frontend runtime verification yet — nothing consumes these.

---

### Task 7: Rider capture dialog

**Files:**
- Create: `src/features/riders/downscale-image.ts`
- Create: `src/features/riders/SubmitDeliveryDialog.tsx`
- Modify: `src/features/riders/RiderBoardPage.tsx`

**Interfaces:**
- Consumes: `submitRiderDelivered`, `orderKeys.riderBoard`, `getApiErrorMessage`, `RiderBoardOrder`.
- Produces: `downscaleImageForUpload(file: File, maxEdge?: number, quality?: number): Promise<File>`; `<SubmitDeliveryDialog order={...} onClose={...} />`.

- [ ] **Step 1: Implement `downscaleImageForUpload`**

Signature `(file: File, maxEdge = 1600, quality = 0.8): Promise<File>`. Decode with `createImageBitmap(file)`; if that rejects, fall back to an `<img>` decoded from `URL.createObjectURL(file)`. Scale so the **long** edge is at most `maxEdge` and never upscale. Draw to a canvas, `canvas.toBlob('image/jpeg', quality)`, return a new `File` named `delivery-proof.jpg`. Re-encoding is what makes the bytes upright and strips EXIF/GPS (Review Focus #3). If both decode paths fail, throw `new Error('This photo could not be read. Take the photo again with the camera.')`. Revoke every object URL in a `finally`.

- [ ] **Step 2: Implement `SubmitDeliveryDialog`**

Props `{ order: RiderBoardOrder | null; onClose: () => void }`. `open={order !== null}`. A file input styled with the `Button` + hidden-input pattern, `accept="image/*"`, `capture="environment"`. Show the chosen image as a preview (`URL.createObjectURL`, revoked on change and on close), the file size, and a line of copy that the photo is what the office will use if the customer disputes the delivery. Submit is **disabled** while no file is chosen. On submit: `downscaleImageForUpload` → `submitRiderDelivered(order.id, file)` → toast `Delivery submitted for office approval` → invalidate `orderKeys.riderBoard` → `onClose()`. Errors go through `getApiErrorMessage` into an inline `role="alert"` paragraph, including the downscale failure message from Step 1. Follow `SendBackOrderDialog`'s inline-input structure — this feature does not use the strict dialog/form split.

- [ ] **Step 3: Wire `RiderBoardPage`**

Replace the immediate `submitMutation.mutate(order.id)` with `setSelectedOrder(order)`; render `<SubmitDeliveryDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} />`. Delete the now-unused mutation from the page, keeping the `deliveries.update` gate and the "Submit delivered" button.

- [ ] **Step 4: Verify in a real browser**

`pnpm build`, then `pnpm dev` against the running API. With the `playwright` MCP tools at a 390×844 viewport, as a rider: open the board, choose a file, confirm the preview renders, submit, and confirm the row disappears and a toast appears. Then submit an order with the dialog left open and confirm the disabled state before a file is chosen. jsdom proves none of this.

---

### Task 8: Evidence on the order detail

**Files:**
- Create: `src/features/orders/DeliveryEvidenceSection.tsx`
- Modify: `src/features/orders/OrderDetailPage.tsx` (insert a `<section>` between the order summary and the shop advance sections)

**Interfaces:**
- Consumes: `useQuery`, `orderKeys.proofs`, `fetchDeliveryProofs`, `DeliveryProof`, `badgeClass`.
- Produces: `<DeliveryEvidenceSection orderId={string} />`.

- [ ] **Step 1: Implement the section**

One `useQuery({ queryKey: orderKeys.proofs(orderId), queryFn: () => fetchDeliveryProofs(orderId) })`. Three states:

- **accepted evidence** (`approvedAt !== null`): thumbnail with `alt` naming the order, "Accepted evidence" badge (positive tone), captured at + captured by, approved at + approved by, and a `View full size` link (`target="_blank" rel="noreferrer"`).
- **only unaccepted rows**: "Not accepted — a resubmission is pending." badge (warning tone), still showing the thumbnail and capture time.
- **no rows**: "No photo was captured for this order." with the sub-line "Partner deliveries and orders delivered before photo evidence was required have no photo." — this is the partner case (Review Focus #4) and must not be an error state.

If more than one row exists, the non-newest rows go inside a `<details>` labelled "Earlier submissions", each with its own not-accepted badge. Loading shows a skeleton block; an error shows `getApiErrorMessage` in a `role="alert"` paragraph.

- [ ] **Step 2: Handle an expired image URL**

A signed URL lives 5 minutes (Review Focus #5). Give the thumbnail `onError` a state that swaps in "This image link expired. Refresh the order to view it again." plus a `Button` calling `queryClient.invalidateQueries({ queryKey: orderKeys.proofs(orderId) })`. Never render a broken-image icon as the only signal.

- [ ] **Step 3: Wire it into `OrderDetailPage`**

Place the section directly after the `<section aria-label="Order summary">` block so evidence sits with the order facts, matching the page's labelled-section grouping.

- [ ] **Step 4: Verify in a real browser**

As an officer, open a delivered order with a photo: the image renders and the accepted badge shows approver + date. Open a partner-delivered order: the "no photo" copy shows and the network tab shows a `200` with `[]`. Open an `ASSIGNED` order that was sent back after submission: the warning badge shows and the section is not blank.

---

### Task 9: See the evidence before approving

**Files:**
- Modify: `src/features/orders/ApproveOrderDialog.tsx`

**Interfaces:**
- Consumes: `orderKeys.proofs`, `fetchDeliveryProofs`.

- [ ] **Step 1: Implement**

Query the order's proofs with `enabled: order !== null`. Show the accepted-or-newest proof as a thumbnail with capture time and capturer, and a `View full size` link, above the existing description. Keep the existing copy about COD. Show a muted "No photo on this delivery" line when the list is empty rather than failing the dialog — a partner order can reach the approval queue only through `mark-delivered`, but never let a 404/empty body block the officer. Apply the same expired-link handling as Task 8 by reusing the same message copy.

- [ ] **Step 2: Verify in a real browser**

Open the Confirm deliveries queue as an officer, click `Approve` on a rider-submitted order: the photo is visible inside the dialog before the approve button. Approve, and confirm the order detail then shows the same photo with the accepted badge.

---

### Task 10: Documentation and full gates

**Files:**
- Modify: `docs/delivery-workflow-v2.md` (this repo and the copy in `../delivery_solution_api`, kept identical)
- Modify: `CLAUDE.md` (the rider-flow bullet under "Workflow v2 operations flows")
- Modify: `docs/superpowers/specs/2026-10-24-delivery-proof-photo-design.md` (three corrections, below)

- [ ] **Step 1: Correct the spec where implementation proved it wrong**

Three lines changed during planning and must not be left contradicting the code:
- `DELIVERY_PROOF_MAX_BYTES` is a code constant, not an env var (§5.6).
- An over-size upload answers `413`, not `400` (multer's limit), while wrong bytes answer `400` (§5.4 A, §8).
- The invariant is **every `DELIVERED` order delivered through the rider flow has exactly one accepted proof** — partner orders are marked delivered with no proof at all (§5.3.1 as currently written overstates it).
- The delivery response stays `{ id, status, deliveredAt }` with no `proof` field — the rider UI never reads it, so the DTO does not grow a nested class for nothing (§5.4 A).

- [ ] **Step 2: Update the workflow doc**

In both copies: rider delivery submission now requires a photo; the endpoint is multipart; the proofs read endpoint and its 5-minute signed URLs; the accept-on-approve rule; and one sentence that an order cannot be delivered without evidence (the override is deferred). Keep them byte-identical.

- [ ] **Step 3: Update `CLAUDE.md`**

Extend the rider boundary paragraph with one line: rider submissions require a delivery photo stored in R2 under `R2_KEY_PREFIX`, evidence is accepted at approval, and no office view may present an unaccepted capture as proof.

- [ ] **Step 4: Run every gate**

Backend: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`.
Frontend: `pnpm lint && pnpm build`.
Expected: all green. Report any gate that could not run (missing DB, API down) as unverified rather than passing.
