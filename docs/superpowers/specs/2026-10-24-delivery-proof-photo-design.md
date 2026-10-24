# Delivery proof photo — design

Date: 2026-10-24
Repos: `delivery_solution_frontend` (this repo) and `../delivery_solution_api` (NestJS)

## 1. Intent

When a customer says **"it never arrived"**, the office must be able to answer with
evidence captured at the moment of handover — not with a recollection. The rider
photographs the delivery as part of submitting it, and the photo is bound to the
order and to the delivery event so it cannot be attached after the fact.

The problem being solved is not storage. It is that **a delivery currently leaves no
trace a customer or shop cannot contradict**.

## 2. Goals

- A rider **must** attach one photo to submit a delivery for approval. No photo, no
  submission.
- The photo is bound to the order at the `ASSIGNED → AWAITING_APPROVAL` transition,
  written in the same transaction as the transition.
- The office can see the photo at the moment it approves the delivery, and afterwards
  on the order detail, with the capture time and who captured it.
- Photos are private. Only an authenticated user with the right office permission can
  obtain a URL, and that URL expires.

**Deferred:** the office override that marks a delivery delivered without a photo. In
this build nothing can produce a `DELIVERED` order that has no accepted evidence. See
§5.5 for what that costs and what the interim path is.

## 3. Non-goals

- No customer-facing gallery or tracking-page photo.
- No general media library, no rider avatars, no shop documents.
- No image editing, annotation, or OCR.
- No scheduled retention/deletion job in this build (the table carries the timestamps
  that a future job needs).
- No new permission keys. The catalog is fixed at 14 modules / 46 keys; this feature
  reuses `deliveries.update`, `deliveries.approve`, `orders.read`.
- No officer override for an evidence-free delivery (deferred, §5.5).

## 4. Anti-goals

- **Never a public bucket or a permanent URL.** A proof photo is dispute evidence.
- **Never a silent success.** If the photo fails to persist, the delivery must not
  move to `AWAITING_APPROVAL`.
- **Never a contradictory record.** A photo from a submission the officer sent back is
  not evidence of a delivery; it must not be presented as one.
- **Never invent a second way to close an order.** Mandatory means mandatory: no
  back door, and no new endpoint that quietly becomes the normal path.

## 5. Decisions

### 5.1 Storage: Cloudflare R2 (recommended, my call)

Stated plain: R2 keeps the bytes off the API server, so a redeploy, a resized VM, or a
dead disk does not take the evidence with it. Egress is free, which matters because
these images are re-read on every approval and every dispute. It is S3-compatible, so
the client is `@aws-sdk/client-s3` and the bucket can later move to S3 or MinIO by
changing configuration only.

Local disk was the alternative and loses on three counts: the files die with the
container/VM, backups become this project's problem, and a protected file-serving
route still has to be written — "local" does not remove a single one of the security
requirements, it only removes the vendor.

**Upload path: browser → NestJS → R2.** Not presigned direct-to-bucket. Size and type
validation stay on the server, there is one auth model, and the bucket needs no CORS
rule. The extra hop is worth the smaller trust surface at this volume.

**Development uses the same driver** with a separate R2 bucket and its own API token.
There is deliberately **no local-storage driver** — one code path, so what is tested
locally is what runs in production.

### 5.2 One photo, captured, not chosen

One image per submission. `accept="image/*"` with `capture="environment"` so a phone
opens the rear camera. The browser downscales to a long edge of 1600 px and re-encodes
as JPEG (quality 0.8) before upload:

- upload size drops from ~4 MB to ~250 KB on a mobile connection,
- the re-encode strips EXIF, so **GPS coordinates the rider never agreed to share do
  not leave the phone**,
- and it normalises HEIC to JPEG, which the API would otherwise have to handle.

Server-side limits are the real gate, not the client: max 5 MB, `image/jpeg`,
`image/png`, `image/webp`, and the file signature is checked against bytes, not against
the client-supplied MIME string.

### 5.3 Data model: append-only proof rows, active = newest

New table `order_delivery_proofs`:

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `order_id` | uuid → `orders.id`, not null, indexed | `restrict` — orders are never deleted |
| `storage_key` | text not null | R2 object key, unique |
| `content_type` | text not null | |
| `byte_size` | integer not null | |
| `checksum_sha256` | text not null | computed server-side while handling the upload; lets a dispute prove the file was not swapped |
| `uploaded_by` | uuid → `users.id`, nullable, `on delete set null` | the rider's login; nullable only so a user deletion does not 500 |
| `uploaded_by_name` | text not null | **snapshot** of the capturer's name at capture time, not a join. Evidence keeps its attribution after the account is deleted, the same way `order_status_history` snapshots its assignee |
| `captured_at` | timestamptz not null, default now | |
| `approved_at` | timestamptz null | set in the **approve** transaction |
| `approved_by` | uuid → `users.id`, nullable, `on delete set null` | who accepted this photo as evidence |

No column on `orders`. Rationale: `AWAITING_APPROVAL → ASSIGNED` (send-back) means an
order can be submitted more than once, so a uniqueness constraint would be wrong; and
keeping the rejected submission's row rather than overwriting it means nothing is
destroyed.

The alternative — a nullable `orders.delivery_proof_id` pointer — was rejected because
it creates a circular foreign key between the two tables for no gain.

### 5.3.1 A proof becomes evidence only when a delivery is approved

**Newest is not enough.** Two reachable states would render a rejected photo as if it
were proof of delivery: an order sitting in `ASSIGNED` after a send-back, and an order
cancelled after a send-back. So the rule is:

> A proof is **evidence** when the delivery approval transaction stamped `approved_at`
> on it. Every other row is a **capture that was not accepted**.

Consequences:

- `POST /orders/:id/approve` writes `approved_at`/`approved_by` on the newest proof row
  for that order, in the same transaction as `AWAITING_APPROVAL → DELIVERED`.
- The office screen labels state explicitly: **Accepted evidence** (with approver and
  date) versus **Not accepted — re-submission pending** versus **no capture**. A badge,
  not prose the officer has to infer.
- Superseded rows stay visible behind the "earlier submissions" disclosure, each with
  its own label. A send-back that produced a second photo is precisely when the office
  wants the first one.

This is the design's answer to anti-goal §4: the record cannot imply a proof was
accepted when the office rejected it.

Belt and braces on the invariant: with the override deferred, **every `DELIVERED` order
has exactly one accepted proof**. That is a property the reports layer can rely on, and
a test should assert it rather than trusting that no code path sneaks past.

### 5.4 API

All under `/api/v1`. Response and request types are regenerated into
`src/types/api.ts` with `pnpm codegen`; nothing is hand-wired.

**A. `POST /riders/me/orders/:id/delivered`** — permission `deliveries.update`.
Contract changes from JSON to `multipart/form-data` with a required `photo` file part.
Answer stays `200` with `{ id, status, deliveredAt, proof: { id, capturedAt } }`.
Rejects with `400` when the part is missing or the bytes are not a permitted image, and
with `404` when the order is not this rider's `ASSIGNED` order (existing behaviour).
Ordering: validate ownership and status → validate bytes and size → upload to R2 →
transaction { insert proof row, apply `ASSIGNED → AWAITING_APPROVAL` } → on any failure
after the upload, delete the just-written object. A failed transaction therefore leaves
no orphan blob.

**B. `GET /orders/:id/delivery-proofs`** — permission `orders.read`. Returns
`[{ id, url, contentType, byteSize, capturedAt, uploadedByName, approvedAt, approvedByName }]`
newest first, where `url` is a **5-minute signed GET URL** minted per request. The
caller derives the label from `approvedAt`, not from `[0]`: accepted evidence is the row
with `approvedAt` set, and a newer unaccepted row does not displace it.

**C. `POST /orders/:id/override-delivery` — deferred, not built in this change.**
Kept here as the agreed shape for later so the deferral does not have to be redesigned:
permission `deliveries.approve`, body `{ reason }`, `ASSIGNED` rider orders only, one
transaction `ASSIGNED → AWAITING_APPROVAL → DELIVERED` with `deliveredAt = now` (as
`mark-delivered` does for partners), no proof row written or accepted.

**D. Shop portal exposure — out of scope for this build.** Shop DTOs exclude internal
operations fields, and the office owns the dispute. Adding
`GET /shop-portal/orders/:id/delivery-proofs` later is a thin reuse of B with the
existing shop-scope assertion; it is deliberately not built now.

### 5.5 Deferred: the evidence-free override, and what it costs

You chose to defer the office override. The cost, stated plainly rather than buried:

- **A rider who cannot produce a photo cannot complete that delivery.** The order stays
  `ASSIGNED`. There is no back door, which is the point — but it is a real operational
  edge, not a theoretical one.
- **It is not an unrecoverable state.** The order can still leave `ASSIGNED` through
  paths that already exist and need nothing new: the office **postpones** it (returns to
  `PENDING`, then reassigns to another rider) or **cancels** it. So the interim answer to
  "the rider's camera is dead" is *reassign or cancel*, not *deliver on trust*.
- **What is lost is only the convenience** of closing an already-successful delivery in
  one click, plus the permanent trace that such a delivery has no evidence. The deadline
  for adding it is the first real occurrence of that edge — someone will hit it, and the
  postponing/cancelling workaround is visible in the order history when they do.

Deferring also buys a stronger invariant now: no code path can create a `DELIVERED` order
without accepted evidence (§5.3.1).

### 5.6 Configuration

Added to `src/config/env.validation.ts` and validated at boot, so a misconfigured
deployment fails loudly instead of at the first delivery:

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
`R2_KEY_PREFIX` (**required, no default** — e.g. `demo` in development and a distinct
value in production), `R2_ENDPOINT` (optional; derived from the account id when absent),
`DELIVERY_PROOF_MAX_BYTES` (optional, default `5242880`).

Object keys: `{R2_KEY_PREFIX}/delivery-proofs/{orderId}/{proofId}.{ext}`, e.g.
`demo/delivery-proofs/8f1c…/b93a….jpg`. A shared bucket is fine because the prefix is
the namespace: development uploads can never collide with, or be mistaken for, real
evidence. Not keyed by date, because the lookup is always by order, never by time.

The prefix is required rather than defaulted to empty on purpose — an empty default
would silently write objects at the bucket root the first time someone forgot it, which
is the one mistake this setting exists to prevent.

**Consequence to accept:** the R2 variables are required, so every existing development
environment and deployment needs them added before this branch boots.

**E2E does not touch R2.** The existing `orders-workflow.e2e-spec.ts` boots `AppModule`
and currently posts `/delivered` with no body; the spec's storage provider is overridden
with an in-memory fake (a real Nest provider override), so the suite exercises the
endpoint without a bucket or credentials. That is a test seam, not a second storage
driver — production and `pnpm start:dev` keep exactly one implementation.

**Prerequisite for manual verification:** an R2 bucket and an API token with
object read/write on it. Provisioning is the only part of this change that cannot be
done from inside the repositories.

## 6. Frontend surfaces

`src/features/orders/api.ts` gains `submitRiderDelivered(orderId, file)` building a
`FormData`, `fetchDeliveryProofs(orderId)`, and `orderKeys.proofs(orderId)`; the
`delivered` mutation invalidates `orderKeys.riderBoard`, `orderKeys.detail(orderId)` and
`orderKeys.proofs(orderId)`.

| Where | Change |
|---|---|
| `RiderBoardPage` | "Submit delivered" opens `SubmitDeliveryDialog` instead of submitting immediately |
| `SubmitDeliveryDialog` (new) | preview, mandatory photo, per-order submit; owns the mutation and toasts. Follows the inline-input pattern already used by `SendBackOrderDialog` rather than the stricter dialog/form split |
| `ApproveOrderDialog` | shows the active proof as a thumbnail with a full-size link |
| `OrderDetailPage` | an "Evidence" block inside the existing delivery group: thumbnail, capture time, capturing user, accepted/not-accepted badge, and earlier submissions behind a disclosure |

No new dependencies in the frontend. Downscaling uses `canvas` and `createImageBitmap`.

## 7. Backend module layout

- `src/storage/storage.service.ts` + `storage.module.ts` — the only place that imports
  `@aws-sdk/client-s3`. Exposes `putObject`, `deleteObject`, `signedGetUrl`.
- `src/storage/image-validation.ts` — byte-signature sniffing and the size/type gate,
  unit-tested on its own.
- `src/orders/order-delivery-proof.schema.ts` — the table, exported through
  `src/common/database/schema.ts`.
- Drizzle migration generated with `pnpm db:generate` (`0023_*`).
- New dependencies: `@aws-sdk/client-s3` and `multer`/`@types/multer` (the platform is
  `@nestjs/platform-express`, so `FileInterceptor` is already available; multer is its
  peer). This is a dependency decision being made explicitly, not a side effect.

## 8. Failure behaviour

| Situation | Result |
|---|---|
| Rider taps submit with no photo | submit disabled; server also 400s |
| Photo over 5 MB or wrong bytes | 400, message names the limit; nothing stored |
| R2 unreachable during upload | 502-ish error surfaced in the dialog, order stays `ASSIGNED`, rider retries |
| R2 upload succeeds, transaction fails | the object is deleted, order stays `ASSIGNED` |
| Rider re-submits after a send-back | second proof row; the older one stays labelled not-accepted |
| Officer approves | `AWAITING_APPROVAL → DELIVERED`, and the newest proof is stamped accepted in the same transaction |
| Rider cannot produce a photo | order stays `ASSIGNED`; office postpones (→ `PENDING`, reassign) or cancels — existing actions, no new endpoint |

## 9. Verification

- Backend: `pnpm lint`, `pnpm typecheck`, `pnpm test` (existing suite must stay green).
  New unit tests only where the repo already tests this layer — the image byte
  validation, and the invariant that approval stamps exactly one proof while a
  send-back stamps none.
- Backend manual: upload a real photo, confirm the row, the R2 object under
  `demo/delivery-proofs/…`, the signed URL expiry, and that a second submission after a
  send-back keeps both rows with only one accepted.
- Frontend: `pnpm lint`, `pnpm build`, `pnpm codegen` against the running API, then a
  real-browser pass with the `playwright` MCP tools — capture on a mobile viewport,
  the over-size rejection, and the approval-screen thumbnail. jsdom proves none of that.
- Docs: update `docs/delivery-workflow-v2.md` in both repos, and the rider line in
  `CLAUDE.md`, in the same change.

## 10. Decisions left to the builder

- Exact copy for the rider dialog.
- Whether the approval queue shows a thumbnail per row or only inside the approve
  dialog. (Leaning: inside the dialog, plus the order detail — a thumbnail column
  would compete with the data the queue exists to show.)
- Signed-URL lifetime within the 60s–15min range.
- Whether older submissions are shown collapsed or not at all. (Leaning: collapsed,
  because a send-back that produced a second photo is exactly the case where the office
  wants the first one.)
