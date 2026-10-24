/**
 * The last filtered view of each list page, remembered per tab so the sidebar
 * can return to it.
 *
 * A URL is enough to survive a reload, a shared link, and the Back button, but
 * not a click on the nav item: that points at `/orders` with no query string.
 * The remembered query fills that gap.
 *
 * `sessionStorage` rather than `localStorage`: the memory belongs to this tab's
 * working session, dies with the tab, and is cleared explicitly on login and
 * logout (see `clearSession`), so two users never share a filtered view.
 *
 * Every access is guarded. `sessionStorage` is absent in some sandboxed and
 * private contexts and its setter throws when the quota is full; losing the
 * memory costs one convenience, losing the page costs the whole screen.
 */

import { useSyncExternalStore } from 'react'

const STORAGE_PREFIX = 'delivery-list-query:'

/**
 * Listeners for the remembered views. The sidebar renders a nav link per
 * destination, and a link built from a value nobody re-reads goes stale the
 * moment the officer changes a filter — clicking it would then drop the filter
 * they just set. `useListQuery` below subscribes instead.
 */
const listeners = new Set<() => void>()

function notifyListeners(): void {
  for (const listener of listeners) listener()
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`
}

function sessionStorageOrNull(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Remembers `query` (a string beginning with `?`) for `key`. An empty string forgets it. */
export function rememberListQuery(key: string, query: string): void {
  const storage = sessionStorageOrNull()
  if (!storage) return
  try {
    if (query === '') storage.removeItem(storageKey(key))
    else storage.setItem(storageKey(key), query)
  } catch {
    // Quota or a blocked store: the view is forgotten, the page still works.
  }
  notifyListeners()
}

/** The remembered query for `key`, or `''` when nothing is stored. */
export function readListQuery(key: string): string {
  const storage = sessionStorageOrNull()
  if (!storage) return ''
  try {
    return storage.getItem(storageKey(key)) ?? ''
  } catch {
    return ''
  }
}

export function forgetListQuery(key: string): void {
  const storage = sessionStorageOrNull()
  if (!storage) return
  try {
    storage.removeItem(storageKey(key))
  } catch {
    // Nothing to do — a memory that cannot be written cannot be stale either.
  }
  notifyListeners()
}

/**
 * Drops every remembered view. Called when a session ends, so the next user in
 * this tab starts from clean defaults.
 */
export function forgetAllListQueries(): void {
  const storage = sessionStorageOrNull()
  if (!storage) return
  try {
    // Snapshot the keys first: `removeItem` renumbers the remaining indexes.
    const keys: string[] = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key !== null && key.startsWith(STORAGE_PREFIX)) keys.push(key)
    }
    for (const key of keys) storage.removeItem(key)
  } catch {
    // Nothing to do.
  }
  notifyListeners()
}

/**
 * The remembered query for `key`, subscribed. Use this where a value has to
 * stay fresh across a filter change without a navigation — the sidebar's links.
 * A plain render-time `readListQuery` there goes one commit behind, because the
 * memory is written from an effect.
 */
export function useListQuery(key: string): string {
  return useSyncExternalStore(subscribeToListQueries, () => readListQuery(key))
}

/**
 * The full destination for a link back to a list: the path plus the view that
 * list was last showing. Every "back to orders" link goes through this — a bare
 * `/orders` silently drops the filter and the page the officer was on, which is
 * the whole thing the URL is there to preserve.
 */
export function useListPath(pathname: string): string {
  return `${pathname}${useListQuery(pathname)}`
}

function subscribeToListQueries(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
