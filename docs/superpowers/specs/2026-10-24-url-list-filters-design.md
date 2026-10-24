# URL-backed list filters — design

**Status:** implemented on `feature/url-list-filters`
**Date:** 2026-10-24

## Intent

Every office list page holds its filters in `useState` (`OrdersPage.tsx:47-58` is the
largest: ten separate `useState` calls, including a `page` and a today-defaulted date
range). React Query caches the response, but the query key includes the filters, so
returning to the page with default filters is a cache miss as well as a lost view.

The result: open an order, press back, and the list is unfiltered and back on page 1.
Filter to one township, check another menu, return, and the filter is gone. A filtered
view cannot be shared with a colleague.

Put the filters in the URL. The URL is then the single source of truth for "what is
this list showing", and the data table cache starts working again for free, because the
query key is stable across navigation.

## Decisions

1. **The URL is the source of truth.** No filter store, no duplicated state. A page
   reads its filters with `useSearchParams` and writes them back with
   `setSearchParams`.
2. **Param names are the API's own names** — `search`, `status`, `shopId`,
   `townshipId`, `assigneeId`, `shopAdvance`, `isPackagePaidToShop`, `dateFrom`,
   `dateTo`, `dateBasis`, `page`. One name set, no translation table between the URL
   and `OrderFilters`.
3. **Defaults are omitted from the URL.** `/orders` means "today, entry date basis,
   page 1". This is what keeps a defaulted date range honest: the URL never stores
   "today", so tomorrow `/orders` means tomorrow. An explicitly chosen range *is*
   stored, and is visible in the date inputs. This resolves the stale-default problem
   without any day-rollover logic.
4. **The URL is canonicalized on mount.** Unknown or invalid values (`?status=BOGUS`,
   `?page=abc`) are parsed to their defaults and the URL is rewritten (replace) to the
   canonical form, so what the address bar shows is what the list is showing.
5. **Every filter write is `replace`, never `push`.** Otherwise five filter changes
   leave five history entries and Back becomes "undo a filter" instead of "leave the
   page". Pushing only happens when opening a detail page, so Back from a detail
   returns to the filtered list.
6. **`page` lives in the URL too.** Returning from a detail restores the page you were
   on. The page is clamped to `meta.totalPages` when the row count shrank while away.
7. **The sidebar restores the last view of a list.** A URL alone cannot do this: the
   nav link points at `/orders` with no query. Each list page remembers its last
   non-empty query string in `sessionStorage`, keyed by **pathname** — the sidebar
   looks up `item.to`, so a schema-chosen key would need a second mapping table. The
   sidebar **subscribes** to that memory (`useListQuery`) rather than reading it during
   render: the memory is written from an effect, so a plain read goes one filter change
   behind and clicking the link would drop the change that just happened. A clean list
   forgets the entry, so Reset produces a clean list and a clean nav link.
8. **The memory is cleared on login, logout, and 401** — `clearSession` is the single
   teardown path, and `LoginPage` clears it on success. A new user in the same tab never
   inherits the previous user's filters.
9. **A cleared date input needs a sentinel.** The Orders list lets an officer clear a
   date bound to mean "no bound". Since a missing `dateFrom` means "today", an
   explicitly cleared bound is serialized as the empty value `dateFrom=` and
   distinguished with `params.has('dateFrom')`. Only Orders needs this: the handover
   filters have no date default, so a missing date is already "no bound".
10. **No debounce.** The search input writes to the URL on every keystroke (`replace`,
    so no history noise). That matches today's behaviour, where every keystroke already
    fires a request; debouncing is a separate change to how the page commits filters.
11. **A page with two filtered lists owns one schema.** Rider handovers has an
    outstanding-balances table and a history table, each paginated. Two `useUrlFilters`
    instances on one pathname would each rewrite the whole query string from their own
    values and delete the other's params. The page owns one schema; the sections receive
    value slices plus `onChange`, and pass `{ keepPage: true }` when a change must not
    reset the *other* table's page.
12. **A page number in the URL is clamped to `meta.totalPages`.** Every list does this,
    including both handover tables. A remembered or pasted page can outlive its rows, and
    with `totalPages > 1` false the pagination is not even rendered — the officer would
    see an empty list with no way back.
13. **URL dates must be real calendar dates, not just `YYYY-MM-DD`-shaped.**
    `2026-02-31` passes a regex, round-trips byte-identically, and is then sent to an API
    that rejects it. `isIsoCalendarDate` (`features/reports/date-range.ts`) round-trips
    the parts through `Date`, and an impossible date falls back to the default like any
    other invalid value.

## Behaviour

| Action | Result |
|---|---|
| Filter on Orders, open an order, press Back | Same filters, same page, table from cache |
| Filter on Orders, go to Dashboard, click Orders | Same filters, same page (sidebar memory) |
| Reload the filtered list | Same filters (they are in the URL) |
| Paste a filtered link in another tab | Same filters, regardless of memory |
| Click **Reset filters** | Defaults, URL empty, memory cleared, sidebar links clean |
| Open `/orders` tomorrow after a fresh login | Today's date range |
| Open an old link with `dateFrom=2026-09-01` tomorrow | That bound, unchanged — an explicit bound is stored, while an omitted one re-resolves to "today" |
| `/orders?status=BOGUS&page=abc` | Defaults; URL rewritten to `/orders` |

## Non-goals

- **Report pages** (`/reports/*`, `/dashboard`). Their whole screen is the date range,
  and `getDefaultReportDateRange()` is a trailing 7 days. They get a follow-on plan
  once this pattern has been through a review.
- **Directory pages** (`/users`, `/shops`, `/customers`, `/riders`) and the shop portal.
  Same pattern, mechanically, after the first three pages prove it.
- **Changing how filters commit** — Orders stays immediate, handovers stay
  draft + Apply. Only where the filter state lives changes.
- **Debounced search.** See Decision 10.

## Known limitations

- A tab left open across midnight keeps showing yesterday, because the tab's memory and
  URL are still explicit about dates only when the officer set them. With omitted
  defaults, `/orders` re-resolves "today" on the next load — so this only affects a tab
  that was never reloaded. Accepted; office staff log in each morning.
- Two tabs share no memory (`sessionStorage` is per tab) and can show different filters.
  That is correct for two independent views.
- The canonicalization rewrites the whole query string, so foreign params
  (`?utm_source=…`) on these pages are dropped.

## Where it lives

| Concern | File |
|---|---|
| `useUrlFilters` hook, schema type | `src/lib/url/useUrlFilters.ts` |
| Per-tab "last view" memory + `useListQuery` | `src/lib/url/list-query-memory.ts` |
| Orders URL contract | `src/features/orders/order-filters.ts` |
| Handovers URL contract (one page-level schema) | `src/features/rider-handovers/handover-filters.ts` |
| Calendar-date validation shared by both | `src/features/reports/date-range.ts` (`isIsoCalendarDate`) |
| Nav links | `src/components/layout/Sidebar.tsx` |
