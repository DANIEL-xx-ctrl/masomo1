// ============================================================
// EduGest Chat Service — Real-time 1:1 messaging
// ------------------------------------------------------------
// Socket.io server that broadcasts direct messages between
// users the instant they are created.
//
// Port: 3004 (forwarded by Caddy via ?XTransformPort=3004)
//
// Events (client -> server):
//   chat:join      { userId, name, role, avatar }          -- register identity
//   chat:message   { message: ChatMessagePayload }          -- broadcast a new message
//   chat:typing    { toUserId, fromUserId, isTyping }       -- typing indicator
//   chat:read      { messageIds: string[], fromUserId }     -- mark messages read
//
// Events (server -> client):
//   chat:welcome    { message: string }
//   chat:message    { message: ChatMessagePayload }         -- delivered to recipient's socket(s)
//   chat:typing     { fromUserId, isTyping }
//   chat:read       { messageIds, fromUserId }
//
// The chat service is stateless re: persistence — the Next.js
// /api/messages routes remain the source of truth (Prisma +
// SQLite). This service only relays the new/updated message to
// any socket owned by the recipient (and echoes to the sender's
// other tabs) so the UI updates without polling.
// ============================================================

import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3004

interface ChatUser {
  userId: string
  name: string
  role: string
  avatar: string | null
}

interface ChatMessagePayload {
  id: string
  senderId: string
  receiverId: string
  content: string
  read: boolean
  schoolYear: string
  createdAt: string
  attachmentUrl?: string | null
  attachmentType?: string | null // "image" | "video" | "audio" | "file"
  attachmentName?: string | null
  attachmentSize?: number | null
  sender?: { id: string; name: string; email: string | null; role: string; avatar?: string | null; userCode?: string | null }
  receiver?: { id: string; name: string; email: string | null; role: string; avatar?: string | null; userCode?: string | null }
}

interface SocketState {
  user: ChatUser | null
}

// socket.id -> state
const sockets = new Map<string, SocketState>()
// userId -> Set<socket.id>  (a user may have multiple tabs open)
const socketsByUser = new Map<string, Set<string>>()

function linkSocket(userId: string, socketId: string) {
  let set = socketsByUser.get(userId)
  if (!set) {
    set = new Set()
    socketsByUser.set(userId, set)
  }
  set.add(socketId)
}

function unlinkSocket(userId: string, socketId: string) {
  const set = socketsByUser.get(userId)
  if (!set) return
  set.delete(socketId)
  if (set.size === 0) socketsByUser.delete(userId)
}

function emitToUser(userId: string, event: string, payload: unknown) {
  const set = socketsByUser.get(userId)
  if (!set) return
  for (const sid of set) {
    io.to(sid).emit(event, payload)
  }
}

function removeSocket(socketId: string) {
  const state = sockets.get(socketId)
  if (!state) return
  if (state.user) {
    unlinkSocket(state.user.userId, socketId)
  }
  sockets.delete(socketId)
}

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60_000,
  pingInterval: 25_000,
})

io.on('connection', (socket) => {
  console.log(`[chat] socket connected: ${socket.id}`)
  sockets.set(socket.id, { user: null })
  socket.emit('chat:welcome', { message: 'EduGest chat service ready' })

  socket.on('chat:join', (data: ChatUser) => {
    try {
      if (!data?.userId) return
      const state = sockets.get(socket.id)
      if (!state) return
      // If this socket was previously linked to another user, unlink first
      if (state.user && state.user.userId !== data.userId) {
        unlinkSocket(state.user.userId, socket.id)
      }
      const user: ChatUser = {
        userId: data.userId,
        name: data.name || 'Utilisateur',
        role: data.role || 'user',
        avatar: data.avatar || null,
      }
      state.user = user
      linkSocket(user.userId, socket.id)
      console.log(`[chat] join: ${user.name} (${user.role}) — sockets=${socketsByUser.size}`)
    } catch (err) {
      console.error('[chat] join error:', err)
    }
  })

  socket.on('chat:message', (data: { message: ChatMessagePayload }) => {
    try {
      if (!data?.message) return
      const msg = data.message
      // Deliver to the recipient's socket(s)
      emitToUser(msg.receiverId, 'chat:message', { message: msg })
      // Echo to the sender's OTHER tabs (so a second tab updates too)
      const state = sockets.get(socket.id)
      if (state?.user) {
        const set = socketsByUser.get(state.user.userId)
        if (set) {
          for (const sid of set) {
            if (sid !== socket.id) {
              io.to(sid).emit('chat:message', { message: msg })
            }
          }
        }
      }
    } catch (err) {
      console.error('[chat] message relay error:', err)
    }
  })

  socket.on('chat:typing', (data: { toUserId: string; fromUserId: string; isTyping: boolean }) => {
    try {
      if (!data?.toUserId || !data?.fromUserId) return
      emitToUser(data.toUserId, 'chat:typing', { fromUserId: data.fromUserId, isTyping: data.isTyping })
    } catch (err) {
      console.error('[chat] typing relay error:', err)
    }
  })

  socket.on('chat:read', (data: { messageIds: string[]; fromUserId: string; toUserId: string }) => {
    try {
      if (!data?.messageIds || !data?.toUserId) return
      // Notify the original sender that their messages were read
      emitToUser(data.toUserId, 'chat:read', { messageIds: data.messageIds, fromUserId: data.fromUserId })
    } catch (err) {
      console.error('[chat] read relay error:', err)
    }
  })

  socket.on('disconnect', () => {
    console.log(`[chat] socket disconnected: ${socket.id}`)
    removeSocket(socket.id)
  })

  socket.on('error', (err) => {
    console.error(`[chat] socket error (${socket.id}):`, err)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[chat] EduGest chat service running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[chat] SIGTERM received, shutting down...')
  io.close(() => {
    httpServer.close(() => process.exit(0))
  })
})

process.on('SIGINT', () => {
  console.log('[chat] SIGINT received, shutting down...')
  io.close(() => {
    httpServer.close(() => process.exit(0))
  })
})
