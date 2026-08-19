// ============================================================
// MASOMO — Offline-first request queue (write-behind)
// ------------------------------------------------------------
// When the user is offline (or the server is unreachable), POST/PUT/DELETE
// requests to /api/* are captured and stored in IndexedDB. The original
// Response that the caller sees is a synthetic 202 "queued locally" so the
// UI keeps working: optimistic updates succeed and the user can keep
// browsing/creating records without any error toast.
//
// When the connection comes back (online event OR periodic retry), the
// queue is flushed in FIFO order. Successful flushes fire a
// `masomo:queue-flushed` event so module components can refetch the
// affected endpoints and reconcile the local state with the server.
//
// Reads (GET) are NEVER queued — they go to the network, and on failure
// fall back to the in-memory cache maintained by `useOfflineCache`.
// ============================================================

const DB_NAME = 'masomo-offline'
const STORE = 'queue'
const CACHE_STORE = 'responses'
const DB_VERSION = 1

// ---- IndexedDB helpers (promise-wrapped) ----

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface QueuedRequest {
  id: string
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
  queuedAt: number
  // Optional tag so the UI can show "X enregistrement(s) en attente"
  resource?: string
}

let _queueCache: QueuedRequest[] | null = null

async function getAllQueued(): Promise<QueuedRequest[]> {
  if (_queueCache) return _queueCache
  try {
    const db = await openDB()
    return await new Promise<QueuedRequest[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const req = store.getAll()
      req.onsuccess = () => {
        const items = (req.result as QueuedRequest[]).sort(
          (a, b) => a.queuedAt - b.queuedAt
        )
        _queueCache = items
        resolve(items)
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

async function putQueued(item: QueuedRequest): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    if (_queueCache) _queueCache.push(item)
  } catch {
    /* swallow — the queue is best-effort */
  }
}

async function deleteQueued(id: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    if (_queueCache) _queueCache = _queueCache.filter((q) => q.id !== id)
  } catch {
    /* swallow */
  }
}

// ---- Public API ----

let counter = 0
function genId(): string {
  counter += 1
  return `req-${Date.now()}-${counter}`
}

export function isQueuedMethod(method: string): boolean {
  const m = method.toUpperCase()
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE'
}

export function isApiUrl(url: string): boolean {
  return url.startsWith('/api/') || url.includes('/api/')
}

/** Queue a write request for later flush. Returns a synthetic 202 response. */
export async function enqueueRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string | null,
  resource?: string
): Promise<Response> {
  const item: QueuedRequest = {
    id: genId(),
    method: method.toUpperCase(),
    url,
    headers,
    body,
    queuedAt: Date.now(),
    resource,
  }
  await putQueued(item)
  notifyQueueChange()
  // Synthetic 202 response — callers should treat this as "accepted, deferred"
  return new Response(
    JSON.stringify({
      queued: true,
      offline: true,
      message: 'Enregistré localement — sera synchronisé dès le retour de la connexion.',
      id: item.id,
    }),
    {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/** Returns the current pending queue (cached in memory). */
export async function getPendingQueue(): Promise<QueuedRequest[]> {
  return getAllQueued()
}

/** Try to flush all queued requests. Returns the number of successful flushes. */
export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  const items = await getAllQueued()
  if (items.length === 0) return { ok: 0, failed: 0 }

  let ok = 0
  let failed = 0
  // Sequential flush to preserve ordering
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      })
      if (res.ok || res.status === 409) {
        await deleteQueued(item.id)
        ok += 1
      } else if (res.status >= 400 && res.status < 500 && res.status !== 408) {
        // 4xx (except 408 timeout) — the request itself is bad; drop it to
        // avoid an infinite retry loop. Log to console for debugging.
        console.warn('[masomo:queue] Dropping bad request', item.url, res.status)
        await deleteQueued(item.id)
        failed += 1
      } else {
        // 5xx or network error — leave in queue, retry later
        failed += 1
        break
      }
    } catch {
      // Network error — stop flushing; will retry on next online event
      failed += 1
      break
    }
  }

  if (ok > 0) {
    // Notify the app that data changed so components can refetch.
    window.dispatchEvent(new CustomEvent('masomo:queue-flushed', { detail: { ok, failed } }))
  }
  notifyQueueChange()
  return { ok, failed }
}

// ---- Queue change event (for UI badge) ----

let notifyTimer: ReturnType<typeof setTimeout> | null = null
function notifyQueueChange(): void {
  if (notifyTimer) clearTimeout(notifyTimer)
  notifyTimer = setTimeout(() => {
    window.dispatchEvent(new CustomEvent('masomo:queue-changed'))
  }, 50)
}

// ---- GET response cache (for offline reads) ----

export async function cacheGetResponse(url: string): Promise<Response | null> {
  try {
    const db = await openDB()
    return await new Promise<Response | null>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly')
      const req = tx.objectStore(CACHE_STORE).get(url)
      req.onsuccess = () => {
        const row = req.result as
          | { key: string; status: number; headers: [string, string][]; body: string; ts: number }
          | undefined
        if (!row) {
          resolve(null)
          return
        }
        resolve(
          new Response(row.body, {
            status: row.status,
            headers: row.headers,
          })
        )
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function cachePutResponse(url: string, res: Response): Promise<void> {
  try {
    const body = await res.clone().text()
    const headers: [string, string][] = []
    res.headers.forEach((v, k) => headers.push([k, v]))
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite')
      tx.objectStore(CACHE_STORE).put({
        key: url,
        status: res.status,
        headers,
        body,
        ts: Date.now(),
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* swallow — cache failures are non-fatal */
  }
}

// ---- Auto-flush trigger (call once on app boot) ----

let _bootstrapped = false
export function bootstrapOfflineQueue(): () => void {
  if (_bootstrapped) return () => {}
  _bootstrapped = true

  const onOnline = () => {
    flushQueue().catch(() => {})
  }
  window.addEventListener('online', onOnline)

  // Periodic retry every 30s while online (in case the online event
  // fired before the queue was populated, or a previous flush failed).
  const interval = setInterval(() => {
    if (navigator.onLine) {
      flushQueue().catch(() => {})
    }
  }, 30_000)

  // Try once on boot (in case we boot up online with a stale queue)
  setTimeout(() => {
    if (navigator.onLine) flushQueue().catch(() => {})
  }, 2000)

  return () => {
    window.removeEventListener('online', onOnline)
    clearInterval(interval)
  }
}

/**
 * Clear the offline response cache (IndexedDB 'responses' store) and the
 * pending write queue. Called on login/logout so a new user never sees the
 * previous user's cached GET responses (which are user-specific and keyed
 * by URL alone — same problem as the Service Worker API cache).
 */
export async function clearOfflineCache(): Promise<void> {
  try {
    const db = await openDB()
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readwrite')
        tx.objectStore(CACHE_STORE).clear()
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).clear()
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
    ])
  } catch {
    /* swallow — cache clearing is best-effort */
  }
}
