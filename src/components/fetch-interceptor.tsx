'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import {
  bootstrapOfflineQueue,
  cacheGetResponse,
  cachePutResponse,
  enqueueRequest,
  isApiUrl,
  isQueuedMethod,
} from '@/lib/offline-queue'

/**
 * Patches the global fetch to:
 *  1. Inject institution/school-year auth headers on every /api/* call.
 *  2. Cache successful GET responses in IndexedDB (offline reads).
 *  3. When offline, queue write requests (POST/PUT/PATCH/DELETE) and
 *     return a synthetic 202 so the UI keeps working.
 *
 * When the connection comes back, the queue is flushed automatically
 * (see bootstrapOfflineQueue in @/lib/offline-queue).
 */

// Module-level flag to ensure the patch is applied only once.
let _patchApplied = false

if (typeof window !== 'undefined' && !(window as unknown as { __fetchPatched?: boolean }).__fetchPatched) {
  const originalFetch = window.fetch
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : 'url' in input ? input.url : ''
    const isApi = url.startsWith('/api/') || url.includes('/api/')
    const method = (init?.method || 'GET').toUpperCase()

    // ---- 1. Inject auth headers for /api/* calls ----
    if (isApi) {
      const existingHeaders = init?.headers as Record<string, string> | undefined
      const mergedHeaders: Record<string, string> = {}

      if (existingHeaders) {
        if (existingHeaders instanceof Headers) {
          existingHeaders.forEach((value, key) => { mergedHeaders[key] = value })
        } else {
          Object.assign(mergedHeaders, existingHeaders)
        }
      }

      const state = useAppStore.getState()
      const currentUser = state.currentUser
      const activeInstitutionId = state.activeInstitutionId
      const schoolYear = state.schoolYear

      const institutionId = activeInstitutionId || currentUser?.institutionId || ''
      const userId = currentUser?.id || ''
      const role = currentUser?.role || ''

      if (!('x-user-id' in mergedHeaders) && userId) mergedHeaders['x-user-id'] = userId
      if (!('x-institution-id' in mergedHeaders) && institutionId) mergedHeaders['x-institution-id'] = institutionId
      if (!('x-user-role' in mergedHeaders) && role) mergedHeaders['x-user-role'] = role
      if (!('x-super-admin-id' in mergedHeaders) && role === 'super_admin' && userId) {
        mergedHeaders['x-super-admin-id'] = userId
      }
      if (!('x-school-year' in mergedHeaders) && schoolYear) mergedHeaders['x-school-year'] = schoolYear

      init = { ...init, headers: mergedHeaders }
    }

    // ---- 2. Offline handling ----
    // Skip offline interception for non-API URLs (let SW handle them) and
    // for the login endpoint (auth must hit the server, no offline login).
    const skipOffline =
      !isApi ||
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/signup') ||
      url.includes('/api/auth/me') ||
      url.includes('/api/auth/profile') ||
      url.includes('/api/seed') ||
      url.includes('/api/ensure-superadmin') ||
      url.includes('/api/super-admin/login') ||
      url.includes('/api/super-admin/ensure') ||
      url.includes('/api/superadmin/login') ||
      url.includes('/api/superadmin/ensure') ||
      url.includes('/api/heartbeat') ||
      url.includes('/api/dashboard')

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

    if (isApi && !skipOffline) {
      // ---- Write requests when offline -> queue ----
      if (isQueuedMethod(method) && !isOnline) {
        const headers = (init?.headers as Record<string, string>) || {}
        const body = typeof init?.body === 'string' ? init.body : init?.body ? String(init.body) : null
        // Tag the resource for the UI badge
        const resource = guessResource(url)
        return enqueueRequest(method, url, headers, body, resource)
      }

      // ---- GET requests: try network, fall back to cache ----
      if (method === 'GET') {
        try {
          const res = await originalFetch.call(this, input, init)
          if (res.ok) {
            // Cache a clone (non-streaming responses only)
            void cachePutResponse(url, res.clone())
          }
          return res
        } catch (err) {
          // Network failed — try the offline cache
          const cached = await cacheGetResponse(url)
          if (cached) {
            // Tag the response so the UI knows it's stale
            const headers = new Headers(cached.headers)
            headers.set('X-Masomo-Offline-Cache', '1')
            return new Response(cached.body, {
              status: cached.status,
              statusText: cached.statusText,
              headers,
            })
          }
          throw err
        }
      }
    }

    return originalFetch.call(this, input, init)
  }
  ;(window as unknown as { __fetchPatched?: boolean }).__fetchPatched = true
  _patchApplied = true
}

/** Best-effort guess of the resource name from a URL, for the queue badge. */
function guessResource(url: string): string | undefined {
  const m = url.match(/\/api\/([a-z][a-z0-9-]*)/i)
  return m ? m[1] : undefined
}

export function FetchInterceptor({ children }: { children: React.ReactNode }) {
  const currentUser = useAppStore((s) => s.currentUser)
  const activeInstitutionId = useAppStore((s) => s.activeInstitutionId)
  const schoolYear = useAppStore((s) => s.schoolYear)

  // Bootstrap the offline queue flusher on mount.
  useEffect(() => {
    const cleanup = bootstrapOfflineQueue()
    return cleanup
  }, [])

  useEffect(() => {
    // The patched fetch reads the latest values via useAppStore.getState().
    // This effect's deps ensure re-renders propagate when auth changes.
  }, [currentUser?.id, currentUser?.institutionId, currentUser?.role, activeInstitutionId, schoolYear])

  void _patchApplied

  return <>{children}</>
}
