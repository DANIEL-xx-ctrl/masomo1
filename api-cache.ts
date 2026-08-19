'use client'

// ============================================================
// api-cache.ts — Client-side request deduplication + TTL cache
// ------------------------------------------------------------
// PROBLEM:
//   On Vercel, the MASOMO app was hitting
//   "ResourceExhausted: container exceed the concurrency threshold"
//   because multiple components (NotificationDropdown, MessageSummaryCard,
//   ConnectedUsersModule, useHeartbeat, …) independently poll the same
//   API endpoints every 30s. When several of these fire at once —
//   especially on mount / navigation / store update — Vercel spins up
//   many concurrent serverless function invocations and rejects the
//   excess with HTTP 503 ResourceExhausted.
//
// SOLUTION:
//   `dedupedFetch` coalesces concurrent identical requests into a single
//   HTTP call (in-flight dedup) AND memoizes the successful response for
//   a short TTL (default 5s). This means:
//     - 5 components calling /api/notifications at the same instant → 1 HTTP request
//     - Repeated polls within the TTL → served from cache, 0 HTTP requests
//   This dramatically reduces the number of serverless invocations and
//   eliminates the concurrency-threshold error.
//
// USAGE:
//   import { dedupedFetch } from '@/lib/api-cache'
//   const res = await dedupedFetch('/api/notifications?limit=30', {
//     headers: { 'x-user-id': userId },
//   }, { ttl: 5000 })
// ============================================================

interface CacheEntry {
  promise: Promise<Response>
  timestamp: number
  ttl: number
  // The resolved body is cached as a cloned Response so multiple callers
  // can independently read .json() / .text() without consuming the stream.
  resolved: Response | null
}

const inflight = new Map<string, CacheEntry>()

/**
 * Build a stable cache key from url + relevant headers.
 * We only include custom x-* headers (which carry auth context) so that
 * different users don't share cached responses.
 */
function buildKey(url: string, init?: RequestInit): string {
  const headers = init?.headers
  let headerStr = ''
  if (headers) {
    if (headers instanceof Headers) {
      headerStr = JSON.stringify({
        'x-user-id': headers.get('x-user-id'),
        'x-user-role': headers.get('x-user-role'),
        'x-institution-id': headers.get('x-institution-id'),
      })
    } else if (Array.isArray(headers)) {
      const obj: Record<string, string> = {}
      for (const [k, v] of headers) {
        if (k.startsWith('x-')) obj[k] = v
      }
      headerStr = JSON.stringify(obj)
    } else if (typeof headers === 'object') {
      const obj: Record<string, string> = {}
      for (const [k, v] of Object.entries(headers)) {
        if (k.startsWith('x-')) obj[k] = String(v)
      }
      headerStr = JSON.stringify(obj)
    }
  }
  return `${url}::${headerStr}`
}

export interface DedupOptions {
  /** How long to cache a successful response (ms). Default 5000. */
  ttl?: number
  /** Skip the cache entirely (still dedups concurrent in-flight requests). */
  noCache?: boolean
}

/**
 * Fetch wrapper that:
 *   1. Coalesces concurrent identical requests into one HTTP call.
 *   2. Caches the response for `ttl` ms so repeated calls within the
 *      window return instantly without hitting the server.
 *
 * The returned Promise resolves to a fresh Response clone for each
 * caller (so .json() / .text() can be consumed independently).
 */
export function dedupedFetch(
  url: string,
  init?: RequestInit,
  options: DedupOptions = {}
): Promise<Response> {
  const ttl = options.ttl ?? 5000
  const key = buildKey(url, init)
  const now = Date.now()

  const existing = inflight.get(key)

  // Serve from cache if within TTL
  if (existing && !options.noCache && existing.resolved && now - existing.timestamp < existing.ttl) {
    return Promise.resolve(existing.resolved.clone())
  }

  // If there's an in-flight request for this key, piggy-back on it
  if (existing && !existing.resolved) {
    return existing.promise.then((r) => r.clone())
  }

  // Otherwise, start a new request
  const promise = fetch(url, init).then((res) => {
    const entry = inflight.get(key)
    if (entry) {
      entry.resolved = res.clone()
      entry.timestamp = Date.now()
      entry.ttl = ttl
    }
    // Schedule cache eviction after TTL so memory doesn't grow unbounded
    setTimeout(() => {
      const e = inflight.get(key)
      if (e && e.resolved && Date.now() - e.timestamp >= e.ttl) {
        inflight.delete(key)
      }
    }, ttl + 1000)
    return res
  }).catch((err) => {
    // On error, remove the in-flight entry so the next call can retry
    inflight.delete(key)
    throw err
  })

  inflight.set(key, {
    promise,
    timestamp: now,
    ttl,
    resolved: null,
  })

  return promise
}

/**
 * Convenience helper: deduped fetch + auto JSON parse.
 * Returns { data, response } or throws on non-ok / network error.
 */
export async function dedupedJson<T = unknown>(
  url: string,
  init?: RequestInit,
  options?: DedupOptions
): Promise<{ data: T; response: Response }> {
  const res = await dedupedFetch(url, init, options)
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as T
  return { data, response: res }
}

/**
 * Clear the entire cache. Useful on logout / user switch.
 */
export function clearApiCache() {
  inflight.clear()
}

/**
 * Returns true if the document is currently hidden (tab in background).
 * Polling should be skipped in this state to avoid wasting serverless
 * invocations — the user isn't looking at the page anyway.
 */
export function isTabHidden(): boolean {
  if (typeof document === 'undefined') return false
  return document.visibilityState === 'hidden'
}
