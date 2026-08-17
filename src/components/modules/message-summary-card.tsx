'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { useChat, type ChatMessagePayload } from '@/hooks/use-chat'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessagesSquare, ArrowRight, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { avatarUrl } from '@/lib/utils'
import { dedupedFetch, isTabHidden } from '@/lib/api-cache'

// ============================================================
// MessageSummaryCard — compact messaging preview shown on the
// dashboard. Displays unread count + recent conversations and a
// button to open the full Messages page.
// ============================================================

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
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24) return `il y a ${diffH} h`
  if (diffD < 7) return `il y a ${diffD} j`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

interface ConvPreview {
  partnerId: string
  partnerName: string
  partnerRole: string
  partnerAvatar: string | null
  lastMessage?: ChatMessagePayload
  unreadCount: number
}

export function MessageSummaryCard() {
  const { currentUser, setActiveModule } = useAppStore()
  const [conversations, setConversations] = useState<ConvPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)

  const me = currentUser

  // Keep latest user in a ref so the polling interval doesn't reset on
  // every store update (profile refresh, avatar change, etc.). This was
  // a major cause of the Vercel "container exceed concurrency threshold"
  // error — each store update recreated fetchConversations, which re-ran
  // the effect, which immediately fired a new HTTP request.
  const meRef = useRef(me)
  useEffect(() => {
    meRef.current = me
  }, [me])

  const fetchConversations = useCallback(async (opts?: { force?: boolean }) => {
    const user = meRef.current
    if (!user || user.role === 'super_admin') {
      setLoading(false)
      return
    }
    // Skip background polling when the tab is hidden.
    if (!opts?.force && isTabHidden()) return
    try {
      const res = await dedupedFetch(
        `/api/messages?userId=${user.id}&schoolYear=${encodeURIComponent(user.schoolYear || '2024-2025')}`,
        { headers: { 'x-user-id': user.id, 'x-institution-id': user.institutionId || '', 'x-user-role': user.role } },
        { ttl: 10_000 }
      )
      if (!res.ok) return
      const data = await res.json()
      const msgs: ChatMessagePayload[] = data.messages || []
      const map = new Map<string, ConvPreview>()
      for (const m of msgs) {
        const partnerId = m.senderId === user.id ? m.receiverId : m.senderId
        const partnerInfo = m.senderId === user.id ? m.receiver : m.sender
        if (!partnerInfo) continue
        const isUnread = !m.read && m.receiverId === user.id
        const existing = map.get(partnerId)
        if (!existing) {
          map.set(partnerId, {
            partnerId,
            partnerName: partnerInfo.name,
            partnerRole: partnerInfo.role,
            partnerAvatar: partnerInfo.avatar ?? null,
            lastMessage: m,
            unreadCount: isUnread ? 1 : 0,
          })
        } else {
          if (isUnread) existing.unreadCount += 1
        }
      }
      const list = Array.from(map.values())
        .sort((a, b) => {
          const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0
          const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0
          return tb - ta
        })
        .slice(0, 5)
      setConversations(list)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
    // 60s poll (was 30s) + skip when hidden → far fewer serverless calls.
    const interval = setInterval(() => fetchConversations(), 60_000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchConversations({ force: true })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchConversations])

  // Trigger an immediate fetch when the user ID changes (login / switch).
  // fetchConversations is stable (reads from ref), so we need this effect
  // to kick off the first load instead of waiting up to 60s for the interval.
  useEffect(() => {
    if (me?.id) fetchConversations()
  }, [me?.id, fetchConversations])

  // Real-time updates via chat socket (we only need connection state +
  // refresh on new message to keep the preview fresh)
  useChat({
    onMessage: () => {
      // Refresh the preview list when a new message arrives
      fetchConversations({ force: true })
    },
  })

  // Track connection state from the singleton socket
  useEffect(() => {
    let active = true
    import('socket.io-client').then(({ io }) => {
      if (!active) return
      const sock = io('/?XTransformPort=3004', {
        transports: ['websocket', 'polling'],
        forceNew: false,
        reconnection: true,
      })
      const onConn = () => active && setConnected(true)
      const onDis = () => active && setConnected(false)
      sock.on('connect', onConn)
      sock.on('disconnect', onDis)
      if (sock.connected) setConnected(true)
      // Don't close the socket — it's shared with the Messages page via
      // the useChat singleton. We only stop listening here.
      return () => {
        active = false
        sock.off('connect', onConn)
        sock.off('disconnect', onDis)
      }
    })
    return () => { active = false }
  }, [])

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0)

  // Super admin — hide the card entirely
  if (me?.role === 'super_admin') return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessagesSquare className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Messagerie
                {totalUnread > 0 && (
                  <Badge className="bg-destructive text-white text-[10px] h-5 px-1.5">
                    {totalUnread > 9 ? '9+' : totalUnread} non lu{totalUnread > 1 ? 's' : ''}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs flex items-center gap-1.5">
                <Circle className={cn('w-1.5 h-1.5', connected ? 'fill-emerald-500 text-emerald-500' : 'fill-muted-foreground text-muted-foreground')} />
                {connected ? 'Connecté en temps réel' : 'Reconnexion…'}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs shrink-0"
            onClick={() => setActiveModule('messages')}
          >
            Ouvrir
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <MessagesSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Aucune conversation pour le moment
            </p>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => setActiveModule('messages')}
            >
              <MessagesSquare className="w-3.5 h-3.5" />
              Démarrer une conversation
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="divide-y divide-border">
              {conversations.map((conv) => {
                const last = conv.lastMessage
                const preview = last
                  ? (last.senderId === me?.id ? 'Vous : ' : '') +
                    (last.content
                      ? last.content.replace(/<[^>]*>/g, '').slice(0, 50)
                      : last.attachmentType === 'image' ? '📷 Photo'
                      : last.attachmentType === 'video' ? '🎥 Vidéo'
                      : last.attachmentType === 'audio' ? '🎤 Audio'
                      : '📎 Pièce jointe')
                  : ''
                return (
                  <button
                    key={conv.partnerId}
                    onClick={() => setActiveModule('messages')}
                    className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-muted/40 -mx-2 px-2 rounded transition-colors"
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-9 w-9">
                        {conv.partnerAvatar && (
                          <AvatarImage src={avatarUrl(conv.partnerAvatar)} alt={conv.partnerName} />
                        )}
                        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                          {getInitials(conv.partnerName)}
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
                          {conv.partnerName}
                        </p>
                        {last && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatTime(last.createdAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {preview || 'Démarrez la conversation'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
