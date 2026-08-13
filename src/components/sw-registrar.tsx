'use client'

import { useEffect } from 'react'

// ============================================================================
// ServiceWorkerRegistrar
//
// Registers the MASOMO service worker (public/sw.js) so the app becomes a
// fully installable PWA on Windows, macOS, Linux, Android and iOS.
//
// IMPORTANT — iframe guard:
//   In the cloud-sandbox preview iframe, a registered service worker causes
//   stale-cache "took too long to respond" errors. We therefore SKIP
//   registration when running inside an iframe (window.top !== window.self),
//   and unregister any existing SW in that case.
//
//   In a real browser tab (top-level navigation), the SW is registered
//   normally → enables install prompt, offline cache, push notifications, etc.
// ============================================================================
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const inIframe = (() => {
      try {
        return window.self !== window.top
      } catch {
        return true
      }
    })()

    if (inIframe) {
      // Preview sandbox — unregister any stale SW to prevent cache issues
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().then(() => {
            console.log('[SW] Unregistered stale service worker (iframe mode)')
          })
        })
      }).catch(() => {})
      return
    }

    // Top-level tab — register the SW for full PWA support
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW] Registered with scope:', registration.scope)
        // Check for updates every hour
        setInterval(() => {
          registration.update().catch(() => {})
        }, 60 * 60 * 1000)
      })
      .catch((error) => {
        console.warn('[SW] Registration failed:', error)
      })

    // Listen for updates and notify the page
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] Controller changed — new version active')
    })
  }, [])

  return null
}
