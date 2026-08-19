// ============================================================================
// MASOMO Service Worker v2
//
// Enables PWA installability + offline support across all platforms
// (Windows, macOS, Linux, Android, iOS via Safari).
//
// Caching strategy:
//   - Navigation (HTML):      network-first → cache fallback → offline page
//   - Static assets (JS/CSS): cache-first → network (runtime cache)
//   - Images/fonts:            cache-first → network (runtime cache)
//   - API GET:                 network-first → cache fallback (stale-while-revalidate)
//   - API POST/PUT/DELETE:     bypass (handled by the offline write-behind queue)
// ============================================================================

const CACHE_VERSION = 'masomo-v2'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`
const API_CACHE = `${CACHE_VERSION}-api`

// Critical assets pre-cached on install (app shell).
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.ico',
]

// Maximum number of entries in the runtime cache (LRU eviction).
const RUNTIME_CACHE_LIMIT = 100

// URLs that should NEVER be cached.
// Includes ALL user-specific API endpoints — these return different data
// depending on the x-user-id / x-institution-id headers, so caching them
// by URL alone would leak one user's data to another after a logout/login
// (stale-while-revalidate returns the previous user's cached response
// immediately, overwriting the new user in the store).
const NEVER_CACHE = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/profile',
  '/api/super-admin/login',
  '/api/heartbeat',
  '/api/dashboard',
  '/api/messages',
  '/api/notifications',
  '/api/school-years',
  '/api/sessions',
  '/api/super-admin/profile',
]

// ---- Install: pre-cache the app shell ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // addAll is atomic — if any URL fails, none are cached. We use add()
      // individually so a single failed fetch (e.g. favicon in dev) doesn't
      // break the whole install.
      return Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url))
      )
    })
  )
  self.skipWaiting()
})

// ---- Activate: clean up old caches (including legacy 'edugest-v1' & 'masomo-v1') ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !name.startsWith(CACHE_VERSION))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    }).then(() => self.clients.claim())
  )
})

// ---- Helper: trim a cache to N entries (LRU by last-accessed order) ----
async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length <= limit) return
  // Delete oldest entries (first in, first out — close enough to LRU for our needs)
  const toDelete = keys.slice(0, keys.length - limit)
  await Promise.all(toDelete.map((key) => cache.delete(key)))
}

// ---- Helper: is this URL in the never-cache list? ----
function shouldNeverCache(url) {
  return NEVER_CACHE.some((path) => url.includes(path))
}

// ---- Fetch handler ----
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests.
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (shouldNeverCache(url.pathname)) return

  // ---- 1. Navigation requests (HTML pages): network-first ----
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, cloned))
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          // Fallback to cached root (app shell) — this lets the SPA boot offline
          const root = await caches.match('/')
          if (root) return root
          // Last resort: a simple offline message
          return new Response(
            '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>MASOMO — Hors ligne</title></head><body style="font-family:system-ui;background:#0d1a1a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:2rem"><div><h1 style="color:#10b981">MASOMO</h1><p>Vous êtes hors ligne. Reconnectez-vous pour continuer.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200 }
          )
        })
    )
    return
  }

  // ---- 2. API requests: ALWAYS pass-through (NEVER cache) ----
  // All /api/* endpoints are user-specific (filtered by x-user-id /
  // x-institution-id headers). Caching them by URL alone — even with
  // stale-while-revalidate — leaks one user's data to another after a
  // logout/login cycle. The previous user's cached /api/auth/profile
  // would be served immediately to the new user, overwriting the store.
  //
  // We therefore bypass the SW entirely for /api/ requests: just fetch
  // from the network. If the network fails, return a 504 so the app's
  // own error handling (offline-queue, retry, etc.) kicks in.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response('', { status: 504 }))
    )
    return
  }

  // ---- 3. Static assets (JS, CSS, images, fonts): cache-first ----
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|ico|woff2?|ttf|eot|wasm)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        try {
          const response = await fetch(request)
          if (response.ok) {
            cache.put(request, response.clone())
            trimCache(RUNTIME_CACHE, RUNTIME_CACHE_LIMIT)
          }
          return response
        } catch {
          // No cache, no network — return nothing (the page will handle the broken asset)
          return new Response('', { status: 504 })
        }
      })
    )
    return
  }
})

// ---- Message handler: allow the page to trigger skipWaiting or clear caches ----
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  // Clear ALL caches (static, runtime, API + any legacy ones). Sent by the
  // page on login and logout so a new user never sees the previous user's
  // cached API responses (which are user-specific and keyed by URL alone).
  if (event.data === 'CLEAR_CACHES') {
    caches.keys().then((names) => {
      Promise.all(names.map((name) => caches.delete(name))).then(() => {
        console.log('[SW] All caches cleared (login/logout):', names.join(', '))
      }).catch(() => {})
    }).catch(() => {})
  }
})
