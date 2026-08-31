'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  School,
  CalendarDays,
  FileText,
  ClipboardList,
  CreditCard,
  MessageSquare,
  MessagesSquare,
  Settings,
  Menu,
  LogOut,
  ChevronLeft,
  X,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Heart,
  Briefcase,
  BookOpen,
  Shield,
  ClipboardCheck,
  Calendar,
  Radio,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/lib/store'
import { useTheme } from 'next-themes'
import { NAV_ITEMS, ROLE_LABELS } from '@/lib/constants'
import { avatarUrl } from '@/lib/utils'
import { useOfflineStatus } from '@/hooks/use-offline'
import { onAvatarChanged } from '@/hooks/use-avatar-refresh'
import type { ModuleKey } from '@/lib/types'
import NotificationDropdown from '@/components/notification-dropdown'
import { OfflineBadge } from '@/components/offline-badge'
import Dashboard from './modules/dashboard'
import StudentsModule from './modules/students'
import TeachersModule from './modules/teachers'
import ClassesModule from './modules/classes'
import ScheduleModule from './modules/schedule'
import GradesModule from './modules/grades'
import BulletinsModule from './modules/bulletins'
import PaymentsModule from './modules/payments'
import CommunicationModule from './modules/communication'
import MessagesModule from './modules/messages'
import ParentsModule from './modules/parents'
import StaffModule from './modules/staff'
import HomeworkModule from './modules/homework'
import AttendanceModule from './modules/attendance'
import SchoolCalendarModule from './modules/school-calendar'
import SuperAdminModule from './modules/super-admin'
import SettingsModule from './modules/settings'
import ConnectedUsersModule from './modules/connected-users'
import RealtimePresenceProvider from './realtime-presence-provider'
import { InstitutionBadge } from './institution-badge'
import { SchoolYearSelector } from './school-year-selector'

// Icon mapping
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  GraduationCap,
  Users,
  School,
  CalendarDays,
  FileText,
  ClipboardList,
  CreditCard,
  MessageSquare,
  MessagesSquare,
  Settings,
  Heart,
  Briefcase,
  BookOpen,
  Shield,
  ClipboardCheck,
  Calendar,
  Radio,
}

// Module title mapping
const MODULE_TITLES: Record<ModuleKey, string> = {
  dashboard: 'Tableau de bord',
  students: 'Gestion des élèves',
  teachers: 'Gestion des enseignants',
  parents: 'Gestion des parents',
  staff: 'Gestion du personnel',
  classes: 'Gestion des classes',
  schedule: 'Emploi du temps',
  grades: 'Gestion des notes',
  bulletins: 'Bulletins scolaires',
  attendance: 'Gestion de la présence',
  homework: 'Gestion des devoirs',
  payments: 'Gestion des paiements',
  communication: 'Communication',
  messages: 'Messagerie',
  'school-calendar': 'Calendrier scolaire',
  'super-admin': 'Super Administrateur',
  'online-users': 'Utilisateurs connectés',
  settings: 'Paramètres',
}

function SidebarNav({
  activeModule,
  onNavigate,
  collapsed,
  userRole,
}: {
  activeModule: ModuleKey
  onNavigate: (key: ModuleKey) => void
  collapsed: boolean
  userRole: string | undefined
}) {
  // Filter nav items by role:
  //  - 'super-admin' module is only for super_admin
  //  - 'online-users' module is only for admin + super_admin
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.key === 'super-admin') return userRole === 'super_admin'
    if (item.key === 'online-users') return userRole === 'admin' || userRole === 'super_admin'
    return true
  })
  return (
    <nav className="flex-1 py-4 px-3 space-y-1">
      {visibleItems.map((item) => {
        const Icon = ICON_MAP[item.icon]
        const isActive = activeModule === item.key
        return (
          <TooltipProvider key={item.key} delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onNavigate(item.key)}
                  className={`
                    w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                    ${
                      isActive
                        ? 'bg-primary/10 text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }
                    ${collapsed ? 'justify-center px-2' : ''}
                  `}
                >
                  {Icon && <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary' : ''}`} />}
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {isActive && !collapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </nav>
  )
}

export default function AppShell() {
  const { activeModule, setActiveModule, currentUser, logout, sidebarOpen, toggleSidebar, setSidebarOpen, login: updateStoreUser, schoolYear } = useAppStore()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Wrapper around store logout that also clears the Service Worker
  // API cache so the next user doesn't get stale responses.
  const handleLogout = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage('CLEAR_API_CACHE')
    }
    logout()
  }, [logout])

  // Refresh the current user's profile from the API on mount so the
  // persisted Zustand state (avatar, name, role, etc.) stays in sync
  // with the latest DB values — e.g. after the user changed their
  // avatar or password from another tab or from the Settings page.
  useEffect(() => {
    if (!currentUser?.id) return
    // Capture the user id at the time the effect starts. If the user logs
    // out and logs in as someone else WHILE this fetch is in flight, the
    // store's currentUser will have a different id — we must discard the
    // stale response, otherwise we'd overwrite the new user with the old
    // user's profile data (the root cause of the "student dashboard shown
    // after admin login" bug).
    const expectedUserId = currentUser.id
    let cancelled = false
    async function refreshProfile() {
      try {
        if (currentUser.role === 'super_admin') {
          // Super admin profile lives in a separate table — use the dedicated endpoint.
          const res = await fetch('/api/super-admin/profile', { cache: 'no-store' })
          if (!res.ok) return
          const data = await res.json()
          if (cancelled || !data?.superAdmin) return
          // GUARD 1: Has the logged-in user changed while we were waiting?
          const latestUser = useAppStore.getState().currentUser
          if (!latestUser || latestUser.id !== expectedUserId) return
          // GUARD 2: Does the response actually belong to this user?
          if (data.superAdmin.id && data.superAdmin.id !== expectedUserId) return
          updateStoreUser({
            ...currentUser,
            name: data.superAdmin.name,
            email: data.superAdmin.email,
            phone: data.superAdmin.phone ?? null,
            avatar: data.superAdmin.avatar ?? null,
            updatedAt: data.superAdmin.updatedAt ?? currentUser.updatedAt,
          })
        } else {
          // Regular user (admin / teacher / student / parent / staff)
          const res = await fetch('/api/auth/profile', { cache: 'no-store' })
          if (!res.ok) return
          const data = await res.json()
          if (cancelled || !data?.user) return
          // GUARD 1: Has the logged-in user changed while we were waiting?
          const latestUser = useAppStore.getState().currentUser
          if (!latestUser || latestUser.id !== expectedUserId) return
          // GUARD 2: Does the response actually belong to this user?
          if (data.user.id && data.user.id !== expectedUserId) return
          // Merge fresh fields into the existing currentUser so we keep
          // optional relation fields (student/teacher/parent/staff) that
          // /api/auth/profile doesn't return.
          //
          // CRITICAL: preserve `institutionName` from the existing currentUser
          // when the profile response doesn't include it. Without this explicit
          // preservation, `...data.user` would overwrite `institutionName` with
          // `undefined`, causing the institution name to disappear from the UI
          // (and from payment receipts) after the profile refresh on mount.
          updateStoreUser({
            ...currentUser,
            ...data.user,
            avatar: data.user.resolvedAvatar ?? data.user.avatar ?? currentUser.avatar,
            updatedAt: data.user.updatedAt ?? currentUser.updatedAt,
            institutionName: data.user.institutionName ?? currentUser.institutionName ?? null,
          })
        }
      } catch {
        // Silent — keep the persisted currentUser as-is on error
      }
    }
    refreshProfile()
    return () => { cancelled = true }
  }, [currentUser?.id])

  // Listen for avatar-changed events dispatched from anywhere in the app
  // (Settings page, student/teacher/parent edit dialogs, etc.) and refresh
  // the current user's profile so the header / sidebar avatar updates
  // immediately with a cache-busted URL.
  useEffect(() => {
    if (!currentUser?.id) return
    const expectedUserId = currentUser.id
    let cancelled = false
    async function refreshProfile() {
      try {
        if (currentUser.role === 'super_admin') {
          const res = await fetch('/api/super-admin/profile', { cache: 'no-store' })
          if (!res.ok) return
          const data = await res.json()
          if (cancelled || !data?.superAdmin) return
          // GUARD: discard if the logged-in user has changed or the response
          // belongs to a different user.
          const latestUser = useAppStore.getState().currentUser
          if (!latestUser || latestUser.id !== expectedUserId) return
          if (data.superAdmin.id && data.superAdmin.id !== expectedUserId) return
          updateStoreUser({
            ...currentUser,
            name: data.superAdmin.name,
            email: data.superAdmin.email,
            phone: data.superAdmin.phone ?? null,
            avatar: data.superAdmin.avatar ?? null,
            updatedAt: data.superAdmin.updatedAt ?? currentUser.updatedAt,
          })
        } else {
          const res = await fetch('/api/auth/profile', { cache: 'no-store' })
          if (!res.ok) return
          const data = await res.json()
          if (cancelled || !data?.user) return
          // GUARD: discard if the logged-in user has changed or the response
          // belongs to a different user.
          const latestUser = useAppStore.getState().currentUser
          if (!latestUser || latestUser.id !== expectedUserId) return
          if (data.user.id && data.user.id !== expectedUserId) return
          updateStoreUser({
            ...currentUser,
            ...data.user,
            avatar: data.user.resolvedAvatar ?? data.user.avatar ?? currentUser.avatar,
            updatedAt: data.user.updatedAt ?? currentUser.updatedAt,
            institutionName: data.user.institutionName ?? currentUser.institutionName ?? null,
          })
        }
      } catch {
        // Silent — keep the persisted currentUser as-is on error
      }
    }
    const off = onAvatarChanged(() => {
      refreshProfile()
    })
    return () => { cancelled = true; off() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  // Close mobile sidebar on navigation
  const handleNavigate = (key: ModuleKey) => {
    setActiveModule(key)
    setMobileOpen(false)
  }

  // Get initials for avatar
  const initials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U'

  // Render the active module
  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <Dashboard />
      case 'students':
        return <StudentsModule />
      case 'teachers':
        return <TeachersModule />
      case 'classes':
        return <ClassesModule />
      case 'schedule':
        return <ScheduleModule />
      case 'grades':
        return <GradesModule />
      case 'bulletins':
        return <BulletinsModule />
      case 'attendance':
        return <AttendanceModule />
      case 'payments':
        return <PaymentsModule />
      case 'communication':
        return <CommunicationModule />
      case 'messages':
        return <MessagesModule />
      case 'parents':
        return <ParentsModule />
      case 'staff':
        return <StaffModule />
      case 'homework':
        return <HomeworkModule />
      case 'school-calendar':
        return <SchoolCalendarModule />
      case 'super-admin':
        return <SuperAdminModule />
      case 'online-users':
        return <ConnectedUsersModule />
      case 'settings':
        return <SettingsModule />
      default:
        return <Dashboard />
    }
  }

  const { isOnline, wasOffline } = useOfflineStatus()
  const { theme, setTheme } = useTheme()

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Offline Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500 text-amber-950 text-center text-sm font-medium overflow-hidden"
          >
            <div className="py-2 px-4 flex items-center justify-center gap-2">
              <WifiOff className="w-4 h-4" />
              <span>Mode hors ligne — Certaines fonctionnalités peuvent être limitées</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Back Online Toast */}
      <AnimatePresence>
        {wasOffline && isOnline && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium"
          >
            <Wifi className="w-4 h-4" />
            <span>Connexion rétablie</span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
          <SheetHeader className="p-4 pb-0">
            <SheetTitle className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                MASOMO
              </span>
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 h-[calc(100vh-12rem)]">
            <SidebarNav
              activeModule={activeModule}
              onNavigate={handleNavigate}
              collapsed={false}
              userRole={currentUser?.role}
            />
          </ScrollArea>
          {/* Mobile user section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                {currentUser?.avatar && (
                  <AvatarImage src={avatarUrl(currentUser.avatar, currentUser.updatedAt)} alt={currentUser.name} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{currentUser?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {currentUser?.role ? ROLE_LABELS[currentUser.role] : ''}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="shrink-0 text-muted-foreground hover:text-destructive">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside
          className={`
            hidden lg:flex flex-col border-r border-sidebar-border bg-sidebar
            transition-all duration-300 ease-in-out shrink-0
            ${collapsed ? 'w-[72px]' : 'w-64'}
          `}
        >
          {/* Sidebar Header */}
          <div className={`flex items-center h-16 px-4 border-b border-sidebar-border ${collapsed ? 'justify-center' : 'justify-between'}`}>
            {!collapsed && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  MASOMO
                </span>
              </div>
            )}
            {collapsed && (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
            )}
            {!collapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(true)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Sidebar Navigation */}
          <ScrollArea className="flex-1">
            <SidebarNav
              activeModule={activeModule}
              onNavigate={handleNavigate}
              collapsed={collapsed}
              userRole={currentUser?.role}
            />
          </ScrollArea>

          {/* Collapse toggle when collapsed */}
          {collapsed && (
            <div className="px-3 py-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(false)}
                className="w-full h-9 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="w-4 h-4 rotate-180" />
              </Button>
            </div>
          )}

          {/* Desktop User Section */}
          <div className={`border-t border-sidebar-border p-3 ${collapsed ? 'px-2' : ''}`}>
            <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
              <Avatar className="h-9 w-9 shrink-0">
                {currentUser?.avatar && (
                  <AvatarImage src={avatarUrl(currentUser.avatar, currentUser.updatedAt)} alt={currentUser.name} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{currentUser?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentUser?.role ? ROLE_LABELS[currentUser.role] : ''}
                  </p>
                </div>
              )}
              {!collapsed && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </aside>

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-16 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-30 flex items-center px-3 sm:px-4 lg:px-6 gap-2 sm:gap-4">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Page title + Institution badge */}
            <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3">
              <h1 className="text-base sm:text-lg font-semibold truncate">
                {MODULE_TITLES[activeModule]}
              </h1>
              <InstitutionBadge />
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* School Year Selector */}
              <SchoolYearSelector />

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 transition-colors duration-300"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
              </Button>

              {/* Notifications — live badge + dropdown fed by /api/notifications.
                  Renders homework, announcement, payment, attendance & event
                  notifications. The unread count drives the red badge. */}
              <NotificationDropdown />

              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 h-9 px-2">
                    <Avatar className="h-8 w-8">
                      {currentUser?.avatar && (
                        <AvatarImage src={avatarUrl(currentUser.avatar, currentUser.updatedAt)} alt={currentUser.name} />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate">
                      {currentUser?.name}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <div className="px-2 py-2 flex items-center gap-3">
                    <Avatar className="h-11 w-11 ring-2 ring-primary/10">
                      {currentUser?.avatar && (
                        <AvatarImage src={avatarUrl(currentUser.avatar, currentUser.updatedAt)} alt={currentUser.name} />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{currentUser?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{currentUser?.email}</p>
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        {currentUser?.role ? ROLE_LABELS[currentUser.role] : ''}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActiveModule('settings')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Paramètres
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            {/* Real-time presence reporter + DB heartbeat for the current user */}
            <RealtimePresenceProvider />
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {renderModule()}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Footer */}
          <footer className="border-t bg-card/50 px-4 lg:px-6 py-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground text-center">
                © 2024 MASOMO — Système de Gestion Scolaire
              </p>
              {schoolYear && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <CalendarDays className="w-3 h-3" />
                  Année scolaire : <span className="font-semibold text-primary">{schoolYear}</span>
                </p>
              )}
            </div>
          </footer>
        </div>
      </div>

      {/* Floating offline/queue badge (write-behind indicator) */}
      <OfflineBadge />
    </div>
  )
}
