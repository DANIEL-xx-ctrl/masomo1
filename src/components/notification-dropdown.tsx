'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Bell,
  Check,
  CheckCircle,
  CreditCard,
  AlertTriangle,
  Info,
  XCircle,
  ClipboardCheck,
  Megaphone,
  Calendar,
  BookOpen,
  MessageSquare,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useAppStore } from '@/lib/store'
import { NOTIFICATION_TYPE_ICONS } from '@/lib/constants'
import { dedupedFetch, isTabHidden } from '@/lib/api-cache'
import type { Notification, NotificationType, ModuleKey } from '@/lib/types'

// Icon map for notification types
const NOTIFICATION_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  CreditCard,
  ClipboardCheck,
  Megaphone,
  Calendar,
  BookOpen,
  MessageSquare,
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays < 7) return `Il y a ${diffDays}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function getNotificationColor(type: NotificationType): string {
  const colors: Record<NotificationType, string> = {
    info: 'text-blue-500',
    warning: 'text-yellow-500',
    success: 'text-green-500',
    error: 'text-red-500',
    payment: 'text-emerald-500',
    attendance: 'text-orange-500',
    announcement: 'text-purple-500',
    event: 'text-teal-500',
    homework: 'text-violet-500',
    message: 'text-sky-500',
  }
  return colors[type] || 'text-blue-500'
}

export default function NotificationDropdown() {
  const { currentUser, setActiveModule } = useAppStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  // Keep the latest currentUser in a ref so the polling interval doesn't
  // reset every time the store updates the user object (e.g. on profile
  // refresh). This prevents the burst of re-fetches that caused the
  // Vercel "ResourceExhausted: container exceed concurrency threshold" error.
  const userRef = useRef(currentUser)
  useEffect(() => {
    userRef.current = currentUser
  }, [currentUser])

  const fetchNotifications = useCallback(async (opts?: { force?: boolean }) => {
    const user = userRef.current
    if (!user) return
    // Skip polling when the tab is hidden — the user can't see the bell
    // badge anyway, so we avoid spawning serverless invocations for nothing.
    if (!opts?.force && isTabHidden()) return
    try {
      if (opts?.force) setLoading(true)
      const res = await dedupedFetch(
        '/api/notifications?limit=30',
        {
          headers: {
            'x-user-id': user.id,
            'x-institution-id': user.institutionId || '',
            'x-user-role': user.role,
          },
        },
        // Cache for 10s so the interval poll + popover open + other
        // components all share one HTTP call.
        { ttl: 10_000 }
      )
      if (res.ok) {
        const json = await res.json()
        setNotifications(json.notifications || json.data || [])
        setUnreadCount(json.unreadCount || 0)
      }
    } catch {
      // Silently fail
    } finally {
      if (opts?.force) setLoading(false)
    }
  }, [])

  // Fetch on mount and periodically (60s instead of 30s to halve the
  // number of serverless invocations on Vercel).
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(() => fetchNotifications(), 60_000)

    // Refresh when the tab becomes visible again (catches notifications
    // that arrived while the user was away, without polling in the background).
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications({ force: true })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchNotifications])

  // Trigger an immediate fetch when the user ID changes (login / switch).
  // fetchNotifications is stable (reads from ref), so without this effect
  // the first load after login would wait up to 60s for the interval.
  useEffect(() => {
    if (currentUser?.id) fetchNotifications()
  }, [currentUser?.id, fetchNotifications])

  // Fetch when popover opens — but only if the cached data is older than
  // 10s (dedupedFetch handles this automatically via its TTL).
  useEffect(() => {
    if (open) fetchNotifications({ force: true })
  }, [open, fetchNotifications])

  const markAsRead = async (id: string) => {
    if (!currentUser) return
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-institution-id': currentUser.institutionId || '',
          'x-user-role': currentUser.role,
        },
        body: JSON.stringify({ read: true }),
      })
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch {
      // Silently fail
    }
  }

  const markAllAsRead = async () => {
    if (!currentUser) return
    try {
      const res = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: {
          'x-user-id': currentUser.id,
          'x-institution-id': currentUser.institutionId || '',
          'x-user-role': currentUser.role,
        },
      })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        setUnreadCount(0)
      }
    } catch {
      // Silently fail
    }
  }

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentUser) return
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser.id,
          'x-institution-id': currentUser.institutionId || '',
          'x-user-role': currentUser.role,
        },
      })
      if (res.ok) {
        const deleted = notifications.find((n) => n.id === id)
        setNotifications((prev) => prev.filter((n) => n.id !== id))
        if (deleted && !deleted.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1))
        }
      }
    } catch {
      // Silently fail
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      markAsRead(notification.id)
    }
    // If this is an announcement notification, also mark the announcement as read
    if (notification.category === 'announcement' && notification.linkParams && currentUser) {
      try {
        await fetch('/api/announcements/read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUser.id,
            'x-institution-id': currentUser.institutionId || '',
            'x-user-role': currentUser.role,
          },
          body: JSON.stringify({ announcementId: notification.linkParams }),
        })
      } catch {
        // silently fail
      }
    }
    // Navigate to linked module
    if (notification.link) {
      setActiveModule(notification.link as ModuleKey)
      setOpen(false)
    }
  }

  const getIcon = (type: NotificationType, customIcon?: string | null) => {
    const iconName = customIcon || NOTIFICATION_TYPE_ICONS[type] || 'Info'
    const IconComponent = NOTIFICATION_ICON_MAP[iconName]
    return IconComponent || Info
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative shrink-0">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] p-0 flex items-center justify-center text-[10px] bg-destructive text-white border-2 border-card">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[calc(100vw-2rem)] max-w-[380px] p-0 shadow-xl border-2"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-primary hover:text-primary/80"
              onClick={markAllAsRead}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Tout marquer lu
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <ScrollArea className="max-h-[400px]">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Aucune notification</p>
              <p className="text-xs mt-1">Vous êtes à jour !</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const IconComponent = getIcon(notification.type, notification.icon)
                const iconColor = getNotificationColor(notification.type)
                const hasAuthorAvatar = notification.authorAvatar
                const authorInitials = notification.authorName
                  ? notification.authorName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                  : null

                return (
                  <div
                    key={notification.id}
                    className={`
                      group relative flex items-start gap-3 px-4 py-3 cursor-pointer
                      transition-colors duration-150
                      ${!notification.read ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'}
                    `}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Unread indicator */}
                    {!notification.read && (
                      <div className="absolute left-1.5 top-4 w-2 h-2 rounded-full bg-primary" />
                    )}

                    {/* Icon / Avatar */}
                    {hasAuthorAvatar ? (
                      <div className="mt-0.5 shrink-0 relative">
                        <img
                          src={notification.authorAvatar!}
                          alt={notification.authorName || ''}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div className={`absolute -bottom-0.5 -right-0.5 ${iconColor} bg-card rounded-full p-0.5`}>
                          <IconComponent className="w-3 h-3" />
                        </div>
                      </div>
                    ) : authorInitials && (notification.category === 'announcement' || notification.category === 'homework') ? (
                      <div className="mt-0.5 shrink-0 relative">
                        <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                          {authorInitials}
                        </span>
                        <div className={`absolute -bottom-0.5 -right-0.5 ${iconColor} bg-card rounded-full p-0.5`}>
                          <IconComponent className="w-3 h-3" />
                        </div>
                      </div>
                    ) : (
                      <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${!notification.read ? 'font-semibold' : 'font-medium text-muted-foreground'}`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {notification.authorName && (
                          <span className="text-[10px] font-medium text-muted-foreground/80">
                            {notification.authorName}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/70">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            markAsRead(notification.id)
                          }}
                          title="Marquer comme lu"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => deleteNotification(notification.id, e)}
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t px-4 py-2 bg-muted/30">
            <p className="text-[10px] text-muted-foreground text-center">
              Cliquez sur une notification pour naviguer vers le module concerné
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
