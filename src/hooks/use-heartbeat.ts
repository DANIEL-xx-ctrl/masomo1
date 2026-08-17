'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'

/**
 * useHeartbeat
 *
 * Sends a POST /api/heartbeat every 2 minutes while the user is authenticated.
 * This allows the dashboard to count "online users" via the UserSession table
 * (rows with updatedAt within the last 5 minutes are considered online).
 *
 * Also sends an immediate heartbeat on mount and whenever the user changes.
 * The heartbeat is skipped if:
 *   - the user is not authenticated
 *   - the document is hidden (browser tab in background) — we resume on visibility change
 *
 * FIX (migration SQLite → PostgreSQL) :
 * On envoie l'en-tête `x-user-id` pour que l'API puisse valider le userId.
 * Si l'API répond 401 (userId stale / session expirée), on nettoie le
 * localStorage et on déconnecte l'utilisateur pour éviter une boucle d'erreurs.
 *
 * FIX (Vercel ResourceExhausted) :
 * We keep the latest currentUser + logout in refs so the effect runs only
 * ONCE per user id (not on every store update). Previously, every profile
 * refresh / avatar change recreated the effect, immediately fired a new
 * POST /api/heartbeat, and contributed to the concurrency-threshold error.
 */
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes

export function useHeartbeat() {
  const currentUser = useAppStore((s) => s.currentUser)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const logout = useAppStore((s) => s.logout)

  // Keep latest values in refs so the effect body can read them without
  // depending on them (which would cause the effect to re-run on every
  // store update and re-fire the heartbeat).
  const userRef = useRef(currentUser)
  const logoutRef = useRef(logout)
  useEffect(() => {
    userRef.current = currentUser
  }, [currentUser])
  useEffect(() => {
    logoutRef.current = logout
  }, [logout])

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return

    const sendHeartbeat = async () => {
      // Skip when tab is hidden to avoid creating stale "online" sessions
      // and to avoid spawning serverless invocations for a hidden tab.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }
      const user = userRef.current || currentUser
      if (!user?.id) return
      try {
        const res = await fetch('/api/heartbeat', {
          method: 'POST',
          headers: {
            'x-user-id': user.id,
            'x-user-role': user.role || '',
          },
        })
        // 401 = userId stale (ancien ID SQLite resté dans localStorage après
        // la migration PostgreSQL) ou session expirée. On déconnecte proprement.
        if (res.status === 401) {
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('masomo-user')
              localStorage.removeItem('masomo-auth')
              localStorage.removeItem('currentUser')
            } catch {}
          }
          const fn = logoutRef.current || logout
          if (typeof fn === 'function') fn()
          if (typeof window !== 'undefined') {
            window.location.href = '/'
          }
          return
        }
      } catch {
        // Silent failure — heartbeat is best-effort
      }
    }

    // Send immediately on mount / user change
    sendHeartbeat()

    // Then on a fixed interval
    const intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    // Resume heartbeat when the tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat()
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility)
    }

    return () => {
      clearInterval(intervalId)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility)
      }
    }
    // Intentionally only depend on the user ID + auth flag so the effect
    // doesn't re-run on every store update (which would reset the interval
    // and immediately re-fire a heartbeat).
  }, [isAuthenticated, currentUser?.id])
}
