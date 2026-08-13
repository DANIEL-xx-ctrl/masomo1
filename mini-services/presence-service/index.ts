// ============================================================
// EduGest Presence Service
// ------------------------------------------------------------
// Socket.io server that tracks connected users in real time.
//
// Port: 3003 (forwarded by Caddy via ?XTransformPort=3003)
//
// Events (client -> server):
//   presence:join      { user: PresenceUser }    -- sent on login / page load
//   presence:heartbeat                          -- periodic ping (every ~20s)
//   presence:leave                              -- sent on logout
//   presence:subscribe                          -- admin/super_admin asks to receive updates
//   presence:unsubscribe                        -- stop receiving updates
//
// Events (server -> client):
//   presence:update    { users: PresenceUser[], total: number, byRole: Record<string, number> }
//   presence:welcome   { message: string }
//
// A user is considered "connected" as long as their socket is open AND they
// have sent a heartbeat in the last PRESENCE_TIMEOUT_MS (60s). Stale entries
// are reaped every 15s by the janitor interval.
// ============================================================

import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3003
const HEARTBEAT_TIMEOUT_MS = 60_000       // drop a user if no heartbeat for 60s
const JANITOR_INTERVAL_MS = 15_000        // run cleanup every 15s
const ADMIN_ROLES = new Set(['admin', 'super_admin'])

interface PresenceUser {
  userId: string
  name: string
  email: string
  role: string
  userCode: string | null
  institutionId: string | null
  institutionName: string | null
  avatar: string | null
  connectedAt: number
  lastSeen: number
}

// socket.id -> { user, subscribed }
interface SocketState {
  user: PresenceUser | null
  subscribed: boolean
}

const sockets = new Map<string, SocketState>()
// userId -> PresenceUser (latest entry wins; a user with 2 tabs counts once)
const presenceByUser = new Map<string, PresenceUser>()

function buildUpdate() {
  const users = Array.from(presenceByUser.values())
  const byRole: Record<string, number> = {}
  for (const u of users) {
    byRole[u.role] = (byRole[u.role] || 0) + 1
  }
  return { users, total: users.length, byRole }
}

function broadcastUpdate() {
  const payload = buildUpdate()
  // Only push to subscribed admin sockets
  for (const [sid, state] of sockets.entries()) {
    if (state.subscribed && state.user && ADMIN_ROLES.has(state.user.role)) {
      io.to(sid).emit('presence:update', payload)
    }
  }
}

function removeSocket(sid: string) {
  const state = sockets.get(sid)
  if (!state) return
  sockets.delete(sid)

  // Only remove the user from presence if no other socket still holds them
  if (state.user) {
    const stillConnected = Array.from(sockets.values()).some(
      (s) => s.user?.userId === state.user!.userId
    )
    if (!stillConnected) {
      presenceByUser.delete(state.user.userId)
      broadcastUpdate()
    }
  }
}

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60_000,
  pingInterval: 25_000,
})

io.on('connection', (socket) => {
  console.log(`[presence] socket connected: ${socket.id}`)
  sockets.set(socket.id, { user: null, subscribed: false })

  socket.emit('presence:welcome', { message: 'EduGest presence service ready' })

  socket.on('presence:join', (data: { user: Omit<PresenceUser, 'connectedAt' | 'lastSeen'> }) => {
    try {
      if (!data?.user?.userId) return
      const now = Date.now()
      const user: PresenceUser = {
        ...data.user,
        connectedAt: now,
        lastSeen: now,
      }
      const state = sockets.get(socket.id)
      if (!state) return
      state.user = user
      presenceByUser.set(user.userId, user)
      console.log(`[presence] join: ${user.name} (${user.role}) — online=${presenceByUser.size}`)
      broadcastUpdate()
    } catch (err) {
      console.error('[presence] join error:', err)
    }
  })

  socket.on('presence:heartbeat', () => {
    const state = sockets.get(socket.id)
    if (!state?.user) return
    const now = Date.now()
    state.user.lastSeen = now
    // Refresh the canonical map entry too
    const existing = presenceByUser.get(state.user.userId)
    if (existing) {
      existing.lastSeen = now
    }
  })

  socket.on('presence:leave', () => {
    const state = sockets.get(socket.id)
    if (state?.user) {
      console.log(`[presence] leave: ${state.user.name}`)
    }
    removeSocket(socket.id)
  })

  socket.on('presence:subscribe', () => {
    const state = sockets.get(socket.id)
    if (!state) return
    // Only admins/super_admins may subscribe to the live presence feed
    if (state.user && ADMIN_ROLES.has(state.user.role)) {
      state.subscribed = true
      // Send an immediate snapshot
      socket.emit('presence:update', buildUpdate())
    }
  })

  socket.on('presence:unsubscribe', () => {
    const state = sockets.get(socket.id)
    if (!state) return
    state.subscribed = false
  })

  socket.on('disconnect', () => {
    console.log(`[presence] socket disconnected: ${socket.id}`)
    removeSocket(socket.id)
  })

  socket.on('error', (err) => {
    console.error(`[presence] socket error (${socket.id}):`, err)
  })
})

// Janitor: drop stale users (no heartbeat in HEARTBEAT_TIMEOUT_MS)
const janitor = setInterval(() => {
  const now = Date.now()
  let changed = false
  for (const [uid, user] of presenceByUser.entries()) {
    if (now - user.lastSeen > HEARTBEAT_TIMEOUT_MS) {
      presenceByUser.delete(uid)
      // Also clear any socket state pointing at this user
      for (const [sid, state] of sockets.entries()) {
        if (state.user?.userId === uid) {
          state.user = null
        }
      }
      changed = true
      console.log(`[presence] reaped stale user: ${uid}`)
    }
  }
  if (changed) broadcastUpdate()
}, JANITOR_INTERVAL_MS)

httpServer.listen(PORT, () => {
  console.log(`[presence] EduGest presence service running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[presence] SIGTERM received, shutting down...')
  clearInterval(janitor)
  io.close(() => {
    httpServer.close(() => process.exit(0))
  })
})

process.on('SIGINT', () => {
  console.log('[presence] SIGINT received, shutting down...')
  clearInterval(janitor)
  io.close(() => {
    httpServer.close(() => process.exit(0))
  })
})
