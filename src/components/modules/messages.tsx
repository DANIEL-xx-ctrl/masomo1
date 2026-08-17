'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { useChat, type ChatMessagePayload } from '@/hooks/use-chat'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Send,
  Search,
  MessageSquare,
  Users as UsersIcon,
  ArrowLeft,
  Loader2,
  Circle,
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Image as ImageIcon,
  Video,
  Music,
  Paperclip,
  X,
  File as FileIcon,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { avatarUrl } from '@/lib/utils'

// ============================================================
// Messagerie — full-featured 1:1 real-time messaging page
// ============================================================

// ---- Role label + color helpers ----
const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrateur',
  teacher: 'Enseignant',
  student: 'Élève',
  parent: 'Parent',
  staff: 'Personnel',
}

function roleColor(role: string): string {
  switch (role) {
    case 'super_admin':
      return 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
    case 'admin':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    case 'teacher':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
    case 'student':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
    case 'parent':
      return 'bg-pink-500/15 text-pink-700 dark:text-pink-300'
    case 'staff':
      return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
    default:
      return 'bg-gray-500/15 text-gray-700 dark:text-gray-300'
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// ---- HTML sanitization for the contentEditable composer output ----
// Only a strict whitelist of formatting tags is kept; ALL attributes are
// stripped so no event handlers / styles can sneak through.
const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins',
  'ul', 'ol', 'li', 'br', 'p', 'div', 'blockquote', 'code', 'pre',
  'span', 'br',
])

function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return ''
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const walk = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element
        const tag = el.tagName.toLowerCase()
        if (!ALLOWED_TAGS.has(tag)) {
          const parent = el.parentNode
          if (parent) {
            while (el.firstChild) parent.insertBefore(el.firstChild, el)
            parent.removeChild(el)
            return
          }
        }
        // Strip all attributes
        while (el.attributes.length > 0) {
          el.removeAttribute(el.attributes[0].name)
        }
      }
      const children = Array.from(node.childNodes)
      for (const child of children) walk(child)
    }
    // Walk body's CHILDREN, not body itself — `body`/`html` are not in
    // ALLOWED_TAGS, so walking the body node would remove it and make
    // doc.body null.
    const bodyChildren = Array.from(doc.body.childNodes)
    for (const child of bodyChildren) walk(child)
    return doc.body.innerHTML
  } catch {
    // Fallback: escape everything
    const div = document.createElement('div')
    div.textContent = html
    return div.innerHTML
  }
}

// ---- Types ----
interface ChatUser {
  id: string
  name: string
  email: string | null
  role: string
  avatar: string | null
  userCode: string | null
  institutionName?: string | null
}

interface Conversation {
  partnerId: string
  partner: ChatUser
  lastMessage?: ChatMessagePayload
  unreadCount: number
}

// ============================================================
// Attachment renderer
// ============================================================
function AttachmentView({
  attachmentUrl,
  attachmentType,
  attachmentName,
  attachmentSize,
}: {
  attachmentUrl: string
  attachmentType?: string | null
  attachmentName?: string | null
  attachmentSize?: number | null
}) {
  const type = attachmentType || 'file'
  const name = attachmentName || 'Fichier'
  const sizeLabel = formatFileSize(attachmentSize)

  if (type === 'image') {
    return (
      <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={attachmentUrl}
          alt={name}
          className="max-w-full max-h-64 rounded-lg border border-border object-cover cursor-pointer hover:opacity-90 transition-opacity"
        />
      </a>
    )
  }

  if (type === 'video') {
    return (
      <video
        src={attachmentUrl}
        controls
        className="max-w-full max-h-64 rounded-lg border border-border bg-black"
      />
    )
  }

  if (type === 'audio') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 min-w-[220px]">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Music className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{name}</p>
          {sizeLabel && <p className="text-[10px] text-muted-foreground">{sizeLabel}</p>}
          <audio src={attachmentUrl} controls className="w-full mt-1 h-8" />
        </div>
      </div>
    )
  }

  // Generic file
  return (
    <a
      href={attachmentUrl}
      download={name}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 min-w-[220px] hover:bg-muted/70 transition-colors"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <FileIcon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{name}</p>
        {sizeLabel && <p className="text-[10px] text-muted-foreground">{sizeLabel}</p>}
      </div>
      <Download className="w-4 h-4 text-muted-foreground shrink-0" />
    </a>
  )
}

// ============================================================
// Message bubble
// ============================================================
function MessageBubble({
  message,
  isMine,
}: {
  message: ChatMessagePayload
  isMine: boolean
}) {
  const html = useMemo(() => {
    const raw = message.content || ''
    if (!raw) return ''
    // If content looks like HTML (from the rich editor), sanitize it.
    if (/<[a-z][\s\S]*>/i.test(raw)) {
      return sanitizeHtml(raw)
    }
    // Plain text — escape and convert newlines to <br>
    const div = document.createElement('div')
    div.textContent = raw
    return div.innerHTML.replace(/\n/g, '<br/>')
  }, [message.content])

  const hasAttachment = !!message.attachmentUrl

  return (
    <div className={cn('flex flex-col gap-1', isMine ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm break-words',
          isMine
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}
      >
        {hasAttachment && (
          <div className="mb-1.5 last:mb-0">
            <AttachmentView
              attachmentUrl={message.attachmentUrl!}
              attachmentType={message.attachmentType}
              attachmentName={message.attachmentName}
              attachmentSize={message.attachmentSize}
            />
          </div>
        )}
        {html ? (
          <div
            className="prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_blockquote]:italic [&_code]:bg-black/10 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-black/10 [&_pre]:p-2 [&_pre]:rounded"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}
      </div>
      <span className="text-[10px] text-muted-foreground px-1">
        {formatTime(message.createdAt)}
      </span>
    </div>
  )
}

// ============================================================
// Format toolbar
// ============================================================
function FormatToolbar({
  onCommand,
  onAttach,
  uploading,
}: {
  onCommand: (cmd: string) => void
  onAttach: (kind: 'image' | 'video' | 'audio' | 'file') => void
  uploading: boolean
}) {
  const btn = (cmd: string, icon: React.ReactNode, title: string) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onCommand(cmd)
      }}
      className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
      title={title}
      tabIndex={-1}
    >
      {icon}
    </button>
  )

  return (
    <div className="flex items-center gap-0.5 px-1 py-1 border-b border-border bg-muted/30 flex-wrap">
      {btn('bold', <Bold className="w-3.5 h-3.5" />, 'Gras (Ctrl+B)')}
      {btn('italic', <Italic className="w-3.5 h-3.5" />, 'Italique (Ctrl+I)')}
      {btn('underline', <Underline className="w-3.5 h-3.5" />, 'Souligné (Ctrl+U)')}
      {btn('strikeThrough', <Strikethrough className="w-3.5 h-3.5" />, 'Barré')}
      <div className="w-px h-4 bg-border mx-0.5" />
      {btn('insertUnorderedList', <List className="w-3.5 h-3.5" />, 'Liste à puces')}
      {btn('insertOrderedList', <ListOrdered className="w-3.5 h-3.5" />, 'Liste numérotée')}
      {btn('formatBlock-blockquote', <Quote className="w-3.5 h-3.5" />, 'Citation')}
      {btn('formatBlock-pre', <Code className="w-3.5 h-3.5" />, 'Code')}
      <div className="w-px h-4 bg-border mx-0.5" />
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onAttach('image') }}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        title="Image"
        tabIndex={-1}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onAttach('video') }}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        title="Vidéo"
        tabIndex={-1}
        disabled={uploading}
      >
        <Video className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onAttach('audio') }}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        title="Audio"
        tabIndex={-1}
        disabled={uploading}
      >
        <Music className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onAttach('file') }}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        title="Fichier"
        tabIndex={-1}
        disabled={uploading}
      >
        <Paperclip className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ============================================================
// Main module
// ============================================================
export default function MessagesModule() {
  // NOTE: `schoolYear` is a SEPARATE field on the Zustand store, NOT a
  // property of the User object. Earlier versions referenced `me.schoolYear`
  // which is always `undefined` (User has no such field) — it silently fell
  // back to '2024-2025'. We now read it from the store directly so the
  // messaging module respects the year selector in the header.
  const { currentUser, addToast, setActiveModule, schoolYear } = useAppStore()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activePartner, setActivePartner] = useState<ChatUser | null>(null)
  const [thread, setThread] = useState<ChatMessagePayload[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [users, setUsers] = useState<ChatUser[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [typingFrom, setTypingFrom] = useState<string | null>(null)
  const [mobileShowThread, setMobileShowThread] = useState(false)

  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingAttachKind = useRef<'image' | 'video' | 'audio' | 'file'>('file')
  const scrollRef = useRef<HTMLDivElement>(null)
  const activePartnerRef = useRef<ChatUser | null>(null)
  const conversationsRef = useRef<Conversation[]>([])

  useEffect(() => { activePartnerRef.current = activePartner }, [activePartner])
  useEffect(() => { conversationsRef.current = conversations }, [conversations])

  const me = currentUser

  // ---- Fetch conversation list ----
  const fetchConversations = useCallback(async () => {
    if (!me || me.role === 'super_admin') {
      setLoadingList(false)
      return
    }
    try {
      setLoadingList(true)
      const res = await fetch(
        `/api/messages?userId=${me.id}&schoolYear=${encodeURIComponent(schoolYear || '2024-2025')}`,
        { headers: { 'x-user-id': me.id, 'x-institution-id': me.institutionId || '', 'x-user-role': me.role } }
      )
      if (!res.ok) return
      const data = await res.json()
      const msgs: ChatMessagePayload[] = data.messages || []
      // Group into conversations by partner
      const map = new Map<string, Conversation>()
      for (const m of msgs) {
        const partnerId = m.senderId === me.id ? m.receiverId : m.senderId
        const partnerInfo = m.senderId === me.id ? m.receiver : m.sender
        if (!partnerInfo) continue
        const existing = map.get(partnerId)
        const isUnread = !m.read && m.receiverId === me.id
        if (!existing) {
          map.set(partnerId, {
            partnerId,
            partner: {
              id: partnerInfo.id,
              name: partnerInfo.name,
              email: partnerInfo.email,
              role: partnerInfo.role,
              avatar: partnerInfo.avatar ?? null,
              userCode: partnerInfo.userCode ?? null,
            },
            lastMessage: m,
            unreadCount: isUnread ? 1 : 0,
          })
        } else {
          // msgs come newest-first; keep the first (newest) as lastMessage
          if (isUnread) existing.unreadCount += 1
        }
      }
      const list = Array.from(map.values()).sort((a, b) => {
        const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0
        const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0
        return tb - ta
      })
      setConversations(list)
    } catch {
      /* ignore */
    } finally {
      setLoadingList(false)
    }
  }, [me, schoolYear])

  // ---- Fetch thread ----
  const fetchThread = useCallback(async (partner: ChatUser) => {
    if (!me) return
    try {
      setLoadingThread(true)
      const res = await fetch(
        `/api/messages?userId=${me.id}&withUserId=${partner.id}&schoolYear=${encodeURIComponent(schoolYear || '2024-2025')}`,
        { headers: { 'x-user-id': me.id, 'x-institution-id': me.institutionId || '', 'x-user-role': me.role } }
      )
      if (!res.ok) return
      const data = await res.json()
      setThread(data.messages || [])
      // Refresh conversations to update unread badges
      fetchConversations()
    } catch {
      /* ignore */
    } finally {
      setLoadingThread(false)
    }
  }, [me, schoolYear, fetchConversations])

  // ---- Initial load ----
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // ---- Auto-scroll to bottom on new thread messages ----
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [thread, activePartner])

  // ---- Real-time incoming message handler ----
  const handleIncomingMessage = useCallback((msg: ChatMessagePayload) => {
    if (!me) return
    const isMine = msg.senderId === me.id
    const partnerId = isMine ? msg.receiverId : msg.senderId
    const partnerInfo = isMine ? msg.receiver : msg.sender
    const isViewing = activePartnerRef.current?.id === partnerId

    // If viewing this conversation, append to thread immediately
    if (isViewing) {
      setThread((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    }

    // Update conversation list
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.partnerId === partnerId)
      const isUnread = !isMine && !msg.read
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = {
          ...updated[idx],
          lastMessage: msg,
          unreadCount: isViewing || isMine ? 0 : updated[idx].unreadCount + (isUnread ? 1 : 0),
        }
        // Re-sort: move to top
        const [item] = updated.splice(idx, 1)
        updated.unshift(item)
        return updated
      }
      // New conversation
      if (!partnerInfo) return prev
      const newConv: Conversation = {
        partnerId,
        partner: {
          id: partnerInfo.id,
          name: partnerInfo.name,
          email: partnerInfo.email,
          role: partnerInfo.role,
          avatar: partnerInfo.avatar ?? null,
          userCode: partnerInfo.userCode ?? null,
        },
        lastMessage: msg,
        unreadCount: isUnread && !isViewing ? 1 : 0,
      }
      return [newConv, ...prev]
    })

    // Toast notification when not viewing the conversation
    if (!isMine && !isViewing && partnerInfo) {
      const preview = msg.content
        ? msg.content.replace(/<[^>]*>/g, '').slice(0, 50)
        : msg.attachmentType === 'image' ? '📷 Photo'
        : msg.attachmentType === 'video' ? '🎥 Vidéo'
        : msg.attachmentType === 'audio' ? '🎤 Audio'
        : '📎 Pièce jointe'
      addToast('info', `Nouveau message de ${partnerInfo.name}`, preview)
    }
  }, [me, addToast])

  const handleTyping = useCallback((fromUserId: string, isTyping: boolean) => {
    if (activePartnerRef.current?.id === fromUserId) {
      setTypingFrom(isTyping ? fromUserId : null)
    }
    if (!isTyping && typingFrom === fromUserId) setTypingFrom(null)
  }, [typingFrom])

  const handleRead = useCallback((_ids: string[], fromUserId: string) => {
    // Partner read our messages — update the thread to mark them read
    setThread((prev) =>
      prev.map((m) =>
        m.senderId === me?.id && m.receiverId === fromUserId ? { ...m, read: true } : m
      )
    )
  }, [me])

  const { connected, sendMessage, sendTyping, sendRead } = useChat({
    onMessage: handleIncomingMessage,
    onTyping: handleTyping,
    onRead: handleRead,
  })

  // ---- Polling fallback (when socket is NOT connected) ----
  // In a local dev environment (VSCode) the chat-service might not be
  // running, or the Caddy gateway might be unavailable. In that case
  // the socket never connects and the user would never see incoming
  // messages. This poller refetches the active conversation + the
  // conversation list every 10 seconds when the socket is offline, so
  // messaging still works (just not instantaneously).
  useEffect(() => {
    if (connected) return // socket is live — no need to poll
    if (!me) return
    const interval = setInterval(() => {
      // Skip when tab is hidden — saves serverless invocations.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      // Refresh the conversation list (picks up new messages from anyone)
      fetchConversations()
      // Refresh the active thread (picks up new messages from partner)
      const partner = activePartnerRef.current
      if (partner) {
        fetch(
          `/api/messages?userId=${me.id}&withUserId=${partner.id}&schoolYear=${encodeURIComponent(schoolYear || '2024-2025')}`,
          { headers: { 'x-user-id': me.id, 'x-institution-id': me.institutionId || '', 'x-user-role': me.role } }
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.messages) {
              setThread((prev) => {
                const same =
                  data.messages.length === prev.length &&
                  data.messages.every((m: ChatMessagePayload, i: number) =>
                    prev[i] && prev[i].id === m.id && prev[i].read === m.read
                  )
                return same ? prev : data.messages
              })
            }
          })
          .catch(() => { /* ignore poll errors */ })
      }
    }, 10_000)
    return () => clearInterval(interval)
  }, [connected, me, schoolYear, fetchConversations])

  // ---- Fetch messageable users (for new conversation dialog) ----
  const fetchUsers = useCallback(async (q: string) => {
    if (!me) return
    try {
      setLoadingUsers(true)
      const params = new URLSearchParams({
        userId: me.id,
        role: me.role,
        institutionId: me.institutionId || '',
      })
      if (q) params.set('q', q)
      const res = await fetch(`/api/messages/users?${params.toString()}`, {
        headers: { 'x-user-id': me.id, 'x-institution-id': me.institutionId || '', 'x-user-role': me.role },
      })
      if (!res.ok) return
      const data = await res.json()
      setUsers(data.users || [])
    } catch {
      /* ignore */
    } finally {
      setLoadingUsers(false)
    }
  }, [me])

  // ---- Open a conversation ----
  const openConversation = useCallback((partner: ChatUser) => {
    setActivePartner(partner)
    setMobileShowThread(true)
    setThread([])
    fetchThread(partner)
    setNewChatOpen(false)
  }, [fetchThread])

  // ---- Send a message ----
  const handleSend = useCallback(async () => {
    if (!me || !activePartner) return
    const editor = editorRef.current
    if (!editor) return
    const rawHtml = editor.innerHTML
    const text = editor.innerText.trim()
    // Guard: never send an empty message. Attachments are sent through
    // `handleSendWithAttachment` (which bypasses this function), so the
    // `pendingAttachKind` ref is irrelevant here — it is always a truthy
    // ref object, which previously made this guard a no-op and caused the
    // API to return 400 ("Le message doit contenir du texte ou une pièce
    // jointe") whenever the user clicked Send on an empty editor.
    if (!text) return

    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': me.id,
          'x-institution-id': me.institutionId || '',
          'x-user-role': me.role,
        },
        body: JSON.stringify({
          senderId: me.id,
          receiverId: activePartner.id,
          content: rawHtml,
          schoolYear: schoolYear || '2024-2025',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // Surface the ACTUAL server error so the user can see what failed
        // (e.g. a stale DB schema yields a clear "run `bun run db:push`"
        // message). Default to a generic message only if the server sent
        // nothing useful.
        const detail =
          err.error || err.details || err.message || "Échec de l'envoi"
        addToast('error', "Erreur d'envoi", detail, 8000)
        return
      }
      const data = await res.json()
      const msg: ChatMessagePayload = data.message
      // Append to thread
      setThread((prev) => [...prev, msg])
      // Update conversation list (move to top)
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.partnerId === activePartner.id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], lastMessage: msg, unreadCount: 0 }
          const [item] = updated.splice(idx, 1)
          updated.unshift(item)
          return updated
        }
        return [{
          partnerId: activePartner.id,
          partner: activePartner,
          lastMessage: msg,
          unreadCount: 0,
        }, ...prev]
      })
      // Broadcast via socket — BEST EFFORT ONLY. The message has already
      // been persisted (POST succeeded above). If the socket is offline
      // (e.g. chat-service not running in a local dev environment), the
      // recipient will pick up the message via their polling fallback.
      // Never let a socket error turn a successful send into a failure.
      try { sendMessage(msg) } catch { /* ignore — REST already succeeded */ }
      // Clear editor
      editor.innerHTML = ''
    } catch {
      addToast('error', 'Erreur', "Échec de l'envoi du message")
    } finally {
      setSending(false)
    }
  }, [me, activePartner, schoolYear, addToast, sendMessage])

  // ---- Send with attachment ----
  const handleSendWithAttachment = useCallback(async (
    file: File,
    kind: 'image' | 'video' | 'audio' | 'file'
  ) => {
    if (!me || !activePartner) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const upRes = await fetch('/api/messages/upload', {
        method: 'POST',
        headers: {
          'x-user-id': me.id,
          'x-institution-id': me.institutionId || '',
          'x-user-role': me.role,
        },
        body: fd,
      })
      if (!upRes.ok) {
        const err = await upRes.json().catch(() => ({}))
        addToast('error', 'Upload échoué', err.error || 'Erreur lors de l\'upload')
        return
      }
      const upData = await upRes.json()
      // Capture text too
      const editor = editorRef.current
      const rawHtml = editor ? editor.innerHTML : ''
      const text = editor ? editor.innerText.trim() : ''

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': me.id,
          'x-institution-id': me.institutionId || '',
          'x-user-role': me.role,
        },
        body: JSON.stringify({
          senderId: me.id,
          receiverId: activePartner.id,
          content: rawHtml,
          schoolYear: schoolYear || '2024-2025',
          attachmentUrl: upData.url,
          attachmentType: upData.attachmentType || kind,
          attachmentName: upData.name || file.name,
          attachmentSize: upData.size || file.size,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const detail =
          err.error || err.details || err.message || "Échec de l'envoi"
        addToast('error', "Erreur d'envoi", detail, 8000)
        return
      }
      const data = await res.json()
      const msg: ChatMessagePayload = data.message
      setThread((prev) => [...prev, msg])
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.partnerId === activePartner.id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], lastMessage: msg, unreadCount: 0 }
          const [item] = updated.splice(idx, 1)
          updated.unshift(item)
          return updated
        }
        return [{
          partnerId: activePartner.id,
          partner: activePartner,
          lastMessage: msg,
          unreadCount: 0,
        }, ...prev]
      })
      try { sendMessage(msg) } catch { /* best-effort */ }
      if (editor) editor.innerHTML = ''
    } catch {
      addToast('error', 'Erreur', "Échec de l'envoi de la pièce jointe")
    } finally {
      setUploading(false)
    }
  }, [me, activePartner, schoolYear, addToast, sendMessage])

  // ---- File input handler ----
  const triggerFileInput = useCallback((kind: 'image' | 'video' | 'audio' | 'file') => {
    pendingAttachKind.current = kind
    if (fileInputRef.current) {
      const acceptMap: Record<string, string> = {
        image: 'image/*',
        video: 'video/*',
        audio: 'audio/*',
        file: '*/*',
      }
      fileInputRef.current.accept = acceptMap[kind]
      fileInputRef.current.click()
    }
  }, [])

  const onFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleSendWithAttachment(file, pendingAttachKind.current)
    }
    // Reset input so the same file can be selected again
    e.target.value = ''
  }, [handleSendWithAttachment])

  // ---- Format command (execCommand) ----
  const execCmd = useCallback((cmd: string) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    if (cmd.startsWith('formatBlock-')) {
      const tag = cmd.substring('formatBlock-'.length)
      try {
        document.execCommand('formatBlock', false, tag)
      } catch {
        /* ignore */
      }
    } else {
      try {
        document.execCommand(cmd, false)
      } catch {
        /* ignore */
      }
    }
  }, [])

  // ---- Typing indicator ----
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleEditorInput = useCallback(() => {
    if (!activePartner) return
    sendTyping(activePartner.id, true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(activePartner.id, false)
    }, 2000)
  }, [activePartner, sendTyping])

  // ---- Keyboard shortcuts ----
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); execCmd('bold') }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); execCmd('italic') }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); execCmd('underline') }
  }, [handleSend, execCmd])

  // ---- Mark read when opening a conversation (via socket) ----
  useEffect(() => {
    if (activePartner && thread.length > 0) {
      const unreadIds = thread
        .filter((m) => m.receiverId === me?.id && !m.read)
        .map((m) => m.id)
      if (unreadIds.length > 0) {
        sendRead(unreadIds, me!.id, activePartner.id)
      }
    }
  }, [activePartner, thread, me, sendRead])

  // ---- Filtered conversations ----
  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations
    const q = search.toLowerCase()
    return conversations.filter(
      (c) =>
        c.partner.name.toLowerCase().includes(q) ||
        (c.partner.email || '').toLowerCase().includes(q) ||
        (c.partner.userCode || '').toLowerCase().includes(q)
    )
  }, [conversations, search])

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  )

  // ---- Super admin view ----
  if (me?.role === 'super_admin') {
    return (
      <Card>
        <CardContent className="p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Messagerie non disponible</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            La messagerie 1-à-1 est réservée aux utilisateurs rattachés à un
            établissement (admin, enseignant, élève, parent, personnel). Le Super
            Admin gère les institutions depuis son module dédié.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-13rem)]">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={onFileSelected}
      />
      <Card className="flex-1 overflow-hidden flex flex-row min-h-0">
        {/* ---- Conversation list (left) ---- */}
        <div
          className={cn(
            'flex flex-col border-r border-border min-h-0',
            'w-full md:w-80 shrink-0',
            mobileShowThread && activePartner ? 'hidden md:flex' : 'flex'
          )}
        >
          {/* List header */}
          <div className="p-3 border-b border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Conversations</h2>
                {totalUnread > 0 && (
                  <Badge className="bg-destructive text-white text-[10px] h-5 px-1.5">
                    {totalUnread}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="flex items-center gap-1 text-[10px] text-muted-foreground"
                  title={
                    connected
                      ? 'Connecté au service de messagerie temps réel'
                      : 'Service temps réel indisponible — mode différé (polling 5s). Vous pouvez quand même envoyer des messages.'
                  }
                >
                  <Circle className={cn('w-2 h-2', connected ? 'fill-emerald-500 text-emerald-500' : 'fill-amber-500 text-amber-500')} />
                  {connected ? 'En direct' : 'Mode différé'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => {
                    setNewChatOpen(true)
                    fetchUsers('')
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nouvelle
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher une conversation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>

          {/* List */}
          <ScrollArea className="flex-1 min-h-0">
            {loadingList ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <MessageSquare className="w-10 h-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {search ? 'Aucune conversation trouvée' : 'Aucune conversation'}
                </p>
                {!search && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 gap-1 text-xs"
                    onClick={() => {
                      setNewChatOpen(true)
                      fetchUsers('')
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Démarrer une conversation
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredConversations.map((conv) => {
                  const isActive = activePartner?.id === conv.partnerId
                  const last = conv.lastMessage
                  const lastText = last
                    ? (last.senderId === me?.id ? 'Vous : ' : '') +
                      (last.content
                        ? last.content.replace(/<[^>]*>/g, '').slice(0, 40)
                        : last.attachmentType === 'image' ? '📷 Photo'
                        : last.attachmentType === 'video' ? '🎥 Vidéo'
                        : last.attachmentType === 'audio' ? '🎤 Audio'
                        : '📎 Pièce jointe')
                    : ''
                  return (
                    <button
                      key={conv.partnerId}
                      onClick={() => openConversation(conv.partner)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 text-left transition-colors',
                        isActive ? 'bg-primary/10' : 'hover:bg-muted/50'
                      )}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-10 w-10">
                          {conv.partner.avatar && (
                            <AvatarImage src={avatarUrl(conv.partner.avatar)} alt={conv.partner.name} />
                          )}
                          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                            {getInitials(conv.partner.name)}
                          </AvatarFallback>
                        </Avatar>
                        {conv.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-destructive text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn('text-sm truncate', conv.unreadCount > 0 ? 'font-semibold' : 'font-medium')}>
                            {conv.partner.name}
                          </p>
                          {last && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatTime(last.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {lastText || 'Démarrez la conversation'}
                        </p>
                        <Badge className={cn('mt-1 text-[9px] h-4 px-1.5 font-medium', roleColor(conv.partner.role))}>
                          {ROLE_LABELS[conv.partner.role] || conv.partner.role}
                        </Badge>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ---- Thread (right) ---- */}
        <div
          className={cn(
            'flex-1 flex flex-col min-h-0',
            !mobileShowThread || !activePartner ? 'hidden md:flex' : 'flex'
          )}
        >
          {!activePartner ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Votre messagerie</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Sélectionnez une conversation ou démarrez-en une nouvelle pour
                échanger avec les membres de votre établissement.
              </p>
              <Button
                className="mt-4 gap-2"
                onClick={() => {
                  setNewChatOpen(true)
                  fetchUsers('')
                }}
              >
                <Plus className="w-4 h-4" />
                Nouvelle conversation
              </Button>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 p-3 border-b border-border bg-muted/30">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden shrink-0"
                  onClick={() => setMobileShowThread(false)}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Avatar className="h-9 w-9 shrink-0">
                  {activePartner.avatar && (
                    <AvatarImage src={avatarUrl(activePartner.avatar)} alt={activePartner.name} />
                  )}
                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                    {getInitials(activePartner.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{activePartner.name}</p>
                  <div className="flex items-center gap-2">
                    <Badge className={cn('text-[9px] h-4 px-1.5 font-medium', roleColor(activePartner.role))}>
                      {ROLE_LABELS[activePartner.role] || activePartner.role}
                    </Badge>
                    {typingFrom === activePartner.id ? (
                      <span className="text-[10px] text-primary italic">en train d'écrire…</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {activePartner.email || activePartner.userCode || ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {loadingThread ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : thread.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <UsersIcon className="w-8 h-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Aucun message. Envoyez le premier !
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Day separator */}
                    {(() => {
                      const items: React.ReactNode[] = []
                      let lastDay = ''
                      thread.forEach((m, i) => {
                        const day = formatDay(m.createdAt)
                        if (day !== lastDay) {
                          items.push(
                            <div key={`day-${i}`} className="flex items-center justify-center my-2">
                              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {day}
                              </span>
                            </div>
                          )
                          lastDay = day
                        }
                        const isMine = m.senderId === me?.id
                        items.push(
                          <MessageBubble key={m.id} message={m} isMine={isMine} />
                        )
                      })
                      return items
                    })()}
                    {typingFrom === activePartner.id && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-border bg-card">
                <FormatToolbar onCommand={execCmd} onAttach={triggerFileInput} uploading={uploading} />
                <div className="flex items-end gap-2 p-2.5">
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleEditorInput}
                    onKeyDown={handleKeyDown}
                    data-placeholder="Écrivez un message…"
                    className={cn(
                      'flex-1 min-h-[96px] max-h-[260px] overflow-y-auto px-3.5 py-2.5 text-sm rounded-lg leading-relaxed',
                      'border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20',
                      '[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground'
                    )}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={sending || uploading}
                    size="icon"
                    className="shrink-0 h-11 w-11 rounded-full self-end"
                    title="Envoyer (Entrée)"
                  >
                    {sending || uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground px-3 pb-2">
                  Entrée pour envoyer · Maj+Entrée pour un saut de ligne · Ctrl+B/I/U pour formater
                </p>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* ---- New conversation dialog ---- */}
      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email, code…"
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value)
                  fetchUsers(e.target.value)
                }}
                className="pl-9"
                autoFocus
              />
            </div>
            <ScrollArea className="max-h-[360px] -mx-1">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <UsersIcon className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {userSearch ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur disponible'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border px-1">
                  {users.map((u) => {
                    const already = conversations.some((c) => c.partnerId === u.id)
                    return (
                      <button
                        key={u.id}
                        onClick={() => openConversation(u)}
                        className="w-full flex items-center gap-3 p-2.5 hover:bg-muted/50 rounded-lg transition-colors text-left"
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          {u.avatar && <AvatarImage src={avatarUrl(u.avatar)} alt={u.name} />}
                          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                            {getInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{u.name}</p>
                            {already && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0">
                                existante
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.email || u.userCode || ''}
                          </p>
                        </div>
                        <Badge className={cn('text-[9px] h-4 px-1.5 font-medium shrink-0', roleColor(u.role))}>
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
