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
 */
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes

export function useHeartbeat() {
  const currentUser = useAppStore((s) => s.currentUser)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return

    const sendHeartbeat = async () => {
      // Skip when tab is hidden to avoid creating stale "online" sessions
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }
      try {
        await fetch('/api/heartbeat', { method: 'POST' })
      } catch {
        // Silent failure — heartbeat is best-effort
      }
    }

    // Send immediately on mount / user change
    sendHeartbeat()

    // Then on a fixed interval
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

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
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility)
      }
    }
  }, [isAuthenticated, currentUser?.id])
}
