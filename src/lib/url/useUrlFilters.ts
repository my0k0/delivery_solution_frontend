import { useCallback, useEffect, useMemo } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { forgetListQuery, rememberListQuery } from './list-query-memory'

/**
 * How one list page's filters are spelled in the URL.
 *
 * Each feature owns its schema module (`orders/order-filters.ts`), so the URL
 * contract sits next to the filters it describes instead of inside the page.
 * `defaults()` is a function because a default can be relative to now — the
 * Orders list defaults both date bounds to today.
 */
export interface UrlFilterSchema<T extends { page: number }> {
  defaults: () => T
  /** Reads a URL into filters. Must never throw and must narrow every union for real. */
  parse: (params: URLSearchParams) => T
  /** Writes filters into a URL, omitting anything equal to its default. */
  serialize: (values: T) => URLSearchParams
}

export interface UrlFiltersResult<T extends { page: number }> {
  filters: T
  /**
   * Merges `patch` into the current filters and writes the URL. `page` returns
   * to the default unless `keepPage` is set, so changing a filter never leaves
   * the officer stranded on page 4 of a narrower result.
   */
  update: (patch: Partial<T>, options?: { keepPage?: boolean }) => void
  reset: () => void
  /**
   * True when any filter other than `page` differs from its default, so the
   * "Reset filters" control does not appear merely because you paged forward.
   */
  hasActiveFilters: boolean
}

/**
 * The URL is the single source of truth for a list page's filters.
 *
 * Reading goes through `parse`, so a hand-edited or stale link can never crash
 * the page: unknown values fall back to their defaults. Writing always uses
 * `replace`, never `push` — otherwise five filter changes leave five history
 * entries and Back unwinds filters instead of leaving the page.
 */
export function useUrlFilters<T extends { page: number }>(
  schema: UrlFilterSchema<T>,
): UrlFiltersResult<T> {
  const [searchParams, setSearchParams] = useSearchParams()
  // The remembered view is keyed by path, which is exactly what a sidebar link
  // can look up without a second mapping table.
  const { pathname } = useLocation()
  const filters = useMemo(() => schema.parse(searchParams), [schema, searchParams])

  // Canonicalize: drop values that failed to parse, so the address bar and the
  // list can never disagree. Guarded by an equality check — the write re-enters
  // this effect once and then stops.
  useEffect(() => {
    const canonical = schema.serialize(filters).toString()
    if (canonical !== searchParams.toString()) {
      setSearchParams(canonical, { replace: true })
    }
    if (canonical === '') forgetListQuery(pathname)
    else rememberListQuery(pathname, `?${canonical}`)
  }, [filters, pathname, schema, searchParams, setSearchParams])

  const update = useCallback(
    (patch: Partial<T>, options?: { keepPage?: boolean }) => {
      const merged = Object.assign({}, filters, patch)
      const next =
        options?.keepPage === true
          ? merged
          : Object.assign({}, merged, { page: schema.defaults().page })
      setSearchParams(schema.serialize(next), { replace: true })
    },
    [filters, schema, setSearchParams],
  )

  const reset = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
    forgetListQuery(pathname)
  }, [pathname, setSearchParams])

  const hasActiveFilters = useMemo(
    () =>
      schema.serialize(Object.assign({}, filters, { page: schema.defaults().page })).size > 0,
    [filters, schema],
  )

  return { filters, update, reset, hasActiveFilters }
}
