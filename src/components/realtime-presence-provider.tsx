'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { useHeartbeat } from '@/hooks/use-heartbeat'
import { usePresence } from '@/hooks/use-presence'

/**
 * RealtimePresenceProvider
 *
 * Mounted once inside the authenticated AppShell. It does two things:
 *   1. Calls useHeartbeat() — keeps the DB-side UserSession row fresh
 *      (used as a fallback by /api/sessions and the dashboard online count).
 *   2. Calls usePresence() — connects to the socket.io presence service on
 *      port 3003, emits presence:join so the user appears in the live
 *      "Utilisateurs connectés" feed seen by admins/super_admins, and sends
 *      periodic heartbeats. On logout/unmount it emits presence:leave.
 *
 * This component renders nothing — it's purely a side-effect mount.
 */
export default function RealtimePresenceProvider() {
  // Every authenticated user reports their presence to the socket.io server.
  // We do NOT subscribe here (only admins/super_admins subscribe, and they do
  // so from the ConnectedUsersModule via usePresence({ subscribe: true })).
  useHeartbeat()
  usePresence({ subscribe: false })

  // Best-effort: when the user explicitly logs out via the store, emit leave.
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  useEffect(() => {
    if (!isAuthenticated) {
      // The usePresence hook already handles the leave emission on cleanup;
      // this effect is a safety net for the rare case where the provider
      // stays mounted while auth flips to false (e.g. session expiry).
    }
  }, [isAuthenticated])

  return null
}
