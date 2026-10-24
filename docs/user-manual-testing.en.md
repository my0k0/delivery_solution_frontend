# Delivery Solution — Manual Testing & Presentation Guide

**Language:** English · [မြန်မာဘာသာ →](./user-manual-testing.my.md)
**Scope:** every module in the frontend, exercised against the local dev environment (`http://localhost:5173` + `delivery_solution_api` on `:3000`).
**Use:** part 3 is the presenter's run-sheet (you drive); part 4 is the tester checklist (the audience drives). Both share the same environment and accounts.

> Verified against the running local stack on 2026-10-24. Counts in part 5 are the state of **this** database at that moment — they drift as soon as anyone tests. Re-check before quoting a number on stage.

---

## 1. What you are demonstrating

One delivery company's operations system with four surfaces:

| Surface | Who | What it proves |
|---|---|---|
| Office console (`/dashboard`, `/orders`, `/rider-handovers`, `/shops`, `/customers`, `/riders`, `/townships`, `/partners`, `/users`, `/roles`, `/permissions`, `/reports/*`) | OWNER, ADMIN, OFFICER | Order lifecycle, cash follow-up, reporting, role-based access |
| Rider console (`/rider-board`, `/rider-dashboard`) | RIDER | Own deliveries only; submit delivered; commission and COD owed |
| Shop portal (`/shop`, `/shop/orders`, `/shop/statement`) | SHOP | Own orders and settlement only; no rider/partner identity or internal notes |
| Auth & settings (`/login`, `/settings/password`) | all | Session restore, permission-scoped navigation, forced sign-out on password change |

Core story to tell: **an order is not finished when the rider delivers it — it is finished when the office confirms it.** Approval is what turns expected COD into real revenue, moves commission from pending to earned, and starts the cash trail that rider handovers close.

---

## 2. Environment and accounts

### 2.1 Start the stack

```bash
# terminal 1 — database + API
cd ../delivery_solution_api
docker compose up -d          # Postgres, wait for "healthy"
pnpm db:migrate               # only needed on a fresh database
pnpm db:seed                  # roles, 46 permissions, owner + 2 admins
pnpm db:seed:demo             # demo shops, riders, customers, townships, partners, 20 orders
pnpm start:dev                # API on :3000

# terminal 2 — frontend
cd ../delivery_solution_frontend
pnpm dev                      # http://localhost:5173
```

Quick health check:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/v1/docs-json   # 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173                    # 200
```

### 2.2 Accounts

All seeded passwords are `Password1234` unless someone changed one during testing.

| Email | Role | Use it for |
|---|---|---|
| `owner@mail.com` | OWNER | Everything; system role holds all 46 keys and cannot be edited |
| `admin1@mail.com` | ADMIN | Users, roles, permission grid (cannot touch OWNER/ADMIN rows) |
| `admin2@mail.com` | ADMIN | Second admin — good for "two officers acting at once" |
| `shop1@demo.delivery.local` | SHOP | Shop portal, Demo Shop One only |
| `shop2@demo.delivery.local` | SHOP | Shop portal, Demo Shop Two only |
| `shop3@demo.delivery.local` | SHOP | Shop portal, Demo Shop Three only |
| `rider1@demo.delivery.local` | RIDER | Rider console; has an outstanding handover balance |
| `rider2@demo.delivery.local` | RIDER | Rider console; **currently holds the assignable demo orders** |
| `finance@mail.com` | FINANCE | Exists in this database, created during testing. Its grants are **not** part of the seed — do not build a demo on it without checking its permissions first. |

- There is **no OFFICER user** in the seed. Create one from **Users → New user** (role `OFFICER`) if the presentation includes the restricted-navigation segment.
- The login screen's placeholder `owner@delivery.local` is an example, not an account. Type `owner@mail.com`.

### 2.3 Pre-flight (do this 10 minutes before, not on stage)

| # | Check | Why |
|---|---|---|
| 1 | Log in as `owner@mail.com`; dashboard loads with 5 KPI cards and 4 charts | Proves API + DB + session restore |
| 2 | **Confirm deliveries is not empty** — if it shows "Queue is clear", stage one: log in as `rider2` → **My deliveries** → `Submit delivered` on any row → confirm. Log back in as owner | The approval demo is the centrepiece and cannot be done from an empty queue |
| 3 | Open `/orders`, note 2–3 tracking codes and their statuses | Traceable references while presenting |
| 4 | Open a `PENDING` order and confirm **Assign / clear**, **Postpone**, **Cancel** appear | The assignment segment needs a `PENDING` row |
| 5 | Open `/rider-handovers`, confirm both riders appear with amounts | Handover segment |
| 6 | Export one CSV from `/reports/orders` | Proves the download path and `reports.export` |
| 7 | Use a second browser profile (or incognito) per role | Switching roles without logging out repeatedly |
| 8 | Set the browser to 100% zoom, close devtools | Dialog height bugs only appear on small viewports |

**Before the demo, decide what you will do about the empty-state data:** `AWAITING_APPROVAL` is currently **0**. If the queue is empty, the "Confirm deliveries" page shows `Queue is clear` — which is a correct state to show if you explain it, but a weak centrepiece.

---

## 3. Presenter run-sheet (~50 minutes, all modules)

Each row: **do** → **what the room should see** → **say**. Cut segments 7 and 9 first if time runs short.

### 3.1 Opening — login and the shell (2 min)

| Do | Expected | Say |
|---|---|---|
| Open `http://localhost:5173` — you are redirected to `/login` | Login card: "Delivery Solution — Sign in to the operations console" | "Every route is behind authentication; the session is validated on boot with `GET /auth/me`." |
| Sign in as `owner@mail.com` / `Password1234` | Land on `/dashboard`, sidebar shows all groups | "The sidebar is generated from permissions, not hardcoded. This is the OWNER view." |

### 3.2 Office dashboard (5 min)

| Do | Expected | Say |
|---|---|---|
| Look at the 5 KPI cards | Today's orders · Awaiting approval · COD to collect today · Fee income today · Delayed orders | "Two of these are current snapshots, not the day's activity — awaiting approval and delayed orders." |
| Point at the range control (defaults to the last 7 days) | `From` / `To`, charts re-query on change | "Charts use the selected entry-date range; the KPI row keeps its own today/snapshot meaning. That difference is deliberate." |
| Scroll the 4 charts + pending-age bar | Orders by status, fee income vs partner cost vs commission, top shops, township outcomes, average pending age | "Township success rate is delivered ÷ (delivered + cancelled) — a cancelled order counts against the township." |
| Hover a bar / read the legend | Tooltip + legend with status names | "Charts are hand-built SVG — no charting package, no external data." |

**Caution while presenting:** COD on this dashboard is **expected** money, not cash received. Never say "collected" here.

### 3.3 Orders — create, filter, inspect (8 min)

| Do | Expected | Say |
|---|---|---|
| Go to **Orders** | 10 filters, table with Tracking / Status / Created / Est. delivery / COD / Shop settlement, pagination footer | "Search covers tracking, name, phone and address. Date basis switches between entry date and delivered date." |
| Filter `Status = PENDING`, then `Shop advance = Advance still due` | Row counts change; footer shows `n orders · Page x of y` | "Filters are server-side and page-reset automatically." |
| Click **Create order** | Dialog: shop, customer, township, assignee type, prices, paid-to-shop boxes, delivery address, notes | "The dialog scrolls inside itself — the footer is always reachable." |
| Select a township | Delivery fee, rider commission and estimated delivery date prefill | "Township supplies money and lead-time defaults only. It never supplies an assignee." |
| Set assignee type = Rider, pick `rider2`, save | Order is created as **ASSIGNED**, toast confirms, list refreshes | "No assignee → PENDING. With an assignee → ASSIGNED. Never created as delivered." |
| Open the new order's detail page | Tracking code + status badge, action buttons, sections for shop/customer/township/assignee, money, package/notes, history | "No screen prints a raw id — the API resolves names server-side, because an OFFICER may not hold shops/customers/riders read." |

### 3.4 Assignment, rider submit, approval (7 min)

| Do | Expected | Say |
|---|---|---|
| On an `ASSIGNED` order: **Postpone** with a reason | Status returns to `PENDING`, assignee cleared, history line added, toast | "Postponing always returns the order to the unassigned pool." |
| On a `PENDING` order: **Assign / clear** → rider | Status `ASSIGNED`; history shows the assignee change | "Reassigning to the same status still writes history — a reassignment is auditable." |
| Switch browser profile → sign in as `rider2` | `/rider-board`, "My deliveries", only own `ASSIGNED` orders | "A rider's API self-scopes from the JWT. There is no mine/all filter to get wrong." |
| Click **Submit delivered** on one row | Row disappears; toast "Delivery submitted for office approval" | "This moves the order to AWAITING_APPROVAL and stamps delivery time. It earns nothing yet." |
| Back as owner → **Confirm deliveries** | The submitted order is listed with submit time, assignee, COD to collect, Review buttons | "This is the queue that makes delivery real." |
| **Approve** | Dialog "Approve delivered order?", confirm → status `DELIVERED`, toast | "Approval flips commission pending → earned and COD expected → collected. It records no cash by itself." |
| Take a second order to `AWAITING_APPROVAL`, then **Send back** with a shop-visible reason + internal note | Status `ASSIGNED`, reason visible to shop, internal note office-only | "Send-back is the correction path; the rider retries. A rider has no fail button." |

### 3.5 Order detail — audit trail, terminal rules, shop advance (5 min)

| Do | Expected | Say |
|---|---|---|
| Open a `DELIVERED` order | **No Edit button**; Approve/Send back gone | "DELIVERED and CANCELLED are terminal — the API refuses an edit with 409, so the UI doesn't offer one." |
| Scroll to history | Every transition with actor name, note, reason | "Status history is written by the state service, not the client." |
| On an open order, **Edit order** and change the delivery fee | Audit section shows old → new, actor, reason | "Money edits on open orders are audited field by field." |
| On a delivered order, **Record advance** (needs `orders.shop_settlement`; a delivered order also needs `orders.update_after_approval` + reason) | Shop advance block shows the amount and date; shop settlement badge changes to `Paid`/`Partly paid` | "The advance is the one post-approval money change, and it is snapshotted — never typed by hand." |
| Back on **Orders**, read the Shop settlement column | `Paid`, `Partly paid · amount`, `Unpaid`, `Customer paid`, `Shop owes company · amount`, or a quiet `—` for cancelled | "This column is derived from order fields. It is not a payment record." |
| **Cancel** a `PENDING`/`ASSIGNED` order with a reason | Status `CANCELLED`, reason shown, order drops out of payable totals | "Cancelled covers both a called-off delivery and a package that came back — the return/reclaim flow is Phase 2 and not built." |

### 3.6 Rider handovers (5 min)

| Do | Expected | Say |
|---|---|---|
| Open **Rider handovers** | "Outstanding balances" table: Rider / Delivered COD / Handed back / Outstanding / Oldest unsettled / Last handover, plus "Handover history" | "Balances are all-time: delivered COD minus everything accepted. Not date-ranged." |
| Toggle **Only riders who still owe** | Rows with a zero balance disappear | "Negative balances stay visible too — company-holds-cash is a real state." |
| Click the record action on a rider's row | Dialog: rider (locked), amount, received on, received by, note | "Recording starts from the rider's row so the amount is checked against that rider's balance." |
| Type an amount **above** the outstanding balance and save | Confirm dialog "Record more than this rider owes?" naming balance, amount, difference | "It confirms instead of refusing: cash can arrive before the matching order is approved. The warning exists because a typo hides in a large balance." |
| Confirm, then open history → **Edit** the new handover, change the amount without a reason | Save blocked until a reason is entered | "Corrections are in place, with a required reason and per-field audit. There is deliberately no delete." |
| Save the correction, open the audit trail | Each changed field old → new with actor and reason | "A duplicate is corrected to 0.00, never removed — the row survives as history." |

### 3.7 Reports and exports (6 min)

| Do | Expected | Say |
|---|---|---|
| `/reports/orders` | Per-order package price, fee, COD, net owed, shop advance; filters shop/status/search/date range; `Export CSV` / `Export XLSX` | "Every figure is computed on read from orders — there is no ledger table." |
| `/reports/shop-statement` → pick a shop | Status counts, package/fee totals, COD collected vs expected, net owed delivered/pending, advanced to shop | "Read the warning on this page aloud: net owed can be negative, advances are counted by advance date, and COD is an expectation." |
| `/reports/rider-collection` | Per rider per day: delivered orders, awaiting approval orders, expected COD to hand back | "This says what a rider should be holding — handovers record what they actually handed in." |
| `/reports/rider-payout` | One row per rider: delivered orders, earned, pending approval | "Commission is per order; pending means awaiting approval, earned means delivered." |
| Export a CSV, open it | File downloads; toast "CSV download started" | "Export is gated by reports.export — an officer without it sees no buttons." |

### 3.8 Shop portal — the same order, shop's view (5 min)

| Do | Expected | Say |
|---|---|---|
| New profile → `shop1@demo.delivery.local` | Lands in `/shop`, top nav Overview / Orders / Statement, own shop only | "Shop scope comes from the user's shopId on the server, not from a query parameter." |
| `/shop/orders` → open an order | Order details, amounts, customer, township, delivery address, history | "No rider or partner identity, no partner cost, no internal notes." |
| Point at the status vocabulary | `Received` / `Out for delivery` / `Delivered` / `Cancelled` | "Shop-facing language differs from internal statuses on purpose." |
| `/shop/statement` → pick a range, export | Status counts + settlement totals; CSV/XLSX | "The shop sees its own settlement estimate — never another shop's, never rider cash." |

### 3.9 Administration and RBAC (7 min)

| Do | Expected | Say |
|---|---|---|
| As owner → **Users** → **New user**, role OFFICER | User created and listed | "Roles are data, not code. OFFICER is the operational role." |
| **Roles** → **New role** (e.g. `MANAGER`) | Row appears, Type `Standard`; OWNER shows `System` with a lock | "Role names are immutable after create; the description is editable." |
| **Permissions** → select `MANAGER` | 14 modules × their real actions; `Select all`; `Save changes` disabled until dirty | "46 keys, only the actions each module actually guards. No key exists without an endpoint." |
| Grant `orders.read` + `orders.update` only, save | Toast "Permissions updated" | "`PUT` replaces the whole grant set." |
| Select `OWNER` | Grid fully checked and read-only, with the system-role note | "A system role holds everything and has zero grant rows — read it from `isSystem`, never from the grants endpoint." |
| Sign in as the new OFFICER (or as `admin1`) | Sidebar hides Shops/Customers/Riders/Users/Roles; only permitted destinations | "The UI mirrors the API. Hiding is convenience — the API is the boundary." |
| Paste a forbidden URL directly (e.g. `/users` as OFFICER) | **403 page** with "Back to dashboard" | "A route gate, not just a hidden link." |
| As ADMIN, open **Roles** | OWNER and ADMIN rows read-only; own role read-only | "ADMIN cannot escalate itself or edit a system role." |

### 3.10 Change password and close (3 min)

| Do | Expected | Say |
|---|---|---|
| `/settings/password` → submit with a wrong current password | Inline error, no session change | "Validated server-side." |
| Change the password successfully | Toast "Password changed. Please sign in again." → forced to `/login` | "The backend invalidates old tokens; the frontend must force logout." |

> **If you demo a real password change on a seeded account, change it back immediately or reseed.** Otherwise the next presenter cannot log in.

---

## 4. Tester checklist (all modules)

Columns: **ID**, **Steps**, **Expected**, **Result**. Mark `☐ Pass ☐ Fail`. Report a failure with: module, account, tracking code / record id, expected vs actual, screenshot, and the failing request's status code.

### 4.1 Authentication and session

| ID | Steps | Expected | Result |
|---|---|---|---|
| AUTH-01 | Visit `/` while signed out | Redirect to `/login` | ☐ Pass ☐ Fail |
| AUTH-02 | Sign in as `owner@mail.com` / wrong password | Inline error, no session, stays on login | ☐ Pass ☐ Fail |
| AUTH-03 | Sign in with valid credentials | Lands on `/dashboard`; sidebar fully populated | ☐ Pass ☐ Fail |
| AUTH-04 | Reload the page | Session restored (`/auth/me`), no flash back to login | ☐ Pass ☐ Fail |
| AUTH-05 | Sign in as `rider1@demo.delivery.local` | Lands on `/rider-board`; no office destinations visible | ☐ Pass ☐ Fail |
| AUTH-06 | Sign in as `shop1@demo.delivery.local` | Lands in `/shop`; office and rider destinations absent | ☐ Pass ☐ Fail |
| AUTH-07 | Log out from the topbar menu | Session cleared, back to `/login`; back button does not restore the app | ☐ Pass ☐ Fail |

### 4.2 Office dashboard

| ID | Steps | Expected | Result |
|---|---|---|---|
| DASH-01 | Open `/dashboard` as owner | 5 KPI cards render with real numbers, not placeholders | ☐ Pass ☐ Fail |
| DASH-02 | Read the KPI labels | Today's orders, Awaiting approval, COD to collect today, Fee income today, Delayed orders | ☐ Pass ☐ Fail |
| DASH-03 | Change `From`/`To` to a 30-day range | All four charts and pending age re-query; range stays visible | ☐ Pass ☐ Fail |
| DASH-04 | Set `From` later than `To` | "The start date must not be after the end date." and no query error banner | ☐ Pass ☐ Fail |
| DASH-05 | Hover/read each chart | Orders by status, fees vs partner cost vs commission, top shops, township outcomes all have labels/legend | ☐ Pass ☐ Fail |
| DASH-06 | Sign in as OFFICER, open `/dashboard` | Loads (OFFICER holds `reports.read`) | ☐ Pass ☐ Fail |
| DASH-07 | Sign in as SHOP, try `/dashboard` | Not reachable — redirected into the shop portal | ☐ Pass ☐ Fail |

### 4.3 Orders — list and filters

| ID | Steps | Expected | Result |
|---|---|---|---|
| ORD-01 | Open `/orders` | Table loads with Tracking, Status, Created, Est. delivery, COD to collect, Shop settlement | ☐ Pass ☐ Fail |
| ORD-02 | Type a tracking code in **Search**, press Enter/blur | Result narrows to that order; page resets to 1 | ☐ Pass ☐ Fail |
| ORD-03 | Filter by Status `PENDING` | Only pending orders; footer count matches | ☐ Pass ☐ Fail |
| ORD-04 | Combine Shop + Township + Assignee filters | All applied together; mismatch yields the empty state | ☐ Pass ☐ Fail |
| ORD-05 | Filter `Shop advance = Advance still due` | Only orders with no recorded advance on an unpaid package | ☐ Pass ☐ Fail |
| ORD-06 | Switch **Date basis** to `Delivered date` | Rows change to orders delivered in range | ☐ Pass ☐ Fail |
| ORD-07 | Page forward/back | `Previous`/`Next` respect `meta`; first/last page disables correctly | ☐ Pass ☐ Fail |
| ORD-08 | Read the Shop settlement badges | Paid / Partly paid + amount / Unpaid / Customer paid / Shop owes company + amount / `—` when cancelled | ☐ Pass ☐ Fail |
| ORD-09 | Click a tracking code | Opens `/orders/:id` detail | ☐ Pass ☐ Fail |

### 4.4 Orders — create and edit

| ID | Steps | Expected | Result |
|---|---|---|---|
| ORD-10 | **Create order**, save with required fields | Created, toast, list refreshed | ☐ Pass ☐ Fail |
| ORD-11 | Create with no township | Saves; fee/commission/estimate left at defaults | ☐ Pass ☐ Fail |
| ORD-12 | Create with a township | Delivery fee, commission and estimated date prefill from it | ☐ Pass ☐ Fail |
| ORD-13 | Create with no assignee | Status `PENDING` | ☐ Pass ☐ Fail |
| ORD-14 | Create with a rider | Status `ASSIGNED`, assignee shown by name | ☐ Pass ☐ Fail |
| ORD-15 | Create with a partner | `partnerFee`/`partnerTrackingNo` become relevant; commission is forced to `0.00` | ☐ Pass ☐ Fail |
| ORD-16 | Tick **Package price paid** / **Delivery fee paid**, watch COD preview | COD preview drops by the paid part | ☐ Pass ☐ Fail |
| ORD-17 | Enter a negative or non-numeric amount | Inline field error, save blocked | ☐ Pass ☐ Fail |
| ORD-18 | Close the create dialog mid-typing, reopen | Fields reset; no stale error banner | ☐ Pass ☐ Fail |
| ORD-19 | Edit an open order's fee | Saves; audit records old → new + actor + reason | ☐ Pass ☐ Fail |
| ORD-20 | Change township on an open order | Prompt to keep current money or apply township defaults; assignee untouched | ☐ Pass ☐ Fail |
| ORD-21 | Open a `DELIVERED` or `CANCELLED` order | **No Edit button** | ☐ Pass ☐ Fail |
| ORD-22 | On a long form, shrink the window to ~700px height | Dialog scrolls internally; submit button always reachable | ☐ Pass ☐ Fail |

### 4.5 Order lifecycle actions

| ID | Steps | Expected | Result |
|---|---|---|---|
| LIFE-01 | Assign a `PENDING` order to a rider | Status `ASSIGNED`; history records the assignee | ☐ Pass ☐ Fail |
| LIFE-02 | Reassign to another rider | Still `ASSIGNED`; a new history row appears | ☐ Pass ☐ Fail |
| LIFE-03 | Clear the assignee | Status returns to `PENDING`; history "Order unassigned" | ☐ Pass ☐ Fail |
| LIFE-04 | Postpone an `ASSIGNED` order with a reason | Status `PENDING`, assignee cleared, reason stored | ☐ Pass ☐ Fail |
| LIFE-05 | Cancel a `PENDING` order with a reason | Status `CANCELLED`; reason visible; terminal | ☐ Pass ☐ Fail |
| LIFE-06 | Try every action on a `CANCELLED` order | No action buttons offered | ☐ Pass ☐ Fail |
| LIFE-07 | Assign a partner order, then **Mark delivered** | Dialog "Mark partner order delivered?" → `DELIVERED` directly, no approval step | ☐ Pass ☐ Fail |
| LIFE-08 | Submit a rider delivery in one tab, approve it in another | One succeeds, the other gets a 409 toast ("not in status …"), no double history | ☐ Pass ☐ Fail |
| LIFE-09 | Read the order's history section | Actor names, notes, reasons, internal notes (office only) | ☐ Pass ☐ Fail |

### 4.6 Confirm deliveries (approval queue)

| ID | Steps | Expected | Result |
|---|---|---|---|
| APPR-01 | Have a rider submit a delivery, then open `/orders/approval` | The order is listed: Tracking, Submitted, Assignee, COD to collect, Review | ☐ Pass ☐ Fail |
| APPR-02 | Read the queue description | Explains COD counts as expected back from the rider | ☐ Pass ☐ Fail |
| APPR-03 | **Approve** | Dialog "Approve delivered order?"; confirm → `DELIVERED`, toast "Delivery approved", row leaves the queue | ☐ Pass ☐ Fail |
| APPR-04 | **Send back** with reason + internal note | Dialog "Send order back"; confirm → `ASSIGNED`, toast, row leaves the queue | ☐ Pass ☐ Fail |
| APPR-05 | Open the sent-back order as a shop user | Shop-visible reason shown; internal note **not** shown | ☐ Pass ☐ Fail |
| APPR-06 | Open the queue with no submissions | "Queue is clear" empty state, no error | ☐ Pass ☐ Fail |
| APPR-07 | Sign in without `deliveries.approve` | No Confirm deliveries nav item; no Approve/Send back buttons | ☐ Pass ☐ Fail |

### 4.7 Rider console

| ID | Steps | Expected | Result |
|---|---|---|---|
| RDR-01 | Sign in as `rider2`, open **My deliveries** | Only own `ASSIGNED` orders; columns Tracking, Customer, Delivery address, Township, COD to collect, Action | ☐ Pass ☐ Fail |
| RDR-02 | Submit a delivery | Row disappears; toast "Delivery submitted for office approval" | ☐ Pass ☐ Fail |
| RDR-03 | Sign in as `rider1` with no assignments | "No assigned orders" empty state, no office data | ☐ Pass ☐ Fail |
| RDR-04 | Try to reach `/orders` as a rider | 403 page, not an empty order list | ☐ Pass ☐ Fail |
| RDR-05 | Open **My dashboard** | Delivered today/week/month, commission earned, commission pending approval, COD to hand back, per-day chart | ☐ Pass ☐ Fail |
| RDR-06 | Compare the dashboard's pending figure with an `AWAITING_APPROVAL` order | Pending commission includes it; approving it moves the amount to earned | ☐ Pass ☐ Fail |
| RDR-07 | Check a rider view for rider/partner identity or other riders' rows | Own identity only; no colleague data | ☐ Pass ☐ Fail |

### 4.8 Rider handovers

| ID | Steps | Expected | Result |
|---|---|---|---|
| HND-01 | Open `/rider-handovers` | "Outstanding balances" and "Handover history" sections both load | ☐ Pass ☐ Fail |
| HND-02 | Read a balances row | Rider, Delivered COD, Handed back, Outstanding, Oldest unsettled delivery, Last handover | ☐ Pass ☐ Fail |
| HND-03 | Verify the arithmetic on one rider | Outstanding = Delivered COD − Handed back (exact decimal string) | ☐ Pass ☐ Fail |
| HND-04 | Toggle **Only riders who still owe** | Zero-balance riders drop out; negative balances remain | ☐ Pass ☐ Fail |
| HND-05 | Search a rider by name | List filters | ☐ Pass ☐ Fail |
| HND-06 | Record a handover **below** the outstanding amount | Saves with no confirm; balance drops by that amount | ☐ Pass ☐ Fail |
| HND-07 | Record an amount **above** the outstanding amount | Confirm dialog naming balance, amount and difference; cancelling saves nothing | ☐ Pass ☐ Fail |
| HND-08 | Confirm the overpay | Saves; balance goes negative ("company holds cash") | ☐ Pass ☐ Fail |
| HND-09 | Submit with a future **Received on** | Blocked with a field error | ☐ Pass ☐ Fail |
| HND-10 | Submit with amount `0` or blank | Blocked with a field error | ☐ Pass ☐ Fail |
| HND-11 | Try every received method (KPAY / CASH / BANK TRANSFER) | All accepted and shown in history | ☐ Pass ☐ Fail |
| HND-12 | Edit a handover and change the amount, leaving the reason blank | Save blocked until a reason is entered | ☐ Pass ☐ Fail |
| HND-13 | Save the correction, open its audit trail | Each changed field old → new with actor and reason | ☐ Pass ☐ Fail |
| HND-14 | Look for a delete action on a handover | None exists — correction only | ☐ Pass ☐ Fail |
| HND-15 | Open a handover with no corrections | "No corrections — this handover reads as it was recorded." | ☐ Pass ☐ Fail |
| HND-16 | Filter history by rider, method and received-date range | Rows match; Reset clears them | ☐ Pass ☐ Fail |
| HND-17 | Sign in without `rider-handovers.update` | No Edit action on history rows | ☐ Pass ☐ Fail |

### 4.9 Shops and customers

| ID | Steps | Expected | Result |
|---|---|---|---|
| DIR-01 | `/shops` → **New shop** with name, channel, channel name, phone, address | Created, toast, list refreshes | ☐ Pass ☐ Fail |
| DIR-02 | Search by name / phone / channel; filter by channel | Matching rows only; Reset clears | ☐ Pass ☐ Fail |
| DIR-03 | Edit a shop | Changes persist; toast "Shop updated" | ☐ Pass ☐ Fail |
| DIR-04 | Delete a shop with no orders | Confirm dialog, then removed | ☐ Pass ☐ Fail |
| DIR-05 | Delete a shop that still has orders | Refused with the backend message (409), row stays | ☐ Pass ☐ Fail |
| DIR-06 | `/customers` → create, edit, delete | Same pattern; table shows Name, Phone, Address, Created | ☐ Pass ☐ Fail |
| DIR-07 | Delete a customer referenced by an order | Refused with the backend message | ☐ Pass ☐ Fail |

### 4.10 Riders, townships, partners

| ID | Steps | Expected | Result |
|---|---|---|---|
| SET-01 | `/riders` → **New rider** (account + profile sections) | Created as RIDER; can log in with the given password | ☐ Pass ☐ Fail |
| SET-02 | Leave email/password blank on create | Inline errors; save blocked | ☐ Pass ☐ Fail |
| SET-03 | Set a rider `INACTIVE` | Status badge changes; rider cannot be assigned (check the order form's rider list) | ☐ Pass ☐ Fail |
| SET-04 | `/townships` → create with delivery fee, rider commission, lead time | Saved; table shows Township, Default delivery fee, Rider commission, Lead time | ☐ Pass ☐ Fail |
| SET-05 | Enter a non-integer lead time (e.g. `2.5`) | Field error, save blocked | ☐ Pass ☐ Fail |
| SET-06 | Edit a township's commission | Saved; new orders in that township prefill the new value | ☐ Pass ☐ Fail |
| SET-07 | Delete a township referenced by orders | Refused (409), row stays | ☐ Pass ☐ Fail |
| SET-08 | `/partners` → create, edit, toggle active | Persists; an inactive partner cannot be assigned | ☐ Pass ☐ Fail |
| SET-09 | Delete a partner referenced by an order | Refused with the backend message | ☐ Pass ☐ Fail |
| SET-10 | Confirm riders have no township coverage UI and townships have no assignee UI | Neither concept appears | ☐ Pass ☐ Fail |

### 4.11 Users, roles, permissions

| ID | Steps | Expected | Result |
|---|---|---|---|
| ADM-01 | `/users` → **New user** with name, email, role, status, password | Created; appears in the table | ☐ Pass ☐ Fail |
| ADM-02 | Filter users by role and by status | Correct subsets; Apply/Reset work | ☐ Pass ☐ Fail |
| ADM-03 | Create a user with a duplicate email | Backend error surfaced, no duplicate row | ☐ Pass ☐ Fail |
| ADM-04 | `INACTIVE` a user, then try to sign in as them | Sign-in refused | ☐ Pass ☐ Fail |
| ADM-05 | Sign in as `admin1`, open **New user** | Role list excludes OWNER and ADMIN | ☐ Pass ☐ Fail |
| ADM-06 | As ADMIN, open a role they may not manage | Read-only, no edit action | ☐ Pass ☐ Fail |
| ADM-07 | `/roles` → **New role** | Created with Type `Standard`; OWNER row shows `System` + lock | ☐ Pass ☐ Fail |
| ADM-08 | Edit a role's description | Saves; the name field is not editable | ☐ Pass ☐ Fail |
| ADM-09 | Delete a role with users | Refused (409) with the backend message | ☐ Pass ☐ Fail |
| ADM-10 | Delete an unused role | Confirm dialog, then removed | ☐ Pass ☐ Fail |
| ADM-11 | `/permissions` → select a standard role | Grid renders 14 modules; only real actions per module; no `import` column | ☐ Pass ☐ Fail |
| ADM-12 | Toggle a key, save | Toast "Permissions updated"; the change survives a reload | ☐ Pass ☐ Fail |
| ADM-13 | **Select all**, then save | Full set granted for that role | ☐ Pass ☐ Fail |
| ADM-14 | Select the OWNER role | Everything checked, read-only, system-role note visible | ☐ Pass ☐ Fail |
| ADM-15 | Grant only `orders.read`, sign in as that user | Orders visible; other modules hidden; direct URL to a hidden module gives 403 | ☐ Pass ☐ Fail |
| ADM-16 | Sign in as a user without `permissions.update` | Grid read-only with the "saving grants needs the permissions.update key" note | ☐ Pass ☐ Fail |
| ADM-17 | Change a role's grants while that role is signed in elsewhere | Their navigation updates on next session/boot, and the API refuses newly-revoked calls | ☐ Pass ☐ Fail |

### 4.12 Reports and exports

| ID | Steps | Expected | Result |
|---|---|---|---|
| RPT-01 | `/reports/orders` → filter by status and shop | Table + totals match the filters | ☐ Pass ☐ Fail |
| RPT-02 | `Export CSV` then `Export XLSX` | Both download; toast names the format | ☐ Pass ☐ Fail |
| RPT-03 | `/reports/shop-statement` → pick a shop and range | Status counts + money totals render; no blank cards | ☐ Pass ☐ Fail |
| RPT-04 | Read the statement warning text | Mentions negative net owed, advance-date counting, COD as expectation, handovers not per-order | ☐ Pass ☐ Fail |
| RPT-05 | `/reports/rider-collection` → filter a rider | Per-day delivered vs awaiting approval, expected COD to hand back, report total | ☐ Pass ☐ Fail |
| RPT-06 | `/reports/rider-payout` | One row per rider: delivered orders, earned, pending approval | ☐ Pass ☐ Fail |
| RPT-07 | Set an invalid range on any report | Inline "start date must not be after end date", no crash | ☐ Pass ☐ Fail |
| RPT-08 | Sign in without `reports.export` | No export buttons anywhere | ☐ Pass ☐ Fail |
| RPT-09 | Compare an order's COD in the report with the orders list | Same figure, same decimal places | ☐ Pass ☐ Fail |

### 4.13 Shop portal

| ID | Steps | Expected | Result |
|---|---|---|---|
| SHOP-01 | Sign in as `shop1` | Overview opens; nav Overview / Orders / Statement only | ☐ Pass ☐ Fail |
| SHOP-02 | Browse Overview | Orders-by-display-status chart + settlement summary (COD collected, net settlement) | ☐ Pass ☐ Fail |
| SHOP-03 | `/shop/orders` → filter by status, date range, search | Own orders only; pagination works | ☐ Pass ☐ Fail |
| SHOP-04 | Export CSV/XLSX from orders | Downloads; both buttons present for SHOP | ☐ Pass ☐ Fail |
| SHOP-05 | Open an order detail | Customer, township, address, amounts, history; **no rider/partner name, no partner cost, no internal note** | ☐ Pass ☐ Fail |
| SHOP-06 | Read the status labels | `Received`, `Out for delivery`, `Delivered`, `Cancelled` | ☐ Pass ☐ Fail |
| SHOP-07 | `/shop/statement` → select range, read counts and totals | Own settlement only; export works | ☐ Pass ☐ Fail |
| SHOP-08 | Sign in as `shop2` and open a `shop1` order URL | "This order is unavailable in your shop account." | ☐ Pass ☐ Fail |
| SHOP-09 | Try `/orders` or `/dashboard` as a shop user | No access to office routes | ☐ Pass ☐ Fail |

### 4.14 Settings, errors, cross-cutting

| ID | Steps | Expected | Result |
|---|---|---|---|
| UI-01 | `/settings/password` → wrong current password | Field error, session intact | ☐ Pass ☐ Fail |
| UI-02 | Change password successfully | Toast + forced sign-out; old password no longer works; new one does | ☐ Pass ☐ Fail |
| UI-03 | Visit a URL with no permission | 403 page with "Back to dashboard" | ☐ Pass ☐ Fail |
| UI-04 | Visit `/does-not-exist` | 404 page with "Back to dashboard" | ☐ Pass ☐ Fail |
| UI-05 | Stop the API (`Ctrl-C`), then reload a page | Error state with a readable message, no blank screen or crash | ☐ Pass ☐ Fail |
| UI-06 | Restart the API, retry | Data loads again | ☐ Pass ☐ Fail |
| UI-07 | Resize to 375px width on every main page | No horizontal page scroll; tables scroll inside their container | ☐ Pass ☐ Fail |
| UI-08 | Tab through a dialog and a table | Visible focus rings; controls reachable in order; dialog traps focus | ☐ Pass ☐ Fail |
| UI-09 | Check every field has a visible label and errors appear below the field | Labels visible; inline errors; no colour-only signalling | ☐ Pass ☐ Fail |
| UI-10 | Read a status badge aloud / use a screen reader | Status text is present, not colour alone | ☐ Pass ☐ Fail |

---

## 5. Data snapshot (this database, 2026-10-24)

| Fact | Value |
|---|---|
| Orders | 39 total — PENDING 5, ASSIGNED 4, AWAITING_APPROVAL **0**, DELIVERED 13, CANCELLED 17 |
| Shops | 4 (3 demo + 1 created during testing) |
| Riders | Demo Rider One, Demo Rider Two |
| Rider handovers | 6 recorded |
| Rider One balance | Delivered COD 230,000.00 − handed back 179,500.00 = outstanding **50,500.00** |
| Rider Two board | 2 assigned orders: `DEMO-ORD-004`, `DEMO-ORD-016` |
| Rider One board | Empty — no assigned orders |
| Townships | Demo Central (3,500 fee / 500 commission / 1 day), Demo North (4,500 / 700 / 2), Demo South (5,000 / 600 / 3) |
| Partners | Demo Swift Partner, Demo Rapid Partner |

Consequences for the presentation:

1. The approval queue is **empty** until a rider submits something — stage it in pre-flight.
2. Use **rider2** for the rider segment; rider1 has nothing to deliver.
3. Use **rider1** for the handover segment (50,500 outstanding).
4. 17 of 39 orders are cancelled, so dashboard/report totals look cancellation-heavy. Say so before someone assumes a bug.

---

## 6. What not to claim

These are deliberate limits, not gaps to apologise for. Say the limit, then say why.

| Don't say | Say instead |
|---|---|
| "COD collected" on the dashboard/order list | "COD **expected** — the office records cash only when a rider hands it over." |
| "The handover balance reconciles these orders" | "It is an all-time aggregate per rider, not a ledger; it does not match specific orders." |
| "Payments are reconciled / shops are settled" | "Net owed is derived from order fields; there is no payment ledger or settlement event (Phase 6)." |
| "Returns are handled" | "A package that came back is recorded as `CANCELLED`. The return-and-reclaim flow is Phase 2, not built." |
| "On-time delivery rate" | "No promised time or delivery-start timestamp exists, so on-time and transit metrics can't be computed." |
| "The dashboard is real-time" | "It is computed on read from orders, scoped to the selected date range." |
| "Riders can reject a delivery" | "Riders have no fail action; an officer cancels, postpones or sends back." |
| "The rider sees the customer's payment" | "The rider sees COD to collect only; commission and settlement are office figures." |

---

## 7. Recovery when something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| "Queue is clear" on Confirm deliveries | No `AWAITING_APPROVAL` orders | Rider submits a delivery; or reseed and stage it |
| Everything 401s / kicked to login | Token expired or backend restarted with a new secret | Sign in again |
| 409 "Order … is not in status …" | Someone else already moved it (two tabs, two testers) | Reload the detail page; it is the guard working |
| Empty selects in the order form (no shops/customers) | Seed not run, or `INACTIVE` records filtered out | `pnpm db:seed:demo`, and check statuses |
| Export does nothing | Account lacks `reports.export` / `shop-reports.export` | Use owner, or grant the key |
| A seeded account can't log in | A password-change test was left applied | Reseed, or reset the password with an owner account |
| Demo data too messy to present | Accumulated test orders | `pnpm db:reset` in `delivery_solution_api` — **destructive: drops the schema**, then `pnpm db:seed && pnpm db:seed:demo`. Get explicit approval before running it. |

`pnpm db:seed:demo` is idempotent for the demo rows (it upserts by name/tracking code and rewrites their history), but it does **not** remove orders, users or handovers created during testing.

---

## 8. Sign-off

| Module | Tester | Pass / Fail | Notes |
|---|---|---|---|
| Auth & session | | | |
| Office dashboard | | | |
| Orders (list, create, edit) | | | |
| Lifecycle (assign, postpone, cancel, approve, send-back) | | | |
| Rider console | | | |
| Rider handovers | | | |
| Shops & customers | | | |
| Riders, townships, partners | | | |
| Users, roles, permissions | | | |
| Reports & exports | | | |
| Shop portal | | | |
| Settings, errors, responsive | | | |

**Tested build:** frontend `feature/main_v2` @ `490f38d` · API per `delivery_solution_api` working tree · date: ____________
