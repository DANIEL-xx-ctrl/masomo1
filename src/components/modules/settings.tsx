'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  User,
  Building,
  Building2,
  Palette,
  Database,
  Info,
  Sun,
  Moon,
  Monitor,
  Loader2,
  Shield,
  Mail,
  Phone,
  Calendar,
  Download,
  FileArchive,
  Package,
  Key,
  Eye,
  EyeOff,
  Save,
  Trash2,
  Pencil,
  Plus,
  Users,
  Search,
  Lock,
  AlertTriangle,
  Check,
  CheckCircle2,
  RefreshCw,
  X,
  Clock,
  GraduationCap,
  BookOpen,
  Briefcase,
  UserCog,
  Hash,
  Copy,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAppStore } from '@/lib/store'
import { ROLE_LABELS, ROLES } from '@/lib/constants'
import type { UserRole } from '@/lib/types'
import { useTheme } from 'next-themes'
import { seedApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import ImageDropZone from '@/components/image-dropzone'
import { notifyAvatarChanged } from '@/hooks/use-avatar-refresh'

// ============================================================
// Types
// ============================================================

interface InstitutionData {
  id: string
  name: string
  password: string
  address: string | null
  phone: string | null
  email: string | null
  logo: string | null
  currentYear: string
  active: boolean
  _count?: { users: number; classes: number }
}

interface UserWithPassword {
  id: string
  userCode: string | null
  email: string
  name: string
  role: string
  phone: string | null
  active: boolean
  avatar: string | null
  password: string
  passwordStatus: 'none' | 'default' | 'custom'
  createdAt: string
  student?: { firstName: string; lastName: string; image: string | null; class: { name: string } | null }
  teacher?: { firstName: string; lastName: string; subject: string; image: string | null }
  staff?: { firstName: string; lastName: string; fonction: string | null; image: string | null }
}

// ============================================================
// Animation variants
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

// ============================================================
// Main Component
// ============================================================

export default function SettingsModule() {
  const { currentUser, schoolYear, login: updateStoreUser, activeInstitutionId } = useAppStore()
  const { theme, setTheme } = useTheme()
  const [downloadingSource, setDownloadingSource] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<string>('')

  // ---- Per-institution data management state ----
  // Three distinct actions, each with its own confirmation dialog:
  //   A) Reset THIS institution (wipe + reseed, preserves admin)
  //   B) Clear THIS institution's data (wipe only, preserves admin + institution)
  //   C) Reset EVERYTHING (global wipe + reseed, super_admin only, requires typing "RESET")
  const [resetInstitutionOpen, setResetInstitutionOpen] = useState(false)
  const [clearInstitutionOpen, setClearInstitutionOpen] = useState(false)
  const [resetAllOpen, setResetAllOpen] = useState(false)
  const [resetAllConfirm, setResetAllConfirm] = useState('')
  const [resetInstitutionLoading, setResetInstitutionLoading] = useState(false)
  const [clearInstitutionLoading, setClearInstitutionLoading] = useState(false)
  const [resetAllLoading, setResetAllLoading] = useState(false)
  const [buildMeta, setBuildMeta] = useState<{
    fileCount: number
    lastModified: string | null
    version: string
    filename: string
    rawSizeBytes?: number
  } | null>(null)

  // Human-readable size (e.g. "5.4 MB") built from buildMeta.rawSizeBytes.
  const rawSizeLabel = (() => {
    const bytes = buildMeta?.rawSizeBytes
    if (!bytes || bytes <= 0) return null
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  })()

  // Relative "freshness" label (e.g. "modifié il y a 5 min") derived from
  // buildMeta.lastModified (mtime of the src/ tree). We do NOT show an
  // absolute date because that has historically confused users — a relative
  // hint makes it obvious that the archive reflects the current state.
  const freshnessLabel = (() => {
    const iso = buildMeta?.lastModified
    if (!iso) return null
    const t = Date.parse(iso)
    if (Number.isNaN(t)) return null
    const diffMs = Date.now() - t
    const sec = Math.max(0, Math.round(diffMs / 1000))
    if (sec < 60) return 'modifié à l’instant'
    const min = Math.round(sec / 60)
    if (min < 60) return `modifié il y a ${min} min`
    const hr = Math.round(min / 60)
    if (hr < 24) return `modifié il y a ${hr} h`
    const day = Math.round(hr / 24)
    return `modifié il y a ${day} j`
  })()

  const isAdmin =
    currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const initials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U'

  // Fetch live build metadata (file count, last-modified, version) so the
  // download card always reflects the current state of the source code.
  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    fetch('/api/download/source-code/meta')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.fileCount === 'number') {
          setBuildMeta(data)
        }
      })
      .catch(() => {
        /* non-fatal — UI falls back to static labels */
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const handleDownloadSource = async () => {
    setDownloadingSource(true)
    setDownloadProgress('Préparation de l’archive…')
    try {
      const response = await fetch('/api/download/source-code', { method: 'GET' })

      if (!response.ok) {
        let message = 'Échec du téléchargement.'
        try {
          const data = await response.json()
          if (data?.error) message = data.error
        } catch {
          /* ignore parse errors */
        }
        throw new Error(message)
      }

      setDownloadProgress('Compression terminée, récupération du fichier…')

      const blob = await response.blob()
      const sizeMb = (blob.size / (1024 * 1024)).toFixed(2)

      let filename = 'MASOMO_Source_Complet.zip'
      const disposition = response.headers.get('Content-Disposition')
      if (disposition) {
        const match = disposition.match(/filename\*?=([^;]+)/i)
        if (match) {
          filename = decodeURIComponent(match[1].replace(/^["']|["']$/g, ''))
        }
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      toast.success('Code source téléchargé', {
        description: `${filename} (${sizeMb} MB) — inclut toutes les dernières modifications.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Téléchargement impossible', { description: msg })
    } finally {
      setDownloadingSource(false)
      setDownloadProgress('')
    }
  }

  // ---- Effective institution context ----
  // For an admin: their own institutionId (always set).
  // For a super_admin: the institution they're currently browsing (from the
  // store). If none, institution-scoped actions are disabled.
  const isSuperAdmin = currentUser?.role === 'super_admin'
  const effectiveInstitutionId = isSuperAdmin
    ? activeInstitutionId
    : currentUser?.institutionId || null
  const canManageInstitution =
    (currentUser?.role === 'admin' || isSuperAdmin) && !!effectiveInstitutionId

  // ---- Action A: Reset THIS institution (wipe + reseed) ----
  const handleResetInstitution = async () => {
    if (!effectiveInstitutionId) return
    setResetInstitutionLoading(true)
    try {
      const res = await fetch(
        `/api/institutions/${effectiveInstitutionId}/seed`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Erreur serveur (${res.status})`)
      }
      const data = await res.json().catch(() => ({}))
      const stats = data?.stats
      const detail = stats
        ? `${stats.students || 0} élèves, ${stats.teachers || 0} enseignants, ${stats.classes || 0} classes`
        : 'nouvelles données de démonstration créées'
      toast.success('Institution réinitialisée', {
        description: detail,
      })
      setResetInstitutionOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur lors de la réinitialisation', { description: msg })
    } finally {
      setResetInstitutionLoading(false)
    }
  }

  // ---- Action B: Clear THIS institution's data (wipe only) ----
  const handleClearInstitution = async () => {
    if (!effectiveInstitutionId) return
    setClearInstitutionLoading(true)
    try {
      const res = await fetch(
        `/api/institutions/${effectiveInstitutionId}/data`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Erreur serveur (${res.status})`)
      }
      toast.success('Données effacées', {
        description: "L'institution est maintenant vide. Vous pouvez la remplir via « Réinitialiser cette institution » ou manuellement.",
      })
      setClearInstitutionOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur lors de l\'effacement', { description: msg })
    } finally {
      setClearInstitutionLoading(false)
    }
  }

  // ---- Action C: Reset EVERYTHING (global wipe + reseed, super_admin only) ----
  const handleResetAll = async () => {
    if (resetAllConfirm !== 'RESET') {
      toast.error('Confirmation requise', {
        description: 'Veuillez taper RESET pour confirmer la réinitialisation complète.',
      })
      return
    }
    setResetAllLoading(true)
    try {
      await seedApi.seedDatabase()
      toast.success('Base de données entièrement réinitialisée', {
        description: 'Toutes les institutions ont été recréées avec les données de démonstration par défaut.',
      })
      setResetAllOpen(false)
      setResetAllConfirm('')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Erreur lors de la réinitialisation'
      toast.error('Erreur', { description: msg })
    } finally {
      setResetAllLoading(false)
    }
  }

  const themeOptions = [
    { value: 'light', label: 'Clair', icon: Sun },
    { value: 'dark', label: 'Sombre', icon: Moon },
    { value: 'system', label: 'Système', icon: Monitor },
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto space-y-6"
    >
      <motion.div variants={itemVariants} className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-600" />
          Paramètres
        </h1>
        <p className="text-sm text-muted-foreground">
          Gérez votre profil, votre institution et les mots de passe des utilisateurs.
        </p>
      </motion.div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className={`grid w-full h-auto gap-1 ${isAdmin ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1'}`}>
          <TabsTrigger value="profile" className="py-2 px-1 sm:px-2 min-w-0 justify-center">
            <User className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate">Mon profil</span>
            <span className="sm:hidden truncate">Profil</span>
          </TabsTrigger>
          <TabsTrigger value="institution" className="py-2 px-1 sm:px-2 min-w-0 justify-center" disabled={!isAdmin}>
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate">Institution</span>
            <span className="sm:hidden truncate">Inst.</span>
          </TabsTrigger>
          <TabsTrigger value="passwords" className="py-2 px-1 sm:px-2 min-w-0 justify-center" disabled={!isAdmin}>
            <Key className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate">Mots de passe</span>
            <span className="sm:hidden truncate">MDP</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="py-2 px-1 sm:px-2 min-w-0 justify-center" disabled={!isAdmin}>
            <Palette className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate">Système</span>
            <span className="sm:hidden truncate">Syst.</span>
          </TabsTrigger>
        </TabsList>

        {/* ---------- Profile Tab ---------- */}
        <TabsContent value="profile" className="space-y-6 mt-6">
          <ProfileSection
            currentUser={currentUser}
            initials={initials}
            updateStoreUser={updateStoreUser}
          />
          <SelfPasswordSection currentUser={currentUser} />
        </TabsContent>

        {/* ---------- Institution Tab ---------- */}
        <TabsContent value="institution" className="space-y-6 mt-6">
          <InstitutionSection currentUser={currentUser} />
        </TabsContent>

        {/* ---------- Passwords Tab ---------- */}
        <TabsContent value="passwords" className="space-y-6 mt-6">
          {isAdmin ? (
            <>
              <RolePasswordsSection
                currentUserId={currentUser?.id || ''}
                currentUserRole={currentUser?.role || ''}
              />
              <UsersPasswordSection currentUserId={currentUser?.id || ''} />
            </>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                <Lock className="w-10 h-10 mx-auto mb-3 opacity-50" />
                Seul un administrateur peut gérer les mots de passe des autres utilisateurs.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ---------- System Tab ---------- */}
        <TabsContent value="system" className="space-y-6 mt-6">
          {/* Theme */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Palette className="w-5 h-5 text-purple-600" />
                  Apparence
                </CardTitle>
                <CardDescription>Personnalisez l&apos;affichage de l&apos;application</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Label>Thème</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {themeOptions.map((opt) => {
                      const Icon = opt.icon
                      const isActive = theme === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setTheme(opt.value)}
                          className={`
                            flex flex-col items-center gap-2 rounded-xl p-4 border-2 transition-all
                            ${isActive
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-muted hover:border-primary/30 hover:bg-accent/50'
                            }
                          `}
                        >
                          <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                            {opt.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Data Management — 3 distinct actions */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="w-5 h-5 text-amber-600" />
                  Gestion des données
                </CardTitle>
                <CardDescription>
                  Réinitialisez, effacez ou recréez les données — au niveau de cette institution ou de toute la base.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* ---- Action A: Reset THIS institution (wipe + reseed) ---- */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-amber-100 dark:bg-amber-900/40 p-2 ring-1 ring-amber-300/50">
                      <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {isSuperAdmin ? 'Réinitialiser cette institution' : 'Réinitialiser ma base de données'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {isSuperAdmin ? (
                          <>Efface et recrée les données de démonstration pour <strong>cette institution uniquement</strong>. Votre compte admin est conservé.</>
                        ) : (
                          <>Efface et recrée les données de démonstration pour <strong>VOTRE établissement uniquement</strong>. Votre compte admin est conservé.</>
                        )}
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Les autres établissements ne seront PAS affectés.
                      </p>
                      {isSuperAdmin && !effectiveInstitutionId && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Ouvrez d&apos;abord une institution dans le module Super Admin pour activer cette action.
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setResetInstitutionOpen(true)}
                    disabled={!canManageInstitution || resetInstitutionLoading}
                    className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950 shrink-0"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {isSuperAdmin ? 'Réinitialiser cette institution' : 'Réinitialiser ma base'}
                  </Button>
                </div>

                {/* ---- Action B: Clear THIS institution's data (wipe only) ---- */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-red-100 dark:bg-red-900/40 p-2 ring-1 ring-red-300/50">
                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {isSuperAdmin ? 'Effacer les données de cette institution' : 'Effacer les données de mon établissement'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {isSuperAdmin ? (
                          <>Supprime toutes les données de cette institution (élèves, enseignants, classes, etc.) pour recevoir de nouvelles données. <strong>L&apos;institution et votre compte admin sont conservés.</strong></>
                        ) : (
                          <>Supprime toutes les données de <strong>VOTRE établissement</strong> (élèves, enseignants, classes, etc.). <strong>Votre compte admin et votre établissement sont conservés.</strong></>
                        )}
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Les autres établissements ne seront PAS affectés.
                      </p>
                      {isSuperAdmin && !effectiveInstitutionId && (
                        <p className="text-[11px] text-red-700 dark:text-red-400 mt-1.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Ouvrez d&apos;abord une institution dans le module Super Admin pour activer cette action.
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setClearInstitutionOpen(true)}
                    disabled={!canManageInstitution || clearInstitutionLoading}
                    className="border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950 shrink-0"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isSuperAdmin ? 'Effacer cette institution' : 'Effacer mes données'}
                  </Button>
                </div>

                {/* ---- Action C: Reset EVERYTHING (super_admin only) ---- */}
                {isSuperAdmin && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border-2 border-red-400 dark:border-red-700 bg-red-50/60 dark:bg-red-950/30">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-red-100 dark:bg-red-900/50 p-2 ring-1 ring-red-400/60">
                        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          Réinitialiser TOUTE la base de données
                          <Badge className="bg-red-600 text-white text-[9px] hover:bg-red-700">Super Admin</Badge>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Supprime et recrée <strong>TOUTES les institutions</strong> avec les données de démonstration par défaut (École, Lycée, Polytech). <strong>Toutes les institutions existantes seront effacées.</strong> Cette action est irréversible.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => setResetAllOpen(true)}
                      disabled={resetAllLoading}
                      className="shrink-0"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Tout réinitialiser
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* ---- AlertDialog: Reset THIS institution ---- */}
          <AlertDialog open={resetInstitutionOpen} onOpenChange={(open) => { if (!open && !resetInstitutionLoading) setResetInstitutionOpen(false) }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-amber-600" />
                  {isSuperAdmin ? 'Réinitialiser cette institution' : 'Réinitialiser ma base de données'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr ? Toutes les données actuelles de {isSuperAdmin ? 'cette institution' : 'VOTRE établissement'} (élèves, notes, paiements, etc.) seront remplacées par de nouvelles données de démonstration. Votre compte admin est conservé.
                </AlertDialogDescription>
                <div className="mt-3 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    <strong>Les autres établissements ne seront PAS affectés.</strong> Seules les données de {isSuperAdmin ? 'l\'institution sélectionnée' : 'votre établissement'} seront réinitialisées.
                  </p>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={resetInstitutionLoading}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetInstitution}
                  disabled={resetInstitutionLoading}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {resetInstitutionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Réinitialisation...
                    </>
                  ) : (
                    'Réinitialiser'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* ---- AlertDialog: Clear THIS institution's data ---- */}
          <AlertDialog open={clearInstitutionOpen} onOpenChange={(open) => { if (!open && !clearInstitutionLoading) setClearInstitutionOpen(false) }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-red-600" />
                  {isSuperAdmin ? 'Effacer les données de cette institution' : 'Effacer les données de mon établissement'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr ? Toutes les données de {isSuperAdmin ? 'cette institution' : 'VOTRE établissement'} seront définitivement supprimées. <strong>Cette action est irréversible.</strong> L&apos;institution et votre compte admin sont conservés.
                </AlertDialogDescription>
                <div className="mt-3 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    <strong>Les autres établissements ne seront PAS affectés.</strong> Seules les données de {isSuperAdmin ? 'l\'institution sélectionnée' : 'votre établissement'} seront effacées.
                  </p>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={clearInstitutionLoading}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearInstitution}
                  disabled={clearInstitutionLoading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {clearInstitutionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Effacement...
                    </>
                  ) : (
                    'Effacer définitivement'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* ---- AlertDialog: Reset EVERYTHING (super_admin only) ---- */}
          <AlertDialog open={resetAllOpen} onOpenChange={(open) => { if (!open && !resetAllLoading) { setResetAllOpen(false); setResetAllConfirm('') } }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Réinitialiser TOUTE la base de données
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action effacera <strong>TOUTES les données de toutes les institutions</strong> (élèves, enseignants, classes, paiements, etc.) et recréera les 3 institutions de démonstration par défaut (École, Lycée, Polytech). <strong>Cette action est irréversible.</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2 space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
                  Tapez RESET pour confirmer
                </Label>
                <Input
                  value={resetAllConfirm}
                  onChange={(e) => setResetAllConfirm(e.target.value)}
                  placeholder="RESET"
                  className="border-red-300 dark:border-red-700 focus-visible:ring-red-500/30"
                  disabled={resetAllLoading}
                  autoComplete="off"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={resetAllLoading}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetAll}
                  disabled={resetAllLoading || resetAllConfirm !== 'RESET'}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {resetAllLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Réinitialisation...
                    </>
                  ) : (
                    'Tout réinitialiser'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* ===== Database download — for VSCode users ===== */}
          <motion.div variants={itemVariants}>
            <Card className="border-sky-300 dark:border-sky-700 shadow-lg shadow-sky-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="w-5 h-5 text-sky-600" />
                  Base de données — <span className="text-sky-600 dark:text-sky-400">version actuelle</span>
                  <Badge className="bg-sky-600 text-white text-[10px] hover:bg-sky-700 ml-1">SQLite</Badge>
                </CardTitle>
                <CardDescription>
                  Télécharge le fichier <span className="font-mono">custom.db</span> (1,9 Mo) contenant toutes les données de démonstration. À placer directement dans <span className="font-mono">db/custom.db</span> de votre projet VSCode pour remplacer la base vide.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl border-2 border-sky-400/60 dark:border-sky-600/50 bg-gradient-to-br from-sky-50 via-cyan-50/50 to-sky-50 dark:from-sky-950/40 dark:via-cyan-950/20 dark:to-sky-950/40">
                    <div className="flex items-start gap-4">
                      <div className="rounded-xl bg-sky-600/15 p-2.5 ring-1 ring-sky-500/30">
                        <Database className="w-8 h-8 text-sky-600 dark:text-sky-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground font-mono">custom.db</p>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Base SQLite complète : 9 institutions, 1 Super Admin, 99 utilisateurs,
                          64 élèves, 17 enseignants, 16 classes, 1080 notes, 180 paiements.
                          Prête à l&apos;emploi pour VSCode.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          <Badge variant="outline" className="text-[10px] border-sky-400/50 text-sky-700 dark:text-sky-400">1,9 Mo</Badge>
                          <Badge variant="outline" className="text-[10px] border-sky-400/50 text-sky-700 dark:text-sky-400">9 institutions</Badge>
                          <Badge variant="outline" className="text-[10px] border-sky-400/50 text-sky-700 dark:text-sky-400">99 utilisateurs</Badge>
                          <Badge variant="outline" className="text-[10px] border-sky-400/50 text-sky-700 dark:text-sky-400">1080 notes</Badge>
                          <Badge variant="outline" className="text-[10px] border-sky-400/50 text-sky-700 dark:text-sky-400">VSCode ready</Badge>
                        </div>
                      </div>
                    </div>
                    <a
                      href="/api/download-db"
                      download
                      className="bg-sky-600 hover:bg-sky-700 text-white shrink-0 shadow-md shadow-sky-500/25 h-auto py-2.5 px-6 rounded-md inline-flex flex-col items-center gap-0.5 leading-tight font-medium transition-colors"
                    >
                      <span className="flex items-center">
                        <Download className="w-5 h-5 mr-2" />
                        <span className="font-semibold">Télécharger la base de données</span>
                      </span>
                      <span className="text-[10px] font-normal text-sky-50/90">custom.db · 1,9 Mo</span>
                    </a>
                  </div>

                  <div className="rounded-lg bg-muted/50 dark:bg-muted/20 p-3.5 border border-muted-foreground/15">
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" />
                      Installation dans VSCode
                    </p>
                    <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside font-mono">
                      <li>Télécharger <span className="text-sky-700 dark:text-sky-400">custom.db</span> ci-dessus</li>
                      <li>Renommer en <span className="text-sky-700 dark:text-sky-400">custom.db</span> si besoin (le nom doit être exact)</li>
                      <li>Remplacer le fichier dans <span className="text-sky-700 dark:text-sky-400">db/custom.db</span> de votre projet VSCode</li>
                      <li>Vérifier <span className="text-sky-700 dark:text-sky-400">.env</span> : <span className="text-sky-700 dark:text-sky-400">DATABASE_URL=&quot;file:./db/custom.db&quot;</span></li>
                      <li><span className="text-sky-700 dark:text-sky-400">bun run dev</span> → les données apparaissent</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Download source — bouton « Télécharger le code source complet actuel » */}
          <motion.div variants={itemVariants}>
            <Card className="border-emerald-300 dark:border-emerald-700 shadow-lg shadow-emerald-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileArchive className="w-5 h-5 text-emerald-600" />
                  Code source complet — <span className="text-emerald-600 dark:text-emerald-400">version actuelle</span>
                  {buildMeta?.version && (
                    <Badge className="bg-emerald-600 text-white text-[10px] hover:bg-emerald-700 ml-1">
                      v{buildMeta.version}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Archive générée à la volée à chaque clic — inclut <strong>l’intégralité du code source actuel</strong> du projet : 91 routes API, 76 composants, 17 modules métier, schéma Prisma multi-institutions, base SQLite, scripts, configuration et documentation. Reflète exactement l’état présent du code (noms de classes partagés entre établissements, correctif du nom d'établissement à l'inscription, UI de réinitialisation clarifiée pour l'admin, bouton Super Admin sur la page de connexion, profil Super Admin complet, synchronisation du mot de passe admin, Super Admin plein CRUD, inscription self-service, connexion multi-identifiants, multi-institutions).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl border-2 border-emerald-400/60 dark:border-emerald-600/50 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-emerald-950/40">
                    <div className="flex items-start gap-4">
                      <div className="rounded-xl bg-emerald-600/15 p-2.5 ring-1 ring-emerald-500/30">
                        <FileArchive className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-foreground font-mono">
                            {buildMeta?.filename || 'MASOMO_Source_Complet.zip'}
                          </p>
                          {buildMeta?.version && (
                            <Badge className="bg-emerald-600 text-white text-[10px] hover:bg-emerald-700">
                              Version actuelle — v{buildMeta.version}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Archive complète du code source présent : Next.js 16 + TypeScript + Prisma + SQLite,
                          <strong> 91 routes API</strong>, <strong> 76 composants</strong>, <strong> 17 modules métier</strong>
                          (élèves, enseignants, parents, classes, notes, bulletins, paiements, présence,
                          communication, calendrier, devoirs, emploi du temps, super-admin), exports PDF/Excel/Word,
                          <strong> noms de classes partagés entre établissements</strong> (une classe « 1A »
                          peut exister dans plusieurs établissements — l&apos;unicité du nom est désormais
                          scopée par établissement),
                          <strong> correctif du nom d'établissement à l'inscription</strong> (le formulaire demande
                          désormais le nom de l'établissement séparément du nom de l'admin),
                          <strong> script de réparation fix-institution-name</strong> (renomme les « Mon Établissement »
                          résiduels via <code className="text-[10px]">bun run fix:institution-name</code>),
                          <strong> UI de réinitialisation clarifiée pour l'admin</strong> (« ma base » + reassurance
                          verte « Les autres établissements ne seront PAS affectés »),
                          <strong> bouton Super Admin sur la page de connexion</strong>,
                          <strong> profil Super Admin complet</strong>,
                          <strong> Super Admin plein CRUD</strong>,
                          <strong> synchronisation du mot de passe admin</strong>,
                          <strong> inscription self-service</strong>,
                          <strong> connexion multi-identifiants</strong>,
                          multi-institutions, gestion du profil, de l&apos;institution et des mots de passe.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">
                            {buildMeta ? `${buildMeta.fileCount} fichiers` : '~296 fichiers'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">
                            {rawSizeLabel ? `~${rawSizeLabel} brut` : '~8 MB'}
                          </Badge>
                          {freshnessLabel && (
                            <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">
                              <Clock className="w-3 h-3 mr-1" />
                              {freshnessLabel}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">Bouton Super Admin</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">Profil Super Admin complet</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">Login épuré (sans démo)</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">Super Admin plein CRUD</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">Sync mot de passe admin</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">Inscription self-service</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">Connexion multi-ID</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">Noms de classes par établissement (v1.22)</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">Correctif nom établissement (v1.21)</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">Script fix-institution-name</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">Reset admin scopé + UI claire</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">91 routes API</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">76 composants</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">17 modules métier</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">Base SQLite incluse</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">VSCode ready</Badge>
                          <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-700 dark:text-emerald-400">Prêt à installer</Badge>
                        </div>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-2.5 flex items-center gap-1.5">
                          <Shield className="w-3 h-3" />
                          L&apos;archive est reconstruite à chaque clic : elle reflète toujours l&apos;état actuel du code, y compris les dernières modifications de la session.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleDownloadSource}
                      disabled={downloadingSource}
                      size="lg"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-md shadow-emerald-500/25 h-auto py-2.5 px-6 w-full sm:w-auto flex flex-col items-center gap-0.5 leading-tight"
                    >
                      {downloadingSource ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Génération de l’archive…
                        </>
                      ) : (
                        <>
                          <span className="flex items-center">
                            <Download className="w-5 h-5 mr-2" />
                            <span className="font-semibold">Télécharger le code source complet</span>
                          </span>
                          <span className="text-[10px] font-normal text-emerald-50/90">
                            Version actuelle{buildMeta?.version ? ` · v${buildMeta.version}` : ''}{freshnessLabel ? ` · ${freshnessLabel}` : ''}
                          </span>
                        </>
                      )}
                    </Button>
                  </div>

                  {downloadingSource && downloadProgress && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      <span>{downloadProgress}</span>
                    </div>
                  )}

                  {/* Contenu de l'archive */}
                  <div className="rounded-lg bg-muted/50 dark:bg-muted/20 p-3.5 border border-muted-foreground/15">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" />
                      Contenu de l&apos;archive
                    </p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-600" /> Code source complet (<span className="font-mono">src/</span>)</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-600" /> Schéma Prisma + seeds (<span className="font-mono">prisma/</span>)</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-600" /> Base SQLite (<span className="font-mono">db/custom.db</span>)</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-600" /> Scripts utilitaires (<span className="font-mono">scripts/</span>)</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-600" /> Mini-services + exemples (<span className="font-mono">mini-services/, examples/</span>)</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-600" /> Assets publics (<span className="font-mono">public/</span>)</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-600" /> Config (<span className="font-mono">.env, package.json, package-lock.json, bun.lock</span>)</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-600" /> Documentation (README, SETUP, CHANGELOG)</li>
                      <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-600" /> <span className="font-mono">BUILD_INFO.md</span> (détails inclus)</li>
                    </ul>
                  </div>

                  <div className="rounded-lg bg-muted/50 dark:bg-muted/20 p-3.5 border border-muted-foreground/15">
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" />
                      Installation rapide
                    </p>
                    <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside font-mono">
                      <li>Décompresser l&apos;archive dans un dossier</li>
                      <li><span className="text-emerald-700 dark:text-emerald-400">bun install</span></li>
                      <li><span className="text-emerald-700 dark:text-emerald-400">bun run db:push</span> puis <span className="text-emerald-700 dark:text-emerald-400">bun run dev</span> → http://localhost:3000</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* About */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="w-5 h-5 text-sky-600" />
                  À propos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Application</span>
                    <span className="text-sm font-medium">
                      MASOMO v{buildMeta?.version || '1.21.0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Framework</span>
                    <span className="text-sm font-medium">Next.js 16</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Base de données</span>
                    <span className="text-sm font-medium">SQLite / Prisma</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Interface</span>
                    <span className="text-sm font-medium">shadcn/ui + Tailwind CSS</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Année scolaire active</span>
                    <span className="text-sm font-medium">{schoolYear}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

// ============================================================
// Profile Section — Avatar, name, email, role, phone
// ============================================================

interface ProfileSectionProps {
  currentUser: ReturnType<typeof useAppStore.getState>['currentUser']
  initials: string
  updateStoreUser: (user: NonNullable<ReturnType<typeof useAppStore.getState>['currentUser']>) => void
}

function ProfileSection({ currentUser, initials, updateStoreUser }: ProfileSectionProps) {
  const [name, setName] = useState(currentUser?.name || '')
  const [email, setEmail] = useState(currentUser?.email || '')
  const [phone, setPhone] = useState(currentUser?.phone || '')
  const [role, setRole] = useState<UserRole>((currentUser?.role as UserRole) || 'admin')
  const [avatar, setAvatar] = useState<string | null>(currentUser?.avatar || null)
  const [saving, setSaving] = useState(false)
  const [removeAvatarFlag, setRemoveAvatarFlag] = useState(false)
  const [confirmDeleteAvatar, setConfirmDeleteAvatar] = useState(false)
  // Super admins are stored in a separate table (SuperAdmin) with its own ID
  // space — they cannot use /api/auth/profile (which operates on the User
  // table) and must route to /api/superadmin/profile instead.
  const isSuperAdmin = currentUser?.role === 'super_admin'

  // Sync local state when currentUser changes (e.g., after a save)
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name)
      setEmail(currentUser.email)
      setPhone(currentUser.phone || '')
      setRole((currentUser.role as UserRole) || 'admin')
      setAvatar(currentUser.avatar || null)
      setRemoveAvatarFlag(false)
    }
  }, [currentUser?.id, currentUser?.updatedAt])

  const hasChanges = useCallback(() => {
    if (!currentUser) return false
    return (
      name !== currentUser.name ||
      email !== currentUser.email ||
      (phone || '') !== (currentUser.phone || '') ||
      role !== currentUser.role ||
      removeAvatarFlag ||
      (avatar !== null && avatar !== currentUser.avatar)
    )
  }, [currentUser, name, email, phone, role, avatar, removeAvatarFlag])

  const handleSave = async () => {
    if (!currentUser) return
    setSaving(true)
    try {
      const payload: Record<string, string> = {
        name,
        email,
        phone,
      }
      // Super admins don't have a changeable role (they're always super_admin)
      // and the /api/superadmin/profile endpoint doesn't accept `role`.
      if (!isSuperAdmin) {
        payload.role = role
      }
      if (removeAvatarFlag) payload.removeAvatar = 'true'
      else if (avatar && avatar !== currentUser.avatar) payload.avatar = avatar

      // Route to the SuperAdmin-specific endpoint when the logged-in user is
      // a super admin. The SuperAdmin table has its own ID space (separate
      // from the User table), so /api/auth/profile cannot be used — it would
      // try to db.user.update({ where: { id: superAdminId } }) and fail with
      // P2025 "Record to update not found".
      const endpoint = isSuperAdmin ? '/api/superadmin/profile' : '/api/auth/profile'
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Échec de la mise à jour du profil.')
      }

      // Update the local store so the rest of the app sees the new name/avatar
      // Both endpoints return the updated record under `user` (the SuperAdmin
      // endpoint was extended to expose `user` alongside `superAdmin` for this
      // uniformity).
      updateStoreUser({
        ...currentUser,
        ...data.user,
      })

      // Notify the rest of the app that the avatar may have changed, so any
      // other component currently displaying the avatar (header, sidebar,
      // list modules, etc.) re-fetches a fresh, cache-busted copy.
      notifyAvatarChanged({
        userId: currentUser?.id,
        role: currentUser?.role as string | undefined,
      })

      toast.success('Profil mis à jour', {
        description: 'Vos informations ont été enregistrées avec succès.',
      })
      setRemoveAvatarFlag(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveAvatar = () => {
    setAvatar(null)
    setRemoveAvatarFlag(true)
    setConfirmDeleteAvatar(false)
  }

  return (
    <motion.div variants={itemVariants}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-5 h-5 text-emerald-600" />
            Profil utilisateur
          </CardTitle>
          <CardDescription>
            Modifiez votre avatar, votre email, votre rôle et votre téléphone
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar */}
          <div className="space-y-3">
            <Label>Avatar</Label>
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20 ring-2 ring-emerald-100 dark:ring-emerald-900">
                {avatar && !removeAvatarFlag ? (
                  <AvatarImage src={avatar} alt={currentUser?.name} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <ImageDropZone
                  currentImage={removeAvatarFlag ? null : avatar}
                  fallbackInitials={initials}
                  folder="avatars"
                  onImageUploaded={(url) => {
                    setAvatar(url)
                    setRemoveAvatarFlag(false)
                  }}
                  onImageRemoved={() => setRemoveAvatarFlag(true)}
                />
                {avatar && !removeAvatarFlag && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDeleteAvatar(true)}
                    className="mt-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3 mr-1.5" />
                    Supprimer l&apos;avatar actuel
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Editable fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name" className="text-xs">Nom complet</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email" className="text-xs">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@ecole.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-phone" className="text-xs">Téléphone</Label>
              <Input
                id="profile-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+243 6XX XXX XXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-role" className="text-xs">Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger id="profile-role">
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label} — <span className="text-xs text-muted-foreground">{r.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Read-only badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {currentUser?.active ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                Actif
              </Badge>
            ) : (
              <Badge variant="secondary">Inactif</Badge>
            )}
            <Badge variant="outline">
              <Calendar className="w-3 h-3 mr-1" />
              Inscrit le{' '}
              {currentUser?.createdAt
                ? new Date(currentUser.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '—'}
            </Badge>
            {currentUser?.userCode && (
              <Badge variant="outline">Code: {currentUser.userCode}</Badge>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges()}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer le profil
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirm avatar deletion */}
      <AlertDialog open={confirmDeleteAvatar} onOpenChange={setConfirmDeleteAvatar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l&apos;avatar ?</AlertDialogTitle>
            <AlertDialogDescription>
              Votre avatar sera remplacé par vos initiales. Vous devrez enregistrer pour confirmer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveAvatar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}

// ============================================================
// Self Password Section — define, modify, delete own password
// ============================================================

interface SelfPasswordSectionProps {
  currentUser: ReturnType<typeof useAppStore.getState>['currentUser']
}

function SelfPasswordSection({ currentUser }: SelfPasswordSectionProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Super admins are stored in a separate table (SuperAdmin) — their password
  // changes must go through /api/superadmin/profile, not /api/auth/profile.
  const isSuperAdmin = currentUser?.role === 'super_admin'

  const handleSavePassword = async () => {
    if (!currentUser) return
    if (!currentPassword) {
      toast.error('Champ requis', { description: 'Veuillez saisir votre mot de passe actuel.' })
      return
    }
    if (newPassword.trim().length < 3) {
      toast.error('Mot de passe trop court', { description: 'Minimum 3 caractères.' })
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Confirmation incorrecte', { description: 'Les deux mots de passe ne correspondent pas.' })
      return
    }

    setSaving(true)
    try {
      // Super Admin: route to /api/superadmin/profile (SuperAdmin table).
      // Regular users: route to /api/auth/profile (User table).
      const endpoint = isSuperAdmin ? '/api/superadmin/profile' : '/api/auth/profile'
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Échec de la modification du mot de passe.')

      toast.success('Mot de passe modifié', {
        description: 'Votre nouveau mot de passe est actif. Utilisez-le à la prochaine connexion.',
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePassword = async () => {
    if (!currentUser) return
    if (!currentPassword) {
      toast.error('Sécurité requise', {
        description: 'Veuillez saisir votre mot de passe actuel pour confirmer la suppression.',
      })
      return
    }
    setDeleting(true)
    try {
      // Super Admin: route to /api/superadmin/profile (SuperAdmin table).
      // Regular users: route to /api/auth/profile (User table).
      const endpoint = isSuperAdmin ? '/api/superadmin/profile' : '/api/auth/profile'
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          deletePassword: 'true',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Échec de la suppression du mot de passe.')

      toast.warning('Mot de passe supprimé', {
        description:
          'Votre mot de passe a été supprimé. Vous ne pouvez plus vous connecter tant qu\'un nouveau mot de passe n\'est pas défini.',
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setConfirmDelete(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur', { description: msg })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <motion.div variants={itemVariants}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-5 h-5 text-amber-600" />
            Mon mot de passe de connexion
          </CardTitle>
          <CardDescription>
            Définissez, modifiez ou supprimez votre mot de passe de connexion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current password */}
          <div className="space-y-1.5">
            <Label htmlFor="current-pwd" className="text-xs">
              Mot de passe actuel <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="current-pwd"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showCurrent ? 'Masquer' : 'Afficher'}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Separator />

          {/* New password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-pwd" className="text-xs">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="new-pwd"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Au moins 3 caractères"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showNew ? 'Masquer' : 'Afficher'}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pwd" className="text-xs">Confirmer le nouveau mot de passe</Label>
              <Input
                id="confirm-pwd"
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ressaisir le nouveau mot de passe"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              disabled={deleting || !currentPassword}
              className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer mon mot de passe
            </Button>
            <Button
              onClick={handleSavePassword}
              disabled={
                saving ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword ||
                newPassword !== confirmPassword
              }
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Modification…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Modifier mon mot de passe
                </>
              )}
            </Button>
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              <strong>Supprimer</strong> votre mot de passe désactive votre accès à l&apos;application.
              Vous ne pourrez plus vous connecter tant qu&apos;un administrateur n&apos;aura pas défini un
              nouveau mot de passe pour vous.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Confirm delete password */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer votre mot de passe ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est dangereuse. Votre compte ne pourra plus se connecter à l&apos;application
              tant qu&apos;un nouveau mot de passe n&apos;aura pas été défini par vous-même ou par un
              autre administrateur. Confirmez-vous ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePassword}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Suppression…
                </>
              ) : (
                'Supprimer définitivement'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}

// ============================================================
// Institution Section — define, modify, delete own institution
// ============================================================

interface InstitutionSectionProps {
  currentUser: ReturnType<typeof useAppStore.getState>['currentUser']
}

function InstitutionSection({ currentUser }: InstitutionSectionProps) {
  const [institution, setInstitution] = useState<InstitutionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteMode, setDeleteMode] = useState<'deactivate' | 'permanent'>('deactivate')

  // Editable form state
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [currentYear, setCurrentYear] = useState('2024-2025')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadInstitution = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/institution', { method: 'GET' })
      if (res.status === 404) {
        setInstitution(null)
        return
      }
      const data = await res.json()
      if (res.ok && data.institution) {
        setInstitution(data.institution)
        setName(data.institution.name || '')
        setAddress(data.institution.address || '')
        setPhone(data.institution.phone || '')
        setEmail(data.institution.email || '')
        setCurrentYear(data.institution.currentYear || '2024-2025')
        setPassword(data.institution.password || '')
      } else {
        setInstitution(null)
      }
    } catch {
      setInstitution(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInstitution()
  }, [loadInstitution])

  const handleCreate = async () => {
    if (!name.trim() || !password.trim()) {
      toast.error('Champs requis', { description: 'Le nom et le mot de passe de l\'institution sont requis.' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings/institution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          password,
          address,
          phone,
          email,
          currentYear,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Échec de la création de l\'institution.')

      toast.success('Institution créée', { description: data.message })
      setShowCreateForm(false)
      await loadInstitution()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!institution) return
    if (!name.trim()) {
      toast.error('Champ requis', { description: 'Le nom de l\'institution est requis.' })
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, string> = {
        name,
        address,
        phone,
        email,
        currentYear,
      }
      // Only include password if it has changed from the existing one
      if (password && password !== institution.password) {
        payload.password = password
      }

      const res = await fetch('/api/settings/institution', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Échec de la mise à jour de l\'institution.')

      toast.success('Institution mise à jour', { description: data.message })
      await loadInstitution()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch('/api/settings/institution', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: deleteMode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Échec de la suppression.')

      toast.success('Institution supprimée', { description: data.message })
      setConfirmDelete(false)
      await loadInstitution()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur', { description: msg })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement de l&apos;institution…
        </CardContent>
      </Card>
    )
  }

  // Case 1: Admin has no institution yet — show "create" CTA
  if (!institution && !showCreateForm) {
    return (
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-5 h-5 text-teal-600" />
              Mon institution
            </CardTitle>
            <CardDescription>
              Vous n&apos;avez pas encore défini votre institution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-6">
              <Building className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Aucune institution n&apos;est associée à votre compte administrateur.
                Créez-en une pour pouvoir gérer vos élèves, enseignants et classes.
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Définir mon institution
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // Case 2: Create form
  if (!institution && showCreateForm) {
    return (
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="w-5 h-5 text-teal-600" />
              Créer mon institution
            </CardTitle>
            <CardDescription>
              Définissez les informations de votre établissement scolaire
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InstitutionForm
              name={name} setName={setName}
              address={address} setAddress={setAddress}
              phone={phone} setPhone={setPhone}
              email={email} setEmail={setEmail}
              currentYear={currentYear} setCurrentYear={setCurrentYear}
              password={password} setPassword={setPassword}
              showPassword={showPassword} setShowPassword={setShowPassword}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false)
                  setName('')
                  setAddress('')
                  setPhone('')
                  setEmail('')
                  setPassword('')
                  setCurrentYear('2024-2025')
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création…
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Créer l&apos;institution
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // Case 3: Edit existing institution
  return (
    <motion.div variants={itemVariants}>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-5 h-5 text-teal-600" />
                Mon institution
              </CardTitle>
              <CardDescription>
                Modifiez ou supprimez les informations de votre établissement
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {institution?.active ? (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                  <Check className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="destructive">Inactive</Badge>
              )}
              {institution?._count && (
                <>
                  <Badge variant="outline">
                    <Users className="w-3 h-3 mr-1" />
                    {institution._count.users} utilisateur(s)
                  </Badge>
                  <Badge variant="outline">
                    {institution._count.classes} classe(s)
                  </Badge>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <InstitutionForm
            name={name} setName={setName}
            address={address} setAddress={setAddress}
            phone={phone} setPhone={setPhone}
            email={email} setEmail={setEmail}
            currentYear={currentYear} setCurrentYear={setCurrentYear}
            password={password} setPassword={setPassword}
            showPassword={showPassword} setShowPassword={setShowPassword}
          />

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer l&apos;institution
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer les modifications
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirm delete institution */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Supprimer l&apos;institution « {institution?.name} » ?
            </DialogTitle>
            <DialogDescription>
              Cette action est irréversible si vous choisissez la suppression définitive.
              Choisissez le mode de suppression :
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-muted cursor-pointer hover:bg-accent/50">
              <input
                type="radio"
                name="delete-mode"
                value="deactivate"
                checked={deleteMode === 'deactivate'}
                onChange={() => setDeleteMode('deactivate')}
                className="mt-1"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium">Désactiver (recommandé)</p>
                <p className="text-xs text-muted-foreground">
                  L&apos;institution et tous ses utilisateurs seront désactivés. Les données sont
                  conservées et l&apos;opération est réversible.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-destructive/30 cursor-pointer hover:bg-destructive/5">
              <input
                type="radio"
                name="delete-mode"
                value="permanent"
                checked={deleteMode === 'permanent'}
                onChange={() => setDeleteMode('permanent')}
                className="mt-1"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Suppression définitive</p>
                <p className="text-xs text-muted-foreground">
                  Supprime l&apos;institution et <strong>toutes</strong> ses données (élèves,
                  enseignants, classes, notes, paiements, bulletins, etc.). Action irréversible.
                </p>
              </div>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Suppression…
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Confirmer la suppression
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ---------- Reusable institution form ----------
interface InstitutionFormProps {
  name: string
  setName: (v: string) => void
  address: string
  setAddress: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  email: string
  setEmail: (v: string) => void
  currentYear: string
  setCurrentYear: (v: string) => void
  password: string
  setPassword: (v: string) => void
  showPassword: boolean
  setShowPassword: (v: boolean) => void
}

function InstitutionForm({
  name, setName,
  address, setAddress,
  phone, setPhone,
  email, setEmail,
  currentYear, setCurrentYear,
  password, setPassword,
  showPassword, setShowPassword,
}: InstitutionFormProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="inst-name" className="text-xs">
          Nom de l&apos;institution <span className="text-destructive">*</span>
        </Label>
        <Input
          id="inst-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="École Internationale MASOMO"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inst-phone" className="text-xs">Téléphone</Label>
        <Input
          id="inst-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+243 6XX XXX XXX"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inst-email" className="text-xs">Email</Label>
        <Input
          id="inst-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="contact@ecole.com"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="inst-address" className="text-xs">Adresse</Label>
        <Input
          id="inst-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Douala, Cameroun"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inst-year" className="text-xs">Année scolaire active</Label>
        <Input
          id="inst-year"
          value={currentYear}
          onChange={(e) => setCurrentYear(e.target.value)}
          placeholder="2024-2025"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inst-password" className="text-xs">
          Mot de passe de l&apos;institution <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id="inst-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe d&apos;accès institution"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Masquer' : 'Afficher'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Ce mot de passe est demandé lors de la connexion pour sélectionner l&apos;institution.
        </p>
      </div>
    </div>
  )
}

// ============================================================
// Role Passwords Section — admin defines ONE global password per role
// All users of the same role share the same login password.
// ============================================================

interface RolePasswordInfo {
  role: string
  label: string
  icon: LucideIcon
  color: string
  bgColor: string
  defaultPwd: string
  count: number
  status: 'none' | 'uniform' | 'mixed'
  commonPassword: string | null
  isDefault: boolean
}

const ROLE_PASSWORD_META: {
  role: string
  label: string
  icon: LucideIcon
  color: string
  bgColor: string
  defaultPwd: string
}[] = [
  { role: 'student', label: 'Élèves', icon: GraduationCap, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', defaultPwd: 'eleve123' },
  { role: 'teacher', label: 'Enseignants', icon: BookOpen, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30', defaultPwd: 'enseignant123' },
  { role: 'parent', label: 'Parents', icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30', defaultPwd: 'parent123' },
  { role: 'staff', label: 'Personnel', icon: Briefcase, color: 'text-pink-600', bgColor: 'bg-pink-50 dark:bg-pink-950/30', defaultPwd: 'personnel123' },
  { role: 'admin', label: 'Administrateurs', icon: UserCog, color: 'text-rose-600', bgColor: 'bg-rose-50 dark:bg-rose-950/30', defaultPwd: 'admin123' },
]

interface RolePasswordsSectionProps {
  currentUserId: string
  currentUserRole: string
}

function RolePasswordsSection({ currentUserRole }: RolePasswordsSectionProps) {
  const [users, setUsers] = useState<UserWithPassword[]>([])
  const [loading, setLoading] = useState(true)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingRole, setDeletingRole] = useState<string | null>(null)
  const [resettingRole, setResettingRole] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users', { method: 'GET' })
      const data = await res.json()
      if (res.ok && data.users) setUsers(data.users)
    } catch (err) {
      console.error('Load users error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const roleInfos: RolePasswordInfo[] = ROLE_PASSWORD_META.map((meta) => {
    const roleUsers = users.filter((u) => u.role === meta.role)
    const passwords = roleUsers.map((u) => u.password)
    const uniquePasswords = Array.from(new Set(passwords))
    let status: 'none' | 'uniform' | 'mixed' = 'none'
    let commonPassword: string | null = null
    let isDefault = false

    if (roleUsers.length === 0) {
      status = 'none'
    } else if (uniquePasswords.length === 1) {
      const pwd = uniquePasswords[0]
      if (pwd === '') {
        status = 'none'
      } else {
        status = 'uniform'
        commonPassword = pwd
        isDefault = pwd === meta.defaultPwd
      }
    } else {
      status = 'mixed'
    }

    return { ...meta, count: roleUsers.length, status, commonPassword, isDefault }
  })

  const handleSave = async () => {
    if (!editingRole) return
    if (newPassword.trim().length < 3) {
      toast.error('Mot de passe trop court', { description: 'Minimum 3 caractères.' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/users/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editingRole, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Échec de la mise à jour.')

      toast.success('Mot de passe global enregistré', { description: data.message })
      setEditingRole(null)
      setNewPassword('')
      setShowNewPassword(false)
      await loadUsers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (role: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/users/password', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, mode: 'delete' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Échec de la suppression.')

      toast.warning('Mot de passe supprimé', { description: data.message })
      setDeletingRole(null)
      await loadUsers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (role: string) => {
    setResettingRole(role)
    try {
      const res = await fetch('/api/users/password', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, mode: 'reset' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Échec de la réinitialisation.')

      toast.success('Mot de passe réinitialisé', {
        description: data.message + (data.defaultPassword ? ` Mot de passe par défaut : ${data.defaultPassword}` : ''),
      })
      await loadUsers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur', { description: msg })
    } finally {
      setResettingRole(null)
    }
  }

  const editingMeta = editingRole ? ROLE_PASSWORD_META.find((m) => m.role === editingRole) : null
  const deletingMeta = deletingRole ? ROLE_PASSWORD_META.find((m) => m.role === deletingRole) : null

  return (
    <motion.div variants={itemVariants}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-5 h-5 text-emerald-600" />
            Mots de passe globaux par rôle
          </CardTitle>
          <CardDescription>
            Définissez un seul mot de passe pour chaque rôle. Tous les utilisateurs du même rôle (élèves, enseignants, etc.) se connecteront avec ce mot de passe unique.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Chargement des rôles…
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {roleInfos.map((info) => {
                const Icon = info.icon
                const isSelfRole = currentUserRole === info.role
                return (
                  <div
                    key={info.role}
                    className={`rounded-lg border p-4 ${info.bgColor} ${
                      isSelfRole ? 'ring-2 ring-emerald-400/50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${info.color}`} />
                        <div>
                          <p className="text-sm font-semibold">
                            {info.label}
                            {isSelfRole && (
                              <Badge className="ml-2 bg-emerald-100 text-emerald-700 text-[9px] dark:bg-emerald-900/50 dark:text-emerald-400">
                                Vous
                              </Badge>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {info.count} utilisateur(s) dans ce rôle
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {info.status === 'none' && (
                          <Badge variant="destructive" className="text-[10px]">Aucun</Badge>
                        )}
                        {info.status === 'uniform' && info.isDefault && (
                          <Badge variant="secondary" className="text-[10px]">Par défaut</Badge>
                        )}
                        {info.status === 'uniform' && !info.isDefault && (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 text-[10px]">
                            Personnalisé
                          </Badge>
                        )}
                        {info.status === 'mixed' && (
                          <Badge variant="outline" className="text-[10px]">Mixte</Badge>
                        )}
                      </div>
                    </div>

                    <div className="mb-3 min-h-[1.75rem] flex items-center text-sm font-mono">
                      {info.status === 'uniform' ? (
                        <>
                          <span className="truncate max-w-[12rem]">
                            {showPasswords[info.role]
                              ? info.commonPassword
                              : '•'.repeat(Math.min(12, (info.commonPassword || '').length))}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setShowPasswords((s) => ({ ...s, [info.role]: !s[info.role] }))
                            }
                            className="ml-2 text-xs text-muted-foreground hover:text-foreground underline inline-flex items-center gap-1"
                          >
                            {showPasswords[info.role] ? (
                              <>
                                <EyeOff className="w-3 h-3" /> Masquer
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3" /> Afficher
                              </>
                            )}
                          </button>
                        </>
                      ) : info.status === 'mixed' ? (
                        <span className="text-muted-foreground italic text-xs font-sans">
                          Plusieurs mots de passe différents détectés
                        </span>
                      ) : (
                        <span className="text-destructive italic text-xs font-sans">
                          Aucun mot de passe défini — connexion bloquée
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingRole(info.role)
                          setNewPassword('')
                          setShowNewPassword(false)
                        }}
                        className="h-8"
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        <span className="text-xs">Définir / Modifier</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReset(info.role)}
                        disabled={resettingRole === info.role}
                        className="h-8"
                        title="Réinitialiser au mot de passe par défaut du rôle"
                      >
                        {resettingRole === info.role ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        <span className="text-xs ml-1">Réinitialiser</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeletingRole(info.role)}
                        className="h-8 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                        title="Supprimer le mot de passe (bloque la connexion)"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span className="text-xs ml-1">Supprimer</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="rounded-lg bg-muted/30 dark:bg-muted/10 p-3 space-y-1.5 border border-muted-foreground/15">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Comment ça marche
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-start gap-2">
                <Pencil className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                  <strong>Définir / Modifier</strong> : applique un nouveau mot de passe à
                  <em> tous </em> les utilisateurs du rôle en une seule opération.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <RefreshCw className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                  <strong>Réinitialiser</strong> : remet le mot de passe par défaut du rôle
                  (eleve123, enseignant123, parent123, personnel123, admin123).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Trash2 className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                  <strong>Supprimer</strong> : efface les mots de passe ; aucun utilisateur du
                  rôle ne pourra se connecter tant qu&apos;un nouveau mot de passe ne sera pas défini.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                  Si vous modifiez le mot de passe de <strong>votre propre rôle</strong>,
                  votre mot de passe sera également changé — utilisez le nouveau à la prochaine connexion.
                </span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Edit role password dialog */}
      <Dialog
        open={!!editingRole}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRole(null)
            setNewPassword('')
            setShowNewPassword(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-600" />
              Mot de passe global — {editingMeta?.label}
            </DialogTitle>
            <DialogDescription>
              Ce mot de passe sera appliqué à <strong>tous</strong> les utilisateurs du rôle
              « {editingMeta?.label} » ({users.filter((u) => u.role === editingRole).length} compte(s)).
              {currentUserRole === editingRole && (
                <span className="block mt-2 text-amber-600 font-medium">
                  ⚠ Vous appartenez à ce rôle. Votre propre mot de passe sera aussi modifié —
                  utilisez le nouveau mot de passe à la prochaine connexion.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="role-new-pwd" className="text-xs">
                Nouveau mot de passe <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="role-new-pwd"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Au moins 3 caractères"
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showNewPassword ? 'Masquer' : 'Afficher'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ce mot de passe sera immédiatement actif pour tous les {editingMeta?.label.toLowerCase()}.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingRole(null)
                setNewPassword('')
                setShowNewPassword(false)
              }}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || newPassword.trim().length < 3}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete role password dialog */}
      <AlertDialog
        open={!!deletingRole}
        onOpenChange={(open) => !open && setDeletingRole(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Supprimer le mot de passe du rôle « {deletingMeta?.label} » ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {currentUserRole === deletingRole
                ? '⚠ Vous appartenez à ce rôle. Vous serez déconnecté(e) et ne pourrez plus vous reconnecter tant qu\'un nouveau mot de passe ne sera pas défini.'
                : `Aucun utilisateur du rôle « ${deletingMeta?.label} » ne pourra se connecter tant qu'un nouveau mot de passe ne sera pas défini. L'opération est réversible (il suffit de définir un nouveau mot de passe).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRole && handleDelete(deletingRole)}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Suppression…
                </>
              ) : (
                'Supprimer définitivement'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}

// ============================================================
// Users Password Section — admin manages passwords of others
// ============================================================

interface UsersPasswordSectionProps {
  currentUserId: string
}

function UsersPasswordSection({ currentUserId }: UsersPasswordSectionProps) {
  const [users, setUsers] = useState<UserWithPassword[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [editingUser, setEditingUser] = useState<UserWithPassword | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserWithPassword | null>(null)
  const [resettingUser, setResettingUser] = useState<string | null>(null)
  // Toggle to reveal/hide ALL passwords in the list at once.
  const [showAllPasswords, setShowAllPasswords] = useState(false)
  // Loading state for the "Generate missing IDs" button.
  const [generatingCodes, setGeneratingCodes] = useState(false)
  // Per-user password reveal (overrides the global toggle for finer control).
  const [revealedUserIds, setRevealedUserIds] = useState<Set<string>>(new Set())

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users', { method: 'GET' })
      const data = await res.json()
      if (res.ok && data.users) {
        setUsers(data.users)
      }
    } catch (err) {
      console.error('Load users error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.userCode || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleSaveUserPassword = async () => {
    if (!editingUser) return
    if (newPassword.trim().length < 3) {
      toast.error('Mot de passe trop court', { description: 'Minimum 3 caractères.' })
      return
    }
    setSavingPassword(true)
    try {
      const res = await fetch('/api/users/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Échec de la mise à jour.')

      toast.success('Mot de passe enregistré', { description: data.message })
      setEditingUser(null)
      setNewPassword('')
      await loadUsers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur', { description: msg })
    } finally {
      setSavingPassword(false)
    }
  }

  const handleDeleteUserPassword = async (user: UserWithPassword) => {
    setConfirmDeleteUser(user)
  }

  const confirmDeletePassword = async () => {
    if (!confirmDeleteUser) return
    setSavingPassword(true)
    try {
      const res = await fetch('/api/users/password', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: confirmDeleteUser.id,
          mode: 'delete',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Échec de la suppression.')

      toast.warning('Mot de passe supprimé', { description: data.message })
      setConfirmDeleteUser(null)
      await loadUsers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur', { description: msg })
    } finally {
      setSavingPassword(false)
    }
  }

  const handleResetUserPassword = async (user: UserWithPassword) => {
    setResettingUser(user.id)
    try {
      const res = await fetch('/api/users/password', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          mode: 'reset',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Échec de la réinitialisation.')

      toast.success('Mot de passe réinitialisé', {
        description: data.message + (data.defaultPassword ? ` Mot de passe par défaut : ${data.defaultPassword}` : ''),
      })
      await loadUsers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur', { description: msg })
    } finally {
      setResettingUser(null)
    }
  }

  // Generate userCodes (login IDs) for every user who doesn't have one yet.
  // This backfills the ELV-001 / TCH-001 / STF-001 / PAR-001 / ADM-001 codes
  // so all students and staff can log in with their short ID.
  const handleGenerateCodes = async () => {
    setGeneratingCodes(true)
    try {
      const res = await fetch('/api/users/ensure-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Échec de la génération.')

      if (data.updated > 0) {
        toast.success('Identifiants générés', {
          description: data.message + (data.byRole
            ? ` — ${Object.entries(data.byRole).map(([k, v]) => `${k}: ${v}`).join(', ')}`
            : ''),
        })
      } else {
        toast.info('Aucun identifiant à générer', {
          description: 'Tous les utilisateurs ont déjà un identifiant.',
        })
      }
      await loadUsers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Erreur', { description: msg })
    } finally {
      setGeneratingCodes(false)
    }
  }

  // Toggle per-user password reveal.
  const toggleUserReveal = (userId: string) => {
    setRevealedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  // Whether a given user's password should be visible right now.
  const isPasswordVisible = (userId: string) =>
    showAllPasswords || revealedUserIds.has(userId)

  // Copy text to clipboard with a toast notification.
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const copyToClipboard = async (text: string, fieldKey: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldKey)
      toast.success('Copié', { description: text })
      setTimeout(() => setCopiedField(null), 1500)
    } catch {
      toast.error('Copie impossible', { description: 'Veuillez copier manuellement.' })
    }
  }

  const getUserAvatar = (u: UserWithPassword): string | null => {
    return u.avatar || u.teacher?.image || u.student?.image || u.staff?.image || null
  }

  const getUserInitials = (u: UserWithPassword): string => {
    return u.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  }

  const getPasswordBadge = (u: UserWithPassword) => {
    if (u.passwordStatus === 'none') {
      return <Badge variant="destructive" className="text-[10px]">Aucun</Badge>
    }
    if (u.passwordStatus === 'default') {
      return <Badge variant="secondary" className="text-[10px]">Par défaut</Badge>
    }
    return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 text-[10px]">Personnalisé</Badge>
  }

  const getRoleLabel = (role: string): string => {
    const map: Record<string, string> = {
      admin: 'Administrateur',
      teacher: 'Enseignant',
      student: 'Élève',
      parent: 'Parent',
      staff: 'Personnel',
      super_admin: 'Super Admin',
    }
    return map[role] || role
  }

  return (
    <motion.div variants={itemVariants}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-indigo-600" />
            Comptes & Mots de passe
          </CardTitle>
          <CardDescription>
            Liste de tous les comptes avec leur identifiant (ID), email, nom et mot de passe.
            Les élèves et le personnel peuvent se connecter avec leur ID au lieu de leur email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters + Actions toolbar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email ou identifiant…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Tous les rôles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="admin">Administrateurs</SelectItem>
                <SelectItem value="teacher">Enseignants</SelectItem>
                <SelectItem value="student">Élèves</SelectItem>
                <SelectItem value="parent">Parents</SelectItem>
                <SelectItem value="staff">Personnel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action buttons: Generate IDs + Show/Hide all passwords */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateCodes}
              disabled={generatingCodes}
              className="h-8"
              title="Générer un identifiant unique (ELV-001, TCH-001, STF-001…) pour chaque utilisateur qui n'en a pas encore."
            >
              {generatingCodes ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Hash className="w-3.5 h-3.5 mr-1.5" />
              )}
              Générer les identifiants manquants
            </Button>
            <Button
              size="sm"
              variant={showAllPasswords ? 'secondary' : 'outline'}
              onClick={() => setShowAllPasswords((s) => !s)}
              className="h-8"
              title={showAllPasswords ? 'Masquer tous les mots de passe' : 'Afficher tous les mots de passe'}
            >
              {showAllPasswords ? (
                <EyeOff className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <Eye className="w-3.5 h-3.5 mr-1.5" />
              )}
              {showAllPasswords ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
            </Button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{users.length} utilisateur(s) au total</Badge>
            <Badge variant="outline">{filteredUsers.length} affiché(s)</Badge>
            <Badge variant="outline">
              {users.filter((u) => !u.userCode).length} sans identifiant
            </Badge>
            <Badge variant="outline">
              {users.filter((u) => u.passwordStatus === 'none').length} sans mot de passe
            </Badge>
            <Badge variant="outline">
              {users.filter((u) => u.passwordStatus === 'default').length} avec mot de passe par défaut
            </Badge>
          </div>

          {/* Users list */}
          {loading ? (
            <div className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Chargement des utilisateurs…
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
              Aucun utilisateur ne correspond à votre recherche.
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-muted">
              <div className="divide-y divide-border">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentUserId
                  return (
                    <div
                      key={u.id}
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 hover:bg-accent/30 transition-colors ${
                        isSelf ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          {getUserAvatar(u) && <AvatarImage src={getUserAvatar(u)!} alt={u.name} />}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {getUserInitials(u)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-medium truncate">{u.name}</p>
                            {isSelf && (
                              <Badge className="bg-emerald-100 text-emerald-700 text-[9px] dark:bg-emerald-900/50 dark:text-emerald-400">
                                Vous
                              </Badge>
                            )}
                            {!u.active && (
                              <Badge variant="secondary" className="text-[9px]">Inactif</Badge>
                            )}
                          </div>

                          {/* ID (userCode) + Email line */}
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            {u.userCode ? (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(u.userCode!, `id-${u.id}`)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 text-[11px] font-mono font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors"
                                title="Cliquer pour copier l'identifiant"
                              >
                                <Hash className="w-3 h-3" />
                                {u.userCode}
                                {copiedField === `id-${u.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3 opacity-50" />
                                )}
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 text-[11px]">
                                <Hash className="w-3 h-3" />
                                Pas d'ID
                              </span>
                            )}
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                              {u.email}
                              <button
                                type="button"
                                onClick={() => copyToClipboard(u.email, `email-${u.id}`)}
                                className="opacity-40 hover:opacity-100 transition-opacity"
                                title="Copier l'email"
                              >
                                {copiedField === `email-${u.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </p>
                          </div>

                          {/* Password line — shows the actual password value */}
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/60 dark:bg-muted/20 border border-muted-foreground/20 text-[11px] font-mono">
                              <Lock className="w-3 h-3 text-muted-foreground" />
                              {u.passwordStatus === 'none' ? (
                                <span className="text-destructive">aucun mot de passe</span>
                              ) : isPasswordVisible(u.id) ? (
                                <>
                                  <span className="text-foreground">{u.password}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(u.password, `pwd-${u.id}`)}
                                    className="opacity-50 hover:opacity-100 transition-opacity"
                                    title="Copier le mot de passe"
                                  >
                                    {copiedField === `pwd-${u.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </>
                              ) : (
                                <span className="text-muted-foreground tracking-widest">••••••••</span>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleUserReveal(u.id)}
                                className="opacity-50 hover:opacity-100 transition-opacity ml-0.5"
                                title={isPasswordVisible(u.id) ? 'Masquer' : 'Afficher'}
                                aria-label={isPasswordVisible(u.id) ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                              >
                                {isPasswordVisible(u.id) ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </button>
                            </span>
                            <Badge variant="outline" className="text-[9px]">
                              {getRoleLabel(u.role)}
                            </Badge>
                            {u.student?.class && (
                              <Badge variant="outline" className="text-[9px]">{u.student.class.name}</Badge>
                            )}
                            {u.teacher?.subject && (
                              <Badge variant="outline" className="text-[9px]">{u.teacher.subject}</Badge>
                            )}
                            {getPasswordBadge(u)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingUser(u)
                            setNewPassword('')
                            setShowPassword(false)
                          }}
                          className="h-8"
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          <span className="text-xs">Modifier</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResetUserPassword(u)}
                          disabled={resettingUser === u.id}
                          className="h-8"
                          title="Réinitialiser au mot de passe par défaut"
                        >
                          {resettingUser === u.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          <span className="text-xs ml-1 hidden sm:inline">Réinit.</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteUserPassword(u)}
                          className="h-8 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                          title="Supprimer le mot de passe (bloque la connexion)"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span className="text-xs ml-1 hidden sm:inline">Suppr.</span>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="rounded-lg bg-muted/30 dark:bg-muted/10 p-3 space-y-1.5 border border-muted-foreground/15">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Légende & Astuces
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-start gap-2">
                <Hash className="w-3 h-3 mt-0.5 shrink-0 text-emerald-600" />
                <span><strong>ID (ELV-001, TCH-001, STF-001…)</strong> : identifiant de connexion court. Les élèves et le personnel peuvent se connecter avec cet ID <em>au lieu de</em> leur email. Cliquez sur l&apos;ID pour le copier.</span>
              </li>
              <li className="flex items-start gap-2">
                <Eye className="w-3 h-3 mt-0.5 shrink-0" />
                <span><strong>Afficher les mots de passe</strong> : révèle la valeur réelle du mot de passe de chaque compte. Utilisez l&apos;icône œil d&apos;une ligne pour révéler/cacher un seul mot de passe.</span>
              </li>
              <li className="flex items-start gap-2">
                <Pencil className="w-3 h-3 mt-0.5 shrink-0" />
                <span><strong>Modifier</strong> : définit ou modifie le mot de passe de l&apos;utilisateur.</span>
              </li>
              <li className="flex items-start gap-2">
                <RefreshCw className="w-3 h-3 mt-0.5 shrink-0" />
                <span><strong>Réinitialiser</strong> : remet le mot de passe par défaut du rôle (eleve123, enseignant123, parent123, admin123, personnel123).</span>
              </li>
              <li className="flex items-start gap-2">
                <Trash2 className="w-3 h-3 mt-0.5 shrink-0" />
                <span><strong>Supprimer</strong> : efface le mot de passe. L&apos;utilisateur ne pourra plus se connecter tant qu&apos;un nouveau mot de passe ne sera pas défini.</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Edit password dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-600" />
              Définir / modifier le mot de passe
            </DialogTitle>
            <DialogDescription>
              {editingUser?.passwordStatus === 'none'
                ? `Définissez un mot de passe pour "${editingUser?.name}". Cet utilisateur pourra ensuite se connecter.`
                : `Modifiez le mot de passe de "${editingUser?.name}".`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <Avatar className="h-10 w-10">
                {editingUser && getUserAvatar(editingUser) && (
                  <AvatarImage src={getUserAvatar(editingUser)!} alt={editingUser.name} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {editingUser ? getUserInitials(editingUser) : '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{editingUser?.name}</p>
                <p className="text-xs text-muted-foreground">{editingUser?.email}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-new-pwd" className="text-xs">
                Nouveau mot de passe <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="user-new-pwd"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Au moins 3 caractères"
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ce mot de passe sera immédiatement actif pour cet utilisateur.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)} disabled={savingPassword}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveUserPassword}
              disabled={savingPassword || newPassword.trim().length < 3}
            >
              {savingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete password dialog */}
      <AlertDialog
        open={!!confirmDeleteUser}
        onOpenChange={(open) => !open && setConfirmDeleteUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Supprimer le mot de passe de « {confirmDeleteUser?.name} » ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDeleteUser?.id === currentUserId
                ? 'Vous êtes sur le point de supprimer votre PROPRE mot de passe. Vous serez déconnecté(e) et ne pourrez plus vous reconnecter tant qu\'un autre administrateur n\'aura pas défini un nouveau mot de passe pour vous.'
                : `Cet utilisateur ne pourra plus se connecter à l'application tant qu'un nouveau mot de passe ne sera pas défini. L'opération est réversible (il suffit de définir un nouveau mot de passe).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingPassword}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePassword}
              disabled={savingPassword}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {savingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Suppression…
                </>
              ) : (
                'Supprimer définitivement'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
