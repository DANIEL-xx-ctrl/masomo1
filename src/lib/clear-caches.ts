/**
 * clearAllCaches()
 *
 * Clears EVERY layer of client-side caching so that a newly logged-in user
 * never sees the PREVIOUS user's data:
 *
 *   1. Service Worker Cache API (caches named masomo-v2-static / -runtime / -api
 *      and any legacy caches). The SW intercepts /api/* GETs and serves them
 *      stale-while-revalidate — keyed by URL alone. Since user-specific
 *      endpoints (/api/auth/profile, /api/dashboard, /api/messages…) return
 *      different bodies per x-user-id header, a cached response for user A
 *      would be returned to user B immediately, overwriting user B in the
 *      store.
 *
 *      We clear the Cache API DIRECTLY from the window context (caches.keys()
 *      + caches.delete()) rather than just postMessaging the SW, because
 *      postMessage is fire-and-forget — the SW might not have processed it
 *      by the time the new user's first API requests start. The window has
 *      direct access to the same Cache API the SW uses, so we can clear
 *      synchronously (well, Promise-based but immediate) before returning.
 *
 *   2. IndexedDB offline response cache (from @/lib/offline-queue). Same
 *      URL-keyed problem — user A's /api/dashboard response would be
 *      returned to user B if the network fails. We clear the store.
 *
 *   3. In-flight API request dedupe map (from @/lib/api-cache). Stale
 *      promises from a previous user could resolve with the wrong data.
 *
 * Call this:
 *   - In handleLogin (login.tsx) right AFTER a successful login response,
 *     BEFORE calling store.login(newUser). This guarantees the new user's
 *     first API calls hit a clean cache.
 *   - In the logout handler (app-shell.tsx) BEFORE calling store.logout(),
 *     so the login page that follows doesn't see stale data.
 */
export async function clearAllCaches(): Promise<void> {
  if (typeof window === 'undefined') return

  // 1. Clear ALL Cache API caches DIRECTLY from the window context.
  //    This is the same Cache API the Service Worker uses, so deleting
  //    here immediately removes the entries the SW would serve. We do
  //    this in the window (not just via postMessage) because postMessage
  //    is async/fire-and-forget — we need the caches gone BEFORE we return.
  try {
    if (typeof caches !== 'undefined') {
      const names = await caches.keys()
      await Promise.all(names.map((n) => caches.delete(n)))
    }
  } catch {
    /* swallow — best effort */
  }

  // Also notify the SW so it can clean up any internal references.
  // Belt-and-suspenders: the window-side deletion above already did the
  // real work, but telling the SW is polite (e.g. it might have in-flight
  // cache.put() calls that would re-create entries).
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage('CLEAR_CACHES')
    } catch {
      /* swallow */
    }
  }

  // 2. IndexedDB offline response cache + pending write queue.
  try {
    const { clearOfflineCache } = await import('./offline-queue')
    if (typeof clearOfflineCache === 'function') {
      await clearOfflineCache()
    }
  } catch {
    /* swallow — offline-queue may not be loaded yet */
  }

  // 3. In-flight API request dedupe map.
  try {
    const { clearApiCache } = await import('./api-cache')
    if (typeof clearApiCache === 'function') {
      clearApiCache()
    }
  } catch {
    /* swallow */
  }
}
