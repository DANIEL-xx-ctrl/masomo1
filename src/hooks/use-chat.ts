'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { useAppStore } from '@/lib/store'
import { getSocketUrl } from '@/lib/socket-env'

// ============================================================
// Real-time 1:1 chat via socket.io
// ------------------------------------------------------------
// The chat mini-service runs on port 3004. In the cloud sandbox
// it is reached through the Caddy gateway (?XTransformPort=3004);
// in a local dev environment (VSCode) the browser connects
// directly to http://localhost:3004. The URL is chosen
// automatically by `getSocketUrl()` based on the browser's
// hostname.
//
// Every authenticated user joins the chat service on mount. When
// the user sends a message (POST /api/messages), the caller also
// emits `chat:message` here so the recipient's open tab(s) receive
// it instantly. Incoming `chat:message` events are surfaced via
// the `onMessage` callback registered by the component.
//
// IMPORTANT: message sending via the REST API (`POST /api/messages`)
// works REGARDLESS of whether the socket is connected. The socket
// only provides instant delivery to the recipient's open tab. If
// the socket is offline, messages are still persisted and the
// recipient sees them on their next page load or poll. The
// MessagesModule component includes a polling fallback for
// receiving when the socket is down.
//
// This hook is a singleton: only one socket is opened per browser
// tab, regardless of how many components use the hook.
// ============================================================

export interface ChatMessagePayload {
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
  sender?: {
    id: string
    name: string
    email: string | null
    role: string
    avatar?: string | null
    userCode?: string | null
  }
  receiver?: {
    id: string
    name: string
    email: string | null
    role: string
    avatar?: string | null
    userCode?: string | null
  }
}

const CHAT_PORT = 3004

let socketPromise: Promise<Socket | null> | null = null

async function getSocket(): Promise<Socket | null> {
  if (typeof window === 'undefined') return null
  if (socketPromise) return socketPromise
  socketPromise = (async () => {
    try {
      const { io } = await import('socket.io-client')
      const url = getSocketUrl(CHAT_PORT)
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
      console.error('[chat] failed to load socket.io-client', err)
      return null
    }
  })()
  return socketPromise
}

export interface UseChatOptions {
  /** Called when a new chat:message event arrives from the server. */
  onMessage?: (msg: ChatMessagePayload) => void
  /** Called when a chat:typing event arrives. */
  onTyping?: (fromUserId: string, isTyping: boolean) => void
  /** Called when a chat:read event arrives (messages were read by the partner). */
  onRead?: (messageIds: string[], fromUserId: string) => void
}

export interface UseChatResult {
  connected: boolean
  /** Broadcast a newly-created message to the recipient. */
  sendMessage: (msg: ChatMessagePayload) => void
  /** Notify the partner that the current user is/isn't typing. */
  sendTyping: (toUserId: string, isTyping: boolean) => void
  /** Notify the partner that messages were read. */
  sendRead: (messageIds: string[], fromUserId: string, toUserId: string) => void
}

export function useChat(options: UseChatOptions = {}): UseChatResult {
  const { onMessage, onTyping, onRead } = options
  const [connected, setConnected] = useState(false)
  const currentUser = useAppStore((s) => s.currentUser)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)

  // Keep latest callbacks in refs so the socket listeners (bound once) always
  // call the freshest closure without needing to re-bind.
  const onMessageRef = useRef(onMessage)
  const onTypingRef = useRef(onTyping)
  const onReadRef = useRef(onRead)
  useEffect(() => {
    onMessageRef.current = onMessage
    onTypingRef.current = onTyping
    onReadRef.current = onRead
  }, [onMessage, onTyping, onRead])

  const socketRef = useRef<Socket | null>(null)
  const joinedRef = useRef(false)

  // Keep the latest user id in a ref so the join-on-connect logic can read it
  // without re-running the whole effect when the store changes.
  const userRef = useRef(currentUser)
  useEffect(() => {
    userRef.current = currentUser
  }, [currentUser])

  // ---- Connect + join ----
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return
    let cancelled = false

    getSocket().then((sock) => {
      if (cancelled || !sock) return
      socketRef.current = sock

      // ---- Register listeners FIRST ----
      const onConnect = () => {
        setConnected(true)
        const u = userRef.current
        if (!u) return
        sock.emit('chat:join', {
          userId: u.id,
          name: u.name,
          role: u.role,
          avatar: u.avatar || null,
        })
        joinedRef.current = true
      }
      const onDisconnect = () => {
        setConnected(false)
      }
      const handleMessage = (payload: { message: ChatMessagePayload }) => {
        if (payload?.message) {
          onMessageRef.current?.(payload.message)
        }
      }
      const handleTyping = (payload: { fromUserId: string; isTyping: boolean }) => {
        if (payload?.fromUserId) {
          onTypingRef.current?.(payload.fromUserId, !!payload.isTyping)
        }
      }
      const handleRead = (payload: { messageIds: string[]; fromUserId: string }) => {
        if (payload?.messageIds && payload.fromUserId) {
          onReadRef.current?.(payload.messageIds, payload.fromUserId)
        }
      }

      sock.on('connect', onConnect)
      sock.on('disconnect', onDisconnect)
      sock.on('chat:message', handleMessage)
      sock.on('chat:typing', handleTyping)
      sock.on('chat:read', handleRead)

      if (sock.connected) {
        onConnect()
      }

      // cleanup for this effect run
      return () => {
        sock.off('connect', onConnect)
        sock.off('disconnect', onDisconnect)
        sock.off('chat:message', handleMessage)
        sock.off('chat:typing', handleTyping)
        sock.off('chat:read', handleRead)
      }
    })

    return () => {
      cancelled = true
      joinedRef.current = false
    }
  }, [isAuthenticated, currentUser?.id])

  const sendMessage = useCallback((msg: ChatMessagePayload) => {
    const sock = socketRef.current
    if (sock) {
      sock.emit('chat:message', { message: msg })
    } else {
      // Socket not ready yet — try to get it async
      getSocket().then((s) => {
        if (s) s.emit('chat:message', { message: msg })
      })
    }
  }, [])

  const sendTyping = useCallback((toUserId: string, isTyping: boolean) => {
    const u = userRef.current
    if (!u) return
    const sock = socketRef.current
    if (sock) {
      sock.emit('chat:typing', { toUserId, fromUserId: u.id, isTyping })
    }
  }, [])

  const sendRead = useCallback(
    (messageIds: string[], fromUserId: string, toUserId: string) => {
      const sock = socketRef.current
      if (sock) {
        sock.emit('chat:read', { messageIds, fromUserId, toUserId })
      }
    },
    []
  )

  return { connected, sendMessage, sendTyping, sendRead }
}
