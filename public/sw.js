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

const CACHE_VERSION = 'masomo-v3'
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
// All auth endpoints + any endpoint that returns user-specific data.
// Without this, the SW serves stale admin data to a student who logs
// in after the admin on the same device (the cache key is the URL alone,
// ignoring auth headers — so /api/auth/profile cached for the admin is
// served to the student).
const NEVER_CACHE = [
  '/api/auth/',
  '/api/super-admin/login',
  '/api/super-admin/ensure',
  '/api/superadmin/login',
  '/api/superadmin/ensure',
  '/api/heartbeat',
  '/api/dashboard',
  '/api/ensure-superadmin',
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

  // ---- 2. API GET requests: stale-while-revalidate ----
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        // Fetch in the background to update the cache (revalidate)
        const fetchPromise = fetch(request)
          .then((response) => {
            // Only cache successful responses
            if (response.ok) {
              cache.put(request, response.clone())
            }
            return response
          })
          .catch(() => cached) // network failed, return cached if available
        // Return cached immediately if available, otherwise wait for network
        return cached || fetchPromise
      })
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

// ---- Message handler ----
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  // Clear the API cache on login/logout so that user-specific
  // responses (dashboard, profile, notifications…) from a previous
  // session are never served to a different user.
  if (event.data === 'CLEAR_API_CACHE') {
    caches.delete(API_CACHE).then(() => {
      console.log('[SW] API cache cleared on login/logout')
    })
  }
})
