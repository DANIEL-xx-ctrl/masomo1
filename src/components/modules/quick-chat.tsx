'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { useChat, type ChatMessagePayload } from '@/hooks/use-chat'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Send,
  Search,
  MessageCircle,
  Users as UsersIcon,
  ArrowLeft,
  Loader2,
  Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
      return 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
    case 'student':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
    case 'parent':
      return 'bg-pink-500/15 text-pink-700 dark:text-pink-300'
    case 'staff':
      return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
    default:
      return 'bg-gray-500/15 text-gray-700 dark:text-gray-300'
  }
}

function initials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function timeShort(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

interface MessageableUser {
  id: string
  name: string
  email: string
  role: string
  avatar: string | null
  userCode: string | null
  institutionId: string | null
  institution?: { name: string } | null
}

interface Conversation {
  partnerId: string
  partnerName: string
  partnerRole: string
  partnerAvatar: string | null
  lastMessage: string
  lastAt: string
  unread: number
}

/**
 * QuickChat — a compact real-time 1:1 messaging widget.
 *
 * Used on the dashboard (replaces the source-code download section).
 * Any authenticated user (except super_admin, who lives in a separate
 * table) can message any other user in their institution.
 */
export function QuickChat() {
  const currentUser = useAppStore((s) => s.currentUser)
  const schoolYear = useAppStore((s) => s.schoolYear)
  const addToast = useAppStore((s) => s.addToast)

  const [allMessages, setAllMessages] = useState<ChatMessagePayload[]>([])
  const [threadMessages, setThreadMessages] = useState<ChatMessagePayload[]>([])
  const [activePartner, setActivePartner] = useState<MessageableUser | null>(null)
  const [draft, setDraft] = useState('')
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [messageableUsers, setMessageableUsers] = useState<MessageableUser[]>([])
  const [pickerQuery, setPickerQuery] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false)

  const threadScrollRef = useRef<HTMLDivElement>(null)
  const draftInputRef = useRef<HTMLInputElement>(null)
  // Ref mirror of activePartner so the socket message handler can read the
  // current value synchronously without side-effects inside a state updater.
  const activePartnerRef = useRef<MessageableUser | null>(null)
  useEffect(() => {
    activePartnerRef.current = activePartner
  }, [activePartner])

  // ---- Initial load: all messages for this user ----
  const loadAllMessages = useCallback(async () => {
    if (!currentUser?.id) return
    try {
      const res = await fetch(
        `/api/messages?userId=${encodeURIComponent(currentUser.id)}&schoolYear=${encodeURIComponent(schoolYear)}`
      )
      if (!res.ok) return
      const data = await res.json()
      setAllMessages(data.messages || [])
    } catch {
      /* ignore */
    }
  }, [currentUser?.id, schoolYear])

  useEffect(() => {
    loadAllMessages()
  }, [loadAllMessages])

  // ---- Real-time: handle incoming messages ----
  const handleIncomingMessage = useCallback(
    (msg: ChatMessagePayload) => {
      const isMine = msg.senderId === currentUser?.id
      const partnerId = isMine ? msg.receiverId : msg.senderId

      setAllMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })

      // If the conversation with this partner is currently open, append to
      // the thread and mark the message as read (when we're the receiver).
      if (activePartnerRef.current?.id === partnerId) {
        setThreadMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
        )
        if (!isMine && currentUser?.id) {
          fetch(`/api/messages/${msg.id}/read`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromUserId: msg.senderId,
              receiverId: currentUser.id,
            }),
          }).catch(() => {})
        }
      } else if (!isMine && msg.sender) {
        // Conversation not open + we're the receiver -> toast notification
        addToast?.(
          'info',
          `Nouveau message de ${msg.sender.name || 'Utilisateur'}`,
          msg.content.slice(0, 80)
        )
      }
    },
    [currentUser?.id, addToast]
  )

  const { connected, sendMessage } = useChat({ onMessage: handleIncomingMessage })

  // ---- Conversations derived from allMessages ----
  const conversations: Conversation[] = useMemo(() => {
    const map = new Map<string, Conversation>()
    for (const m of allMessages) {
      const partnerId = m.senderId === currentUser?.id ? m.receiverId : m.senderId
      const partner =
        m.senderId === currentUser?.id ? m.receiver : m.sender
      if (!partnerId) continue
      const existing = map.get(partnerId)
      const unreadInc =
        m.receiverId === currentUser?.id && !m.read ? 1 : 0
      if (existing) {
        if (new Date(m.createdAt) > new Date(existing.lastAt)) {
          existing.lastMessage = m.content
          existing.lastAt = m.createdAt
        }
        existing.unread += unreadInc
      } else {
        map.set(partnerId, {
          partnerId,
          partnerName: partner?.name || 'Utilisateur',
          partnerRole: partner?.role || 'user',
          partnerAvatar: partner?.avatar || null,
          lastMessage: m.content,
          lastAt: m.createdAt,
          unread: unreadInc,
        })
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    )
  }, [allMessages, currentUser?.id])

  // ---- Open a conversation (load thread) ----
  const openConversation = useCallback(
    async (partner: MessageableUser) => {
      setActivePartner(partner)
      setMobileThreadOpen(true)
      setLoadingThread(true)
      setThreadMessages([])
      try {
        const res = await fetch(
          `/api/messages?userId=${encodeURIComponent(
            currentUser!.id
          )}&withUserId=${encodeURIComponent(partner.id)}&schoolYear=${encodeURIComponent(schoolYear)}`
        )
        if (res.ok) {
          const data = await res.json()
          setThreadMessages(data.messages || [])
        }
      } catch {
        /* ignore */
      } finally {
        setLoadingThread(false)
        // Refetch all messages to update unread counts
        loadAllMessages()
      }
    },
    [currentUser, schoolYear, loadAllMessages]
  )

  // ---- Auto-scroll thread to bottom on new messages ----
  useEffect(() => {
    const el = threadScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [threadMessages, activePartner])

  // ---- Send a message ----
  const handleSend = useCallback(async () => {
    if (!currentUser?.id || !activePartner || !draft.trim()) return
    const content = draft.trim()
    setDraft('')
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          receiverId: activePartner.id,
          content,
          schoolYear,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        addToast?.(
          'error',
          'Échec de l’envoi',
          err?.error || 'Réessayez plus tard'
        )
        setDraft(content)
        return
      }
      const data = await res.json()
      const msg: ChatMessagePayload = data.message
      // Append locally
      setThreadMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      )
      setAllMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      )
      // Broadcast to recipient via socket
      sendMessage(msg)
    } catch {
      addToast?.(
        'error',
        'Erreur réseau',
        'Impossible d’envoyer le message'
      )
      setDraft(content)
    } finally {
      setSending(false)
      draftInputRef.current?.focus()
    }
  }, [currentUser, activePartner, draft, schoolYear, sendMessage, addToast])

  // ---- Load messageable users (for new conversation picker) ----
  const loadMessageableUsers = useCallback(async () => {
    if (!currentUser?.id) return
    setLoadingUsers(true)
    try {
      const params = new URLSearchParams({
        userId: currentUser.id,
        role: currentUser.role,
      })
      if (currentUser.institutionId) {
        params.set('institutionId', currentUser.institutionId)
      }
      if (pickerQuery) params.set('q', pickerQuery)
      const res = await fetch(`/api/messages/users?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setMessageableUsers(data.users || [])
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingUsers(false)
    }
  }, [currentUser, pickerQuery])

  useEffect(() => {
    if (pickerOpen) loadMessageableUsers()
  }, [pickerOpen, loadMessageableUsers])

  const filteredUsers = useMemo(() => {
    if (!pickerQuery) return messageableUsers
    const q = pickerQuery.toLowerCase()
    return messageableUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.userCode || '').toLowerCase().includes(q)
    )
  }, [messageableUsers, pickerQuery])

  // ---- Super admin cannot use chat (not in User table) ----
  if (currentUser?.role === 'super_admin') {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-6 text-center">
          <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            La messagerie n’est pas disponible pour le Super Admin.
            Connectez-vous en tant qu’administrateur pour utiliser le chat.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden border-primary/20 shadow-sm">
      <CardHeader className="pb-3 border-b bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                Messagerie rapide
                {connected ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                  >
                    <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                    En direct
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Circle className="w-2 h-2 fill-muted-foreground text-muted-foreground" />
                    Hors ligne
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Discutez en temps réel avec les membres de votre établissement
              </CardDescription>
            </div>
          </div>
          <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="shrink-0">
                <UsersIcon className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Nouvelle conversation</span>
                <span className="sm:hidden">Nouveau</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nouvelle conversation</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par nom, email ou code…"
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ScrollArea className="h-[300px] rounded-md border">
                  {loadingUsers ? (
                    <div className="flex items-center justify-center p-6">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Aucun utilisateur trouvé
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setPickerOpen(false)
                            openConversation(u)
                          }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 text-left transition-colors"
                        >
                          <Avatar className="w-9 h-9 shrink-0">
                            <AvatarImage src={u.avatar || undefined} />
                            <AvatarFallback className="text-xs">
                              {initials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {u.name}
                              </span>
                              <span
                                className={cn(
                                  'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                  roleColor(u.role)
                                )}
                              >
                                {ROLE_LABELS[u.role] || u.role}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {u.userCode ? `${u.userCode} • ` : ''}{u.email}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid md:grid-cols-[260px_1fr] h-[420px]">
          {/* ---- Conversations list ---- */}
          <div
            className={cn(
              'border-r flex flex-col',
              mobileThreadOpen && 'hidden md:flex'
            )}
          >
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une conversation…"
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {conversations.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Aucune conversation.
                  <br />
                  Commencez une nouvelle conversation.
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((c) => (
                    <button
                      key={c.partnerId}
                      onClick={() => {
                        openConversation({
                          id: c.partnerId,
                          name: c.partnerName,
                          email: '',
                          role: c.partnerRole,
                          avatar: c.partnerAvatar,
                          userCode: null,
                          institutionId: null,
                        })
                      }}
                      className={cn(
                        'w-full flex items-center gap-2.5 p-2.5 hover:bg-muted/50 text-left transition-colors',
                        activePartner?.id === c.partnerId && 'bg-muted/70'
                      )}
                    >
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarImage src={c.partnerAvatar || undefined} />
                        <AvatarFallback className="text-xs">
                          {initials(c.partnerName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-sm font-medium truncate">
                            {c.partnerName}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {timeShort(c.lastAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs text-muted-foreground truncate">
                            {c.lastMessage}
                          </span>
                          {c.unread > 0 && (
                            <Badge className="text-[10px] h-4 px-1.5 shrink-0">
                              {c.unread}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* ---- Thread ---- */}
          <div
            className={cn(
              'flex flex-col',
              !mobileThreadOpen && 'hidden md:flex'
            )}
          >
            {!activePartner ? (
              <div className="flex-1 flex items-center justify-center p-6 text-center">
                <div>
                  <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Sélectionnez une conversation ou démarrez-en une nouvelle.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="flex items-center gap-2 p-3 border-b">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-8 w-8"
                    onClick={() => setMobileThreadOpen(false)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={activePartner.avatar || undefined} />
                    <AvatarFallback className="text-xs">
                      {initials(activePartner.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {activePartner.name}
                    </div>
                    <div className="text-[11px]">
                      <span
                        className={cn(
                          'inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                          roleColor(activePartner.role)
                        )}
                      >
                        {ROLE_LABELS[activePartner.role] || activePartner.role}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div
                  ref={threadScrollRef}
                  className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/10"
                >
                  {loadingThread ? (
                    <div className="flex items-center justify-center p-6">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : threadMessages.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground p-6">
                      Aucun message. Écrivez le premier !
                    </div>
                  ) : (
                    threadMessages.map((m) => {
                      const isMe = m.senderId === currentUser?.id
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            'flex',
                            isMe ? 'justify-end' : 'justify-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                              isMe
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-background border rounded-bl-sm'
                            )}
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {m.content}
                            </p>
                            <div
                              className={cn(
                                'text-[10px] mt-0.5 text-right',
                                isMe
                                  ? 'text-primary-foreground/70'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {timeShort(m.createdAt)}
                              {isMe && (m.read ? ' • Lu' : ' • Envoyé')}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Composer */}
                <div className="p-2 border-t flex items-center gap-2">
                  <Input
                    ref={draftInputRef}
                    placeholder="Écrivez votre message…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    size="icon"
                    className="shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
