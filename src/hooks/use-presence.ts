'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { useAppStore } from '@/lib/store'
import type { UserRole } from '@/lib/types'
import { getSocketUrl } from '@/lib/socket-env'

// ============================================================
// Real-time presence via socket.io
// ------------------------------------------------------------
// The presence mini-service runs on port 3003. In the cloud
// sandbox it is reached through the Caddy gateway
// (?XTransformPort=3003); in a local dev environment (VSCode)
// the browser connects directly to http://localhost:3003. The
// URL is chosen automatically by `getSocketUrl()` based on the
// browser's hostname.
//
// Every authenticated user reports their presence; admins /
// super_admins additionally subscribe to the live presence feed
// so the "Utilisateurs connectés" module updates instantly.
// ============================================================

export interface PresenceUser {
  userId: string
  name: string
  email: string
  role: UserRole | string
  userCode: string | null
  institutionId: string | null
  institutionName: string | null
  avatar: string | null
  connectedAt: number
  lastSeen: number
}

export interface PresenceSnapshot {
  users: PresenceUser[]
  total: number
  byRole: Record<string, number>
}

const PRESENCE_PORT = 3003
const HEARTBEAT_INTERVAL_MS = 20_000 // client pings every 20s (server timeout 60s)

let socketPromise: Promise<Socket | null> | null = null

async function getSocket(): Promise<Socket | null> {
  if (typeof window === 'undefined') return null
  if (socketPromise) return socketPromise
  socketPromise = (async () => {
    try {
      const { io } = await import('socket.io-client')
      const url = getSocketUrl(PRESENCE_PORT)
      const sock = io(url, {
        transports: ['websocket', 'polling'],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 15_000,
        timeout: 8_000,
      })
      return sock
    } catch (err) {
      console.error('[presence] failed to load socket.io-client', err)
      return null
    }
  })()
  return socketPromise
}

interface UsePresenceOptions {
  // If true, subscribe to the live presence feed (admin / super_admin only)
  subscribe?: boolean
}

export function usePresence(options: UsePresenceOptions = {}) {
  const { subscribe = false } = options
  const currentUser = useAppStore((s) => s.currentUser)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const activeInstitutionId = useAppStore((s) => s.activeInstitutionId)
  const activeInstitutionName = useAppStore((s) => s.activeInstitutionName)

  const [snapshot, setSnapshot] = useState<PresenceSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const joinedRef = useRef(false)
  const subscribedRef = useRef(false)

  // ---- 1. Connect + join (every authenticated user) ----
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return
    let cancelled = false

    getSocket().then((sock) => {
      if (cancelled || !sock) return
      socketRef.current = sock

      // ---- Register ALL listeners FIRST (before any emit) ----
      // The presence:update listener MUST be registered before we emit
      // presence:subscribe, otherwise the immediate snapshot the server
      // sends in response to subscribe would be missed.
      const onUpdate = (data: PresenceSnapshot) => {
        setSnapshot(data)
      }
      if (subscribe) {
        sock.on('presence:update', onUpdate)
      }

      const onDisconnect = () => {
        setConnected(false)
      }
      sock.on('disconnect', onDisconnect)

      const onConnect = () => {
        setConnected(true)
        // Build the presence payload. Super admins browsing an institution
        // still report their real role so admins across the system are
        // visible to the super admin view.
        const institutionId =
          currentUser.role === 'super_admin'
            ? activeInstitutionId || null
            : currentUser.institutionId || null
        const institutionName =
          currentUser.role === 'super_admin'
            ? activeInstitutionName || null
            : (currentUser as { institutionName?: string | null }).institutionName || null

        sock.emit('presence:join', {
          user: {
            userId: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            role: currentUser.role,
            userCode: currentUser.userCode || null,
            institutionId,
            institutionName,
            avatar: currentUser.avatar || null,
          },
        })
        joinedRef.current = true
        // (Re)assert subscription if this component wanted it. The
        // presence:update listener is already registered above, so the
        // immediate snapshot response will be caught.
        if (subscribe && !subscribedRef.current) {
          sock.emit('presence:subscribe')
          subscribedRef.current = true
        }
      }

      if (sock.connected) {
        onConnect()
      } else {
        sock.on('connect', onConnect)
      }

      // ---- Heartbeat ----
      const hb = setInterval(() => {
        if (sock.connected) {
          sock.emit('presence:heartbeat')
        }
      }, HEARTBEAT_INTERVAL_MS)

      // cleanup for this effect run
      return () => {
        clearInterval(hb)
        sock.off('connect', onConnect)
        sock.off('disconnect', onDisconnect)
        if (subscribe) sock.off('presence:update', onUpdate)
      }
    })

    return () => {
      cancelled = true
      // Only emit presence:leave when the user has actually logged out.
      // If they just navigated between modules (so this hook instance is
      // unmounting but the RealtimePresenceProvider's hook is still alive),
      // we must NOT emit leave — the user is still online.
      const stillAuthenticated = useAppStore.getState().isAuthenticated
      if (!stillAuthenticated) {
        const sock = socketRef.current
        if (sock && joinedRef.current) {
          try {
            sock.emit('presence:leave')
          } catch {
            /* ignore */
          }
        }
      }
      joinedRef.current = false
      if (subscribe) subscribedRef.current = false
    }
  }, [
    isAuthenticated,
    currentUser?.id,
    currentUser?.role,
    activeInstitutionId,
    activeInstitutionName,
    subscribe,
  ])

  // ---- 2. On explicit logout, emit leave + drop subscription ----
  // We piggy-back on isAuthenticated: when it flips false, clean up.
  // The leave emission + ref resets happen in a microtask to avoid
  // calling setState synchronously inside the effect body.
  useEffect(() => {
    if (isAuthenticated) return
    const sock = socketRef.current
    if (sock && joinedRef.current) {
      try {
        sock.emit('presence:leave')
      } catch {
        /* ignore */
      }
    }
    joinedRef.current = false
    subscribedRef.current = false
    // Defer the state reset to break the synchronous setState-in-effect chain
    queueMicrotask(() => setSnapshot(null))
  }, [isAuthenticated])

  // ---- 3. beforeunload: best-effort leave ----
  useEffect(() => {
    function onBeforeUnload() {
      const sock = socketRef.current
      if (sock && joinedRef.current) {
        try {
          sock.emit('presence:leave')
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const refresh = useCallback(() => {
    const sock = socketRef.current
    if (sock && sock.connected && subscribe) {
      sock.emit('presence:subscribe') // server responds with an immediate snapshot
    }
  }, [subscribe])

  return { snapshot, connected, refresh }
}
