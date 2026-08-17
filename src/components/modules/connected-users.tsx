'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Radio,
  Search,
  RefreshCw,
  Wifi,
  WifiOff,
  Users,
  GraduationCap,
  Heart,
  Briefcase,
  Shield,
  UserCog,
  Clock,
  Building2,
  CircleDot,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { usePresence, type PresenceUser } from '@/hooks/use-presence'
import { ROLE_LABELS } from '@/lib/constants'
import type { UserRole } from '@/lib/types'
import { avatarUrl } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ---------- Role metadata ----------
const ROLE_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }
> = {
  super_admin: {
    label: 'Super Admins',
    icon: Shield,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900',
  },
  admin: {
    label: 'Administrateurs',
    icon: UserCog,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900',
  },
  teacher: {
    label: 'Enseignants',
    icon: Users,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900',
  },
  student: {
    label: 'Élèves',
    icon: GraduationCap,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900',
  },
  parent: {
    label: 'Parents',
    icon: Heart,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900',
  },
  staff: {
    label: 'Personnel',
    icon: Briefcase,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900',
  },
}

function roleMeta(role: string) {
  return ROLE_META[role] || {
    label: role,
    icon: CircleDot,
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800',
  }
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'
}

function timeAgo(ts: number) {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  return `${days} j`
}

// ---------- Main component ----------

export default function ConnectedUsersModule() {
  const currentUser = useAppStore((s) => s.currentUser)
  const addToast = useAppStore((s) => s.addToast)
  const isSuperAdmin = currentUser?.role === 'super_admin'
  const isAdmin = currentUser?.role === 'admin' || isSuperAdmin

  const { snapshot, connected, refresh } = usePresence({ subscribe: true })

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // Derive last-updated timestamp from the latest snapshot (avoids
  // calling setState synchronously inside an effect).
  const lastUpdated = useMemo<Date | null>(
    () => (snapshot ? new Date() : null),
    [snapshot]
  )

  // Fallback: if socket is not connected, poll /api/sessions?online=true
  const [fallbackUsers, setFallbackUsers] = useState<PresenceUser[] | null>(null)
  const fetchFallback = useCallback(async () => {
    // Skip when tab is hidden — the user isn't viewing this module anyway.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    try {
      const res = await fetch('/api/sessions?online=true', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const rows: PresenceUser[] = (data.sessions || []).map((s: { user: Record<string, unknown>; updatedAt: string; createdAt: string }) => {
        const u = s.user as {
          id: string; name: string; email: string; role: string;
          userCode: string | null; avatar: string | null;
          institutionId: string | null; institution?: { name: string } | null;
        }
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          userCode: u.userCode,
          institutionId: u.institutionId,
          institutionName: u.institution?.name || null,
          avatar: u.avatar,
          connectedAt: new Date(s.createdAt).getTime(),
          lastSeen: new Date(s.updatedAt).getTime(),
        }
      })
      setFallbackUsers(rows)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    // Only poll the fallback if the live socket feed is unavailable.
    // When `connected` is true the socket events keep the snapshot fresh
    // and the fallback data is ignored by the users useMemo below.
    if (connected) return
    // Defer the first fetch slightly so we don't call setState synchronously
    // inside this effect body (which would trigger a cascading-render warning).
    const firstLoad = setTimeout(fetchFallback, 100)
    // 15s fallback poll (was 5s) — reduces serverless load while the socket
    // is reconnecting. The socket itself is the primary real-time source.
    const id = setInterval(fetchFallback, 15_000)
    return () => {
      clearTimeout(firstLoad)
      clearInterval(id)
    }
  }, [connected, fetchFallback])

  const users = useMemo<PresenceUser[]>(() => {
    if (connected && snapshot) return snapshot.users
    if (!connected && fallbackUsers) return fallbackUsers
    return []
  }, [connected, snapshot, fallbackUsers])

  // ---- Filter ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (!q) return true
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.userCode || '').toLowerCase().includes(q) ||
        (u.institutionName || '').toLowerCase().includes(q)
      )
    })
  }, [users, search, roleFilter])

  // ---- Group by role ----
  const grouped = useMemo(() => {
    const map = new Map<string, PresenceUser[]>()
    for (const u of filtered) {
      const arr = map.get(u.role) || []
      arr.push(u)
      map.set(u.role, arr)
    }
    // Sort groups by canonical role order
    const order = ['super_admin', 'admin', 'teacher', 'student', 'parent', 'staff']
    return order
      .filter((r) => map.has(r))
      .map((r) => ({ role: r, users: map.get(r)! }))
      .concat(
        Array.from(map.entries())
          .filter(([r]) => !order.includes(r))
          .map(([role, users]) => ({ role, users }))
      )
  }, [filtered])

  const byRole = useMemo(() => {
    const m: Record<string, number> = {}
    for (const u of users) m[u.role] = (m[u.role] || 0) + 1
    return m
  }, [users])

  const handleRefresh = () => {
    refresh()
    fetchFallback()
    addToast('info', 'Rafraîchi', 'Liste des utilisateurs connectés mise à jour')
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
          Accès réservé aux administrateurs.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-500" />
            Utilisateurs connectés en temps réel
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Vue instantanée de tous les rôles connectés
            {isSuperAdmin ? ' (toutes institutions)' : ' (votre établissement)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={connected ? 'default' : 'secondary'} className="gap-1">
            {connected ? (
              <>
                <Wifi className="w-3 h-3" /> Temps réel
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" /> Mode secours
              </>
            )}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stat cards per role */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(['super_admin', 'admin', 'teacher', 'student', 'parent', 'staff'] as UserRole[]).map((r) => {
          const meta = roleMeta(r)
          const Icon = meta.icon
          const count = byRole[r] || 0
          return (
            <Card
              key={r}
              className={`border ${meta.bg} transition-shadow hover:shadow-md`}
            >
              <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center">
                <Icon className={`w-5 h-5 mb-1.5 ${meta.color}`} />
                <div className="text-2xl font-bold leading-none">{count}</div>
                <div className="text-[11px] text-muted-foreground mt-1 leading-tight">
                  {ROLE_LABELS[r]}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Total + last updated */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-medium">
          Total connectés : <span className="text-foreground">{users.length}</span>
        </span>
        {lastUpdated && (
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Dernière maj : {lastUpdated.toLocaleTimeString('fr-FR')}
          </span>
        )}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, code ou établissement..."
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Tous les rôles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            <SelectItem value="super_admin">Super Admins</SelectItem>
            <SelectItem value="admin">Administrateurs</SelectItem>
            <SelectItem value="teacher">Enseignants</SelectItem>
            <SelectItem value="student">Élèves</SelectItem>
            <SelectItem value="parent">Parents</SelectItem>
            <SelectItem value="staff">Personnel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {!connected && fallbackUsers === null ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
            Aucun utilisateur connecté ne correspond à votre filtre.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => {
            const meta = roleMeta(group.role)
            const Icon = meta.icon
            return (
              <div key={group.role}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                  <h3 className="text-sm font-semibold">{meta.label}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {group.users.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <AnimatePresence mode="popLayout">
                    {group.users
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((u) => (
                        <motion.div
                          key={u.userId}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Card className="overflow-hidden hover:shadow-md transition-shadow">
                            <CardContent className="p-3 sm:p-4 flex items-start gap-3">
                              <div className="relative shrink-0">
                                <Avatar className="h-10 w-10">
                                  {u.avatar ? (
                                    <AvatarImage src={avatarUrl(u.avatar, u.lastSeen)} alt={u.name} />
                                  ) : null}
                                  <AvatarFallback className={`text-xs font-semibold ${meta.bg}`}>
                                    {initials(u.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{u.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {u.email}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  {u.userCode && (
                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                      {u.userCode}
                                    </Badge>
                                  )}
                                  {isSuperAdmin && u.institutionName && (
                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 gap-1">
                                      <Building2 className="w-2.5 h-2.5" />
                                      {u.institutionName}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  Connecté depuis {timeAgo(u.connectedAt)}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                  </AnimatePresence>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pt-2">
        Les mises à jour sont diffusées en direct via WebSocket (port 3003). Si la
        connexion temps réel est perdue, une liste de secours est interrogée toutes
        les 5 secondes.
      </p>
    </div>
  )
}
