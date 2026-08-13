'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Building2, Users, Pencil, Trash2, Plus, Loader2, Mail, Phone,
  MapPin, Save, X, Camera, Search, Eye, EyeOff, Key, UserCheck, Lock,
  GraduationCap, BookOpen, Heart, Briefcase, AlertTriangle, Check, ChevronDown,
  ArrowLeft, CreditCard, CalendarDays, UserCircle, Activity, LayoutDashboard,
  Table2, UsersRound, UserCog, ClipboardList, Receipt, Wand2, Sparkles, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAppStore } from '@/lib/store'
import { withSchoolYear, getImageUrl } from '@/lib/utils'
import { useAvatarChangedListener } from '@/hooks/use-avatar-refresh'

// ---------- Types ----------
interface Institution {
  id: string
  name: string
  password: string
  address: string | null
  phone: string | null
  email: string | null
  currentYear: string
  active: boolean
  createdAt: string
  _count?: { users: number; classes: number }
}

interface AdminUser {
  id: string
  userCode: string
  email: string
  name: string
  role: string
  avatar: string | null
  phone: string | null
  active: boolean
  institutionId: string
  institution?: { id: string; name: string }
  // Returned by the API (which uses Prisma `include`, not `select`) so the
  // frontend can build a cache-busted avatar URL via getImageUrl().
  updatedAt?: string
  // Only populated when fetched with `includePassword=true` (super admin
  // "Liste des administrateurs" tab). Other callers receive this field
  // stripped by the API.
  password?: string
}

interface StudentItem {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  gender: string | null
  parentContact: string | null
  parentPhone: string | null
  classId: string | null
  parentId: string | null
  user: { id: string; email: string; phone: string | null; active: boolean; userCode: string }
  class: { id: string; name: string; level: string } | null
  parent: { id: string; firstName: string; lastName: string; phone: string | null } | null
}

interface TeacherItem {
  id: string
  firstName: string
  lastName: string
  subject: string
  phone: string | null
  qualification: string | null
  hireDate: string
  user: { id: string; email: string; phone: string | null; active: boolean; userCode: string }
  classes: { class: { id: string; name: string } }[]
}

interface ParentItem {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  address: string | null
  user: { id: string; email: string; phone: string | null; active: boolean; userCode: string }
  children: { id: string; firstName: string; lastName: string }[]
}

interface StaffItem {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  fonction: string
  user: { id: string; email: string; phone: string | null; active: boolean; userCode: string }
}

interface ClassItem {
  id: string
  name: string
  level: string
  section: string | null
  capacity: number
  room: string | null
  schoolYear: string
  studentCount: number
  teachers: { teacher: { id: string; firstName: string; lastName: string } }[]
}

interface PaymentItem {
  id: string
  amount: number
  type: string
  method: string
  status: string
  reference: string | null
  description: string | null
  paymentDate: string | null
  createdAt: string
  student: { id: string; firstName: string; lastName: string; class: { id: string; name: string } | null }
}

interface InstitutionData {
  students: StudentItem[]
  teachers: TeacherItem[]
  parents: ParentItem[]
  staff: StaffItem[]
  classes: ClassItem[]
  subjects: { id: string; name: string; code: string; coefficient: number }[]
  payments: PaymentItem[]
  paymentStats: { total: number; completed: number; pending: number; failed: number; totalAmount: number; completedAmount: number }
  attendanceStats: Record<string, number>
  gradeStats: { count: number; average: number }
  users: { id: string; userCode: string; name: string; email: string; role: string; avatar: string | null; active: boolean }[]
  announcementCount: number
  eventCount: number
}

type DetailTab = 'overview' | 'students' | 'teachers' | 'parents' | 'staff' | 'classes' | 'payments'

// ---------- Main Component ----------
export default function SuperAdminModule() {
  const {
    currentUser, updateSuperAdmin, superAdminAddress,
    setInstitution, clearInstitution, addToast,
  } = useAppStore()
  const schoolYear = useAppStore((s) => s.schoolYear)

  // Derive super admin fields from currentUser
  const isSuperAdmin = currentUser?.role === 'super_admin'
  const superAdminId = currentUser?.id || ''
  const superAdminName = currentUser?.name || ''
  const superAdminEmail = currentUser?.email || ''
  const superAdminAvatar = currentUser?.avatar || null
  const superAdminPhone = currentUser?.phone || null

  const [activeTab, setActiveTab] = useState<'profile' | 'institutions' | 'admins' | 'admins-list'>('institutions')

  // Profile state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(superAdminName || '')
  const [editEmail, setEditEmail] = useState(superAdminEmail || '')
  const [editPhone, setEditPhone] = useState(superAdminPhone || '')
  const [editAddress, setEditAddress] = useState(superAdminAddress || '')
  const [saving, setSaving] = useState(false)

  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // Institutions state
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loadingInst, setLoadingInst] = useState(false)
  const [showInstForm, setShowInstForm] = useState(false)
  const [editingInst, setEditingInst] = useState<Institution | null>(null)
  const [instForm, setInstForm] = useState({
    name: '',
    password: '',
    address: '',
    phone: '',
    email: '',
    currentYear: '2024-2025',
    // Auto-seed options: when autoSeed is true, the new institution is
    // filled with demo data (1 staff, 1 parent, 4 teachers, 3 classes,
    // 12 students, 2 announcements, 2 messages). The admin user is
    // created from the adminName / adminEmail / adminPassword fields.
    autoSeed: true,
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  })
  const [creatingInst, setCreatingInst] = useState(false)
  const [showInstAdminPassword, setShowInstAdminPassword] = useState(false)
  const [showInstPassword, setShowInstPassword] = useState<string | null>(null)
  const [deletingInst, setDeletingInst] = useState<Institution | null>(null)
  const [deleteMode, setDeleteMode] = useState<'deactivate' | 'permanent'>('deactivate')
  const [deletingInstBusy, setDeletingInstBusy] = useState(false)
  // Password reset state
  const [resetPwdInst, setResetPwdInst] = useState<Institution | null>(null)
  const [newInstPassword, setNewInstPassword] = useState('')
  const [resetPwdBusy, setResetPwdBusy] = useState(false)
  const [showNewInstPassword, setShowNewInstPassword] = useState(false)
  // Toggle institution active/blocked state (Super Admin power)
  const [togglingInstId, setTogglingInstId] = useState<string | null>(null)
  const [confirmToggleInst, setConfirmToggleInst] = useState<Institution | null>(null)

  // Opened institution state
  const [openedInst, setOpenedInst] = useState<Institution | null>(null)
  const [instData, setInstData] = useState<InstitutionData | null>(null)
  const [loadingBrowse, setLoadingBrowse] = useState(false)
  const [detailTab, setDetailTab] = useState<DetailTab>('overview')
  const [searchQuery, setSearchQuery] = useState('')

  // Admins state
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loadingAdmins, setLoadingAdmins] = useState(false)
  const [showAdminForm, setShowAdminForm] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null)
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '', phone: '', institutionId: '' })
  const [showAdminPassword, setShowAdminPassword] = useState<string | null>(null)
  const [deletingAdmin, setDeletingAdmin] = useState<AdminUser | null>(null)

  // "Liste des administrateurs" tab — same data as `admins` but fetched with
  // `includePassword=true` so the super admin can see each admin's plaintext
  // password (the DB stores them unhashed). Kept as a separate state because
  // the editable "Administrateurs" tab must NOT receive passwords.
  const [adminList, setAdminList] = useState<AdminUser[]>([])
  const [loadingAdminList, setLoadingAdminList] = useState(false)
  // Per-row reveal toggle for passwords. Stores admin IDs whose password
  // is currently visible. Empty = all hidden.
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set())
  const [adminListSearch, setAdminListSearch] = useState('')

  // Entity CRUD state
  const [deletingEntity, setDeletingEntity] = useState<{ type: string; id: string; name: string } | null>(null)
  const [entityFormOpen, setEntityFormOpen] = useState(false)
  const [editingEntity, setEditingEntity] = useState<{ type: string; data: Record<string, unknown> } | null>(null)
  const [entityFormType, setEntityFormType] = useState<string>('')
  const [entityForm, setEntityForm] = useState<Record<string, string>>({})
  const [entitySaving, setEntitySaving] = useState(false)

  // Avatar state
  const [avatarUploading, setAvatarUploading] = useState(false)

  // Fetch institutions
  const fetchInstitutions = useCallback(async () => {
    setLoadingInst(true)
    try {
      const res = await fetch('/api/institutions', {
        headers: { 'x-user-role': 'super_admin', 'x-institution-id': '' },
        cache: 'no-store' as RequestCache,
      })
      if (res.ok) {
        const data = await res.json()
        setInstitutions(data.institutions || [])
      } else {
        // Show a visible error so the user knows the list failed to load
        // (instead of silently showing an empty list).
        const errData = await res.json().catch(() => ({}))
        console.error('[fetchInstitutions] HTTP', res.status, errData)
        addToast('error', 'Erreur de chargement', errData.error || `Impossible de charger les institutions (${res.status})`)
      }
    } catch (e) {
      console.error('[fetchInstitutions] network error', e)
      addToast('error', 'Erreur réseau', 'Impossible de contacter le serveur pour charger les institutions')
    } finally {
      setLoadingInst(false)
    }
  }, [addToast])

  // Fetch admins
  const fetchAdmins = useCallback(async () => {
    setLoadingAdmins(true)
    try {
      const res = await fetch('/api/superadmin/admins', {
        headers: { 'x-super-admin-id': superAdminId || '' },
        cache: 'no-store' as RequestCache,
      })
      if (res.ok) {
        const data = await res.json()
        setAdmins(data.admins || [])
      }
    } catch { /* silent */ } finally {
      setLoadingAdmins(false)
    }
  }, [superAdminId])

  // Fetch the admin list WITH passwords (super admin only). This is a
  // separate fetch from `fetchAdmins` because the editable admins tab must
  // not receive passwords, and we don't want to leak them into the `admins`
  // state used elsewhere. Adds `includePassword=true` so the API includes
  // the plaintext `password` field on each admin row.
  const fetchAdminList = useCallback(async () => {
    setLoadingAdminList(true)
    try {
      const res = await fetch('/api/superadmin/admins?includePassword=true', {
        headers: {
          'x-super-admin-id': superAdminId || '',
          'x-user-role': 'super_admin',
        },
        cache: 'no-store' as RequestCache,
      })
      if (res.ok) {
        const data = await res.json()
        setAdminList(data.admins || [])
      }
    } catch { /* silent */ } finally {
      setLoadingAdminList(false)
    }
  }, [superAdminId])

  // Toggle password visibility for a single admin row.
  const toggleRevealPassword = useCallback((id: string) => {
    setRevealedPasswords((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Copy a single value (id / email / password) to the clipboard.
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const copyToClipboard = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(key)
      setTimeout(() => setCopiedField(null), 1500)
    } catch { /* silent */ }
  }, [])

  // Browse institution data
  const fetchInstData = useCallback(async (instId: string) => {
    setLoadingBrowse(true)
    try {
      const res = await fetch(withSchoolYear(`/api/superadmin/browse?institutionId=${instId}`, schoolYear), {
        headers: { 'x-super-admin-id': superAdminId || '' },
        cache: 'no-store' as RequestCache,
      })
      if (res.ok) {
        const data = await res.json()
        setInstData(data)
      }
    } catch { /* silent */ } finally {
      setLoadingBrowse(false)
    }
  }, [superAdminId, schoolYear])

  useEffect(() => {
    if (isSuperAdmin) {
      fetchInstitutions()
      fetchAdmins()
    }
  }, [isSuperAdmin, fetchInstitutions, fetchAdmins])

  // Fetch the password-bearing admin list only when the super admin actually
  // opens the "Liste des administrateurs" tab — avoids pulling plaintext
  // passwords into memory unnecessarily.
  useEffect(() => {
    if (isSuperAdmin && activeTab === 'admins-list') {
      fetchAdminList()
    }
  }, [isSuperAdmin, activeTab, fetchAdminList])

  // Re-fetch the admins list whenever an avatar changes elsewhere in the app
  // (e.g. an admin updates their photo in the Settings page) so the
  // cache-busted avatar URL is used immediately.
  useAvatarChangedListener(() => {
    if (isSuperAdmin) {
      fetchAdmins()
    }
  }, [isSuperAdmin, fetchAdmins])

  // Auto-refresh the institutions list when the user returns to this tab/window.
  // This handles the common case where a super admin creates an institution via
  // the self-service signup flow in another tab, then comes back here — the list
  // must reflect the newly created institution without requiring a manual refresh.
  useEffect(() => {
    if (!isSuperAdmin) return
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchInstitutions()
      }
    }
    const handleFocus = () => fetchInstitutions()
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [isSuperAdmin, fetchInstitutions])

  // Open an institution
  const handleOpenInstitution = (inst: Institution) => {
    setOpenedInst(inst)
    setDetailTab('overview')
    setSearchQuery('')
    fetchInstData(inst.id)
    // Set institution context in store so other modules can use it
    setInstitution(inst.id, inst.name, inst.password)
  }

  // Select an institution by id from the dropdown (opens its separate detail view)
  const handleSelectInstitution = (instId: string) => {
    const inst = institutions.find((i) => i.id === instId)
    if (inst) handleOpenInstitution(inst)
  }

  // Close opened institution
  const handleCloseInstitution = () => {
    setOpenedInst(null)
    setInstData(null)
    // Clear institution context when closing
    clearInstitution()
  }

  // Super admin headers for CRUD operations
  const saHeaders = (extra: Record<string, string> = {}) => ({
    'Content-Type': 'application/json',
    'x-user-role': 'super_admin',
    'x-super-admin-id': superAdminId || '',
    'x-institution-id': openedInst?.id || '',
    ...extra,
  })

  // Entity CRUD helpers
  const handleCreateEntity = (type: string) => {
    setEntityFormType(type)
    setEditingEntity(null)
    setEntityForm(getDefaultForm(type))
    setEntityFormOpen(true)
  }

  const handleEditEntity = (type: string, data: Record<string, unknown>) => {
    setEntityFormType(type)
    setEditingEntity({ type, data })
    setEntityForm(prefillForm(type, data))
    setEntityFormOpen(true)
  }

  const handleSaveEntity = async () => {
    setEntitySaving(true)
    try {
      const isEdit = !!editingEntity
      const url = getEntityUrl(entityFormType, isEdit ? (editingEntity?.data.id as string) : undefined)
      const method = isEdit ? 'PUT' : 'POST'
      const body = buildEntityBody(entityFormType, entityForm, isEdit)

      const res = await fetch(withSchoolYear(url, schoolYear), { method, headers: saHeaders(), body: JSON.stringify(body) })
      if (res.ok) {
        addToast('success', isEdit ? 'Modifié' : 'Créé', `${entityLabel(entityFormType)} ${isEdit ? 'modifié' : 'créé'} avec succès`)
        setEntityFormOpen(false)
        setEditingEntity(null)
        if (openedInst) fetchInstData(openedInst.id)
      } else {
        const data = await res.json()
        addToast('error', 'Erreur', data.error || 'Erreur lors de l\'enregistrement')
      }
    } catch (e) {
      addToast('error', 'Erreur réseau', String(e))
    } finally {
      setEntitySaving(false)
    }
  }

  const handleDeleteEntity = async () => {
    if (!deletingEntity) return
    try {
      const url = getEntityUrl(deletingEntity.type, deletingEntity.id)
      const res = await fetch(withSchoolYear(url, schoolYear), { method: 'DELETE', headers: saHeaders() })
      if (res.ok) {
        addToast('success', 'Supprimé', `${entityLabel(deletingEntity.type)} supprimé avec succès`)
        setDeletingEntity(null)
        if (openedInst) fetchInstData(openedInst.id)
      } else {
        const data = await res.json()
        addToast('error', 'Erreur', data.error || 'Erreur lors de la suppression')
      }
    } catch (e) {
      addToast('error', 'Erreur réseau', String(e))
    }
  }

  if (!isSuperAdmin) {
    return <div className="p-6 text-center text-muted-foreground">Accès non autorisé</div>
  }

  // Profile save
  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/superadmin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-super-admin-id': superAdminId || '' },
        body: JSON.stringify({ name: editName, email: editEmail, phone: editPhone, address: editAddress }),
      })
      if (res.ok) {
        const data = await res.json()
        updateSuperAdmin({ name: data.superAdmin.name, email: data.superAdmin.email, phone: data.superAdmin.phone, address: data.superAdmin.address })
        setEditing(false)
      } else {
        const data = await res.json()
        alert(data.error || 'Erreur lors de la mise à jour')
      }
    } catch { /* silent */ } finally {
      setSaving(false)
    }
  }

  // Password change
  const handleChangePassword = async () => {
    setPasswordError('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Tous les champs sont requis')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    setPasswordSaving(true)
    try {
      const res = await fetch('/api/superadmin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-super-admin-id': superAdminId || '' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (res.ok) {
        setPasswordDialogOpen(false)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const data = await res.json()
        setPasswordError(data.error || 'Erreur lors du changement de mot de passe')
      }
    } catch {
      setPasswordError('Erreur réseau')
    } finally {
      setPasswordSaving(false)
    }
  }

  // Avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        const res = await fetch('/api/superadmin/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-super-admin-id': superAdminId || '' },
          body: JSON.stringify({ avatar: base64 }),
        })
        if (res.ok) {
          const data = await res.json()
          updateSuperAdmin({ avatar: data.superAdmin.avatar })
        }
        setAvatarUploading(false)
      }
      reader.readAsDataURL(file)
    } catch {
      setAvatarUploading(false)
    }
  }

  // Avatar delete
  const handleAvatarDelete = async () => {
    try {
      const res = await fetch('/api/superadmin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-super-admin-id': superAdminId || '' },
        body: JSON.stringify({ avatar: null }),
      })
      if (res.ok) {
        updateSuperAdmin({ avatar: null })
      }
    } catch { /* silent */ }
  }

  // Institution CRUD
  const handleCreateInstitution = async () => {
    if (!instForm.name || !instForm.password) {
      addToast('warning', 'Champs requis', 'Le nom et le mot de passe sont obligatoires')
      return
    }
    // When NOT auto-seeding, an admin email + password are required so the
    // user can actually log in to the freshly created (empty) institution.
    if (!instForm.autoSeed && (!instForm.adminEmail || !instForm.adminPassword)) {
      addToast('warning', 'Champs requis', 'Veuillez fournir un email et un mot de passe admin (ou activer le remplissage automatique)')
      return
    }
    if (instForm.adminPassword && instForm.adminPassword.length < 6) {
      addToast('warning', 'Mot de passe trop court', 'Le mot de passe admin doit contenir au moins 6 caractères')
      return
    }
    setCreatingInst(true)
    try {
      const res = await fetch('/api/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'super_admin' },
        body: JSON.stringify(instForm),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (instForm.autoSeed) {
          const stats = data?.stats
          const detail = stats
            ? `${stats.students || 0} élèves, ${stats.teachers || 0} enseignants, ${stats.classes || 0} classes`
            : 'données de démonstration créées'
          addToast('success', 'Institution créée avec données de démonstration', `${instForm.name} — ${detail}`)
          if (data?.admin?.email) {
            addToast('info', 'Compte admin', `Connectez-vous avec : ${data.admin.email}`)
          }
        } else {
          addToast('success', 'Institution créée', `${instForm.name} a été créée (vide)`)
          if (data?.admin?.email) {
            addToast('info', 'Compte admin', `Connectez-vous avec : ${data.admin.email}`)
          }
        }
        setShowInstForm(false)
        setInstForm({ name: '', password: '', address: '', phone: '', email: '', currentYear: '2024-2025', autoSeed: true, adminName: '', adminEmail: '', adminPassword: '' })
        fetchInstitutions()
      } else {
        const data = await res.json()
        addToast('error', 'Erreur de création', data.error || 'Erreur inconnue')
      }
    } catch (e) {
      addToast('error', 'Erreur réseau', String(e))
    } finally {
      setCreatingInst(false)
    }
  }

  // Auto-fill admin fields from the institution name (helper for the
  // "Générer" button in the create-institution dialog).
  const generateAdminCredentialsFromName = () => {
    const slug = (instForm.name || 'institution')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 20) || 'institution'
    const rnd = Math.random().toString(36).slice(2, 6)
    setInstForm({
      ...instForm,
      adminName: `Administrateur ${instForm.name || ''}`.trim(),
      adminEmail: `admin.${slug}.${rnd}@demo.cm`,
      adminPassword: 'admin123',
    })
  }

  const handleUpdateInstitution = async () => {
    if (!editingInst) return
    try {
      const res = await fetch('/api/institutions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'super_admin' },
        body: JSON.stringify({ id: editingInst.id, ...instForm }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        // The server syncs the institution's admin User.password with the
        // new Institution.password — so the admin can immediately log in
        // on the login page with the new password.
        const syncNote = data.syncedAdminCount > 0
          ? ` Le mot de passe de connexion de l'administrateur a été mis à jour (${data.syncedAdminCount}).`
          : ''
        addToast('success', 'Institution modifiée', `${instForm.name} a été mise à jour.${syncNote}`)
        setEditingInst(null)
        setInstForm({ name: '', password: '', address: '', phone: '', email: '', currentYear: '2024-2025', autoSeed: true, adminName: '', adminEmail: '', adminPassword: '' })
        fetchInstitutions()
        // If the opened institution was edited, update it too
        if (openedInst && openedInst.id === editingInst.id) {
          setOpenedInst({ ...openedInst, ...instForm })
        }
      } else {
        const data = await res.json()
        addToast('error', 'Erreur de modification', data.error || 'Erreur inconnue')
      }
    } catch (e) {
      addToast('error', 'Erreur réseau', String(e))
    }
  }

  const handleDeleteInstitution = async () => {
    if (!deletingInst) return
    setDeletingInstBusy(true)
    try {
      const res = await fetch('/api/institutions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'super_admin' },
        body: JSON.stringify({ id: deletingInst.id, mode: deleteMode }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        addToast('success', 'Action effectuée', data.message || `Institution ${deleteMode === 'permanent' ? 'supprimée' : 'désactivée'}`)
        setDeletingInst(null)
        // If we were viewing this institution, go back to list
        if (openedInst && openedInst.id === deletingInst.id) {
          handleCloseInstitution()
        }
        fetchInstitutions()
      } else {
        const data = await res.json()
        addToast('error', 'Erreur de suppression', data.error || 'Erreur inconnue')
      }
    } catch (e) {
      addToast('error', 'Erreur réseau', String(e))
    } finally {
      setDeletingInstBusy(false)
    }
  }

  // ---- Toggle institution active/blocked (Super Admin power) ----
  // Blocks (deactivate) or reactivates an institution. When blocking, all the
  // institution's users are deactivated and their active sessions ended, so
  // they can't keep using the app even if already logged in. When reactivating,
  // only the institution is re-enabled — individual users must be re-enabled
  // separately (intentional, to avoid re-granting access to accounts disabled
  // for cause).
  // State `togglingInstId` and `confirmToggleInst` are declared with the other
  // institution states at the top of the component (React hooks rules).

  const handleToggleInstitutionActive = async (inst: Institution) => {
    setTogglingInstId(inst.id)
    try {
      const res = await fetch(`/api/institutions/${inst.id}/toggle-active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'super_admin', 'x-user-id': superAdminId },
        body: JSON.stringify({ active: !inst.active }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        addToast(
          inst.active ? 'warning' : 'success',
          inst.active ? 'Institution bloquée' : 'Institution réactivée',
          data.message || (inst.active
            ? `« ${inst.name} » est maintenant désactivée. Ses utilisateurs ne peuvent plus se connecter.`
            : `« ${inst.name} » est de nouveau active.`)
        )
        setConfirmToggleInst(null)
        fetchInstitutions()
        // If we were viewing this institution, update the opened card too
        if (openedInst && openedInst.id === inst.id) {
          setOpenedInst({ ...openedInst, active: !inst.active })
        }
      } else {
        addToast('error', 'Erreur', data.error || 'Erreur inconnue')
      }
    } catch (e) {
      addToast('error', 'Erreur réseau', String(e))
    } finally {
      setTogglingInstId(null)
    }
  }

  // Reset institution password
  const handleResetInstitutionPassword = async () => {
    if (!resetPwdInst || !newInstPassword) {
      addToast('warning', 'Mot de passe requis', 'Veuillez saisir un nouveau mot de passe')
      return
    }
    if (newInstPassword.length < 3) {
      addToast('warning', 'Mot de passe trop court', 'Le mot de passe doit contenir au moins 3 caractères')
      return
    }
    setResetPwdBusy(true)
    try {
      const res = await fetch('/api/institutions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'super_admin' },
        body: JSON.stringify({ id: resetPwdInst.id, password: newInstPassword }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        // The server syncs the institution's admin User.password with the
        // new Institution.password — so the admin can immediately log in
        // on the login page with the new password.
        const syncNote = data.syncedAdminCount > 0
          ? ` L'administrateur peut maintenant se connecter avec ce nouveau mot de passe.`
          : ''
        addToast('success', 'Mot de passe modifié', `Le mot de passe de ${resetPwdInst.name} a été mis à jour.${syncNote}`)
        setResetPwdInst(null)
        setNewInstPassword('')
        fetchInstitutions()
        if (openedInst && openedInst.id === resetPwdInst.id) {
          setOpenedInst({ ...openedInst, password: newInstPassword })
        }
      } else {
        const data = await res.json()
        addToast('error', 'Erreur', data.error || 'Erreur inconnue')
      }
    } catch (e) {
      addToast('error', 'Erreur réseau', String(e))
    } finally {
      setResetPwdBusy(false)
    }
  }

  // Admin CRUD
  const handleCreateAdmin = async () => {
    if (!adminForm.name || !adminForm.email || !adminForm.password || !adminForm.institutionId) {
      addToast('warning', 'Champs requis', 'Tous les champs marqués * sont obligatoires')
      return
    }
    try {
      const res = await fetch('/api/superadmin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-super-admin-id': superAdminId || '' },
        body: JSON.stringify(adminForm),
      })
      if (res.ok) {
        addToast('success', 'Admin créé', `${adminForm.name} a été créé avec succès`)
        setShowAdminForm(false)
        setAdminForm({ name: '', email: '', password: '', phone: '', institutionId: '' })
        fetchAdmins()
      } else {
        const data = await res.json()
        addToast('error', 'Erreur', data.error || 'Erreur inconnue')
      }
    } catch (e) {
      addToast('error', 'Erreur réseau', String(e))
    }
  }

  const handleUpdateAdmin = async () => {
    if (!editingAdmin) return
    try {
      const body: Record<string, string> = { id: editingAdmin.id }
      if (adminForm.name) body.name = adminForm.name
      if (adminForm.email) body.email = adminForm.email
      if (adminForm.password) body.password = adminForm.password
      if (adminForm.phone) body.phone = adminForm.phone
      if (adminForm.institutionId) body.institutionId = adminForm.institutionId

      const res = await fetch('/api/superadmin/admins', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-super-admin-id': superAdminId || '' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        addToast('success', 'Admin modifié', `${editingAdmin.name} a été mis à jour`)
        setEditingAdmin(null)
        setAdminForm({ name: '', email: '', password: '', phone: '', institutionId: '' })
        fetchAdmins()
      } else {
        const data = await res.json()
        addToast('error', 'Erreur', data.error || 'Erreur inconnue')
      }
    } catch (e) {
      addToast('error', 'Erreur réseau', String(e))
    }
  }

  const handleDeleteAdmin = async () => {
    if (!deletingAdmin) return
    try {
      const res = await fetch('/api/superadmin/admins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-super-admin-id': superAdminId || '' },
        body: JSON.stringify({ id: deletingAdmin.id }),
      })
      if (res.ok) {
        addToast('success', 'Admin supprimé', `${deletingAdmin.name} a été supprimé`)
        setDeletingAdmin(null)
        fetchAdmins()
      } else {
        const data = await res.json()
        addToast('error', 'Erreur', data.error || 'Erreur inconnue')
      }
    } catch (e) {
      addToast('error', 'Erreur réseau', String(e))
    }
  }

  // Animation variants
  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }
  const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

  const tabs = [
    { key: 'institutions' as const, label: 'Institutions', icon: Building2 },
    { key: 'admins' as const, label: 'Administrateurs', icon: Users },
    { key: 'admins-list' as const, label: 'Liste des administrateurs', icon: Table2 },
    { key: 'profile' as const, label: 'Mon Profil', icon: Shield },
  ]

  const detailTabs: { key: DetailTab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
    { key: 'students', label: 'Élèves', icon: GraduationCap },
    { key: 'teachers', label: 'Enseignants', icon: BookOpen },
    { key: 'parents', label: 'Parents', icon: Heart },
    { key: 'staff', label: 'Personnel', icon: Briefcase },
    { key: 'classes', label: 'Classes', icon: Table2 },
    { key: 'payments', label: 'Paiements', icon: Receipt },
  ]

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    teacher: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    student: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    parent: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    staff: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  }
  const roleLabels: Record<string, string> = {
    admin: 'Admin', teacher: 'Enseignant', student: 'Élève', parent: 'Parent', staff: 'Personnel',
  }

  // Search filter helper
  const filterBySearch = <T,>(items: T[], searchFn: (item: T) => string) => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(item => searchFn(item).toLowerCase().includes(q))
  }

  // Payment status/label helpers
  const paymentStatusLabel: Record<string, string> = { completed: 'Complété', pending: 'En attente', failed: 'Échoué' }
  const paymentStatusColor: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  }
  const paymentTypeLabel: Record<string, string> = { tuition: 'Scolarité', registration: 'Inscription', exam_fee: 'Frais d\'examen', other: 'Autre' }
  const paymentMethodLabel: Record<string, string> = { cash: 'Espèces', mobile_money: 'Mobile Money', bank_transfer: 'Virement' }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Tab Navigation */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setActiveTab(tab.key); handleCloseInstitution() }}
                className={activeTab === tab.key ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700' : ''}
              >
                <Icon className="w-4 h-4 mr-1.5" />
                {tab.label}
              </Button>
            )
          })}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ============= INSTITUTIONS TAB ============= */}
        {activeTab === 'institutions' && (
          <motion.div key="institutions" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">

            {/* === Institution List View === */}
            {!openedInst && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Gestion des Institutions</h2>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => fetchInstitutions()}
                      disabled={loadingInst}
                      variant="outline"
                      size="sm"
                      className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950/40"
                      title="Rafraîchir la liste des institutions"
                    >
                      <RefreshCw className={`w-4 h-4 mr-1.5 ${loadingInst ? 'animate-spin' : ''}`} />
                      Actualiser
                    </Button>
                    <Button onClick={() => { setInstForm({ name: '', password: '', address: '', phone: '', email: '', currentYear: '2024-2025', autoSeed: true, adminName: '', adminEmail: '', adminPassword: '' }); setShowInstForm(true) }} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700">
                      <Plus className="w-4 h-4 mr-1.5" />
                      Nouvelle institution
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">Cliquez sur une institution pour ouvrir et consulter ses données, ou sélectionnez-la dans la liste déroulante ci-dessous.</p>

                {/* === Dropdown selector to view an institution separately === */}
                <Card className="border-2 border-orange-200 dark:border-orange-900/40 bg-gradient-to-br from-orange-50/60 to-amber-50/40 dark:from-orange-950/20 dark:to-amber-950/10">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-2 sm:w-56 shrink-0">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold leading-tight">Consulter une institution</p>
                          <p className="text-[11px] text-muted-foreground">Sélectionnez pour la visualiser séparément</p>
                        </div>
                      </div>
                      <div className="flex-1">
                        <Select
                          value={openedInst?.id || ''}
                          onValueChange={handleSelectInstitution}
                          disabled={loadingInst || institutions.length === 0}
                        >
                          <SelectTrigger className="w-full h-11 bg-background">
                            <SelectValue placeholder={loadingInst ? 'Chargement des institutions…' : institutions.length === 0 ? 'Aucune institution disponible' : '— Sélectionner une institution —'} />
                          </SelectTrigger>
                          <SelectContent className="max-h-80">
                            {institutions.map((inst) => (
                              <SelectItem key={inst.id} value={inst.id}>
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                  <span className="truncate">{inst.name}</span>
                                  <Badge variant={inst.active ? 'default' : 'secondary'} className="text-[9px] h-4 px-1 ml-1 shrink-0">
                                    {inst.active ? 'Active' : 'Inactive'}
                                  </Badge>
                                  {inst._count ? (
                                    <span className="text-[10px] text-muted-foreground ml-1 shrink-0">
                                      {inst._count.users} utilisateurs
                                    </span>
                                  ) : null}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Divider hint */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="h-px bg-border flex-1" />
                  <span className="uppercase tracking-wide">ou parcourez la grille ci-dessous</span>
                  <div className="h-px bg-border flex-1" />
                </div>

                {loadingInst ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {institutions.map((inst) => (
                      <Card
                        key={inst.id}
                        className="relative group hover:shadow-lg transition-all cursor-pointer border-2 hover:border-orange-300 dark:hover:border-orange-700"
                        onClick={() => handleOpenInstitution(inst)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white">
                                <Building2 className="w-5 h-5" />
                              </div>
                              <div>
                                <CardTitle className="text-base">{inst.name}</CardTitle>
                                <p className="text-xs text-muted-foreground">{inst.currentYear}</p>
                              </div>
                            </div>
                            <Badge variant={inst.active ? 'default' : 'secondary'} className="text-[10px]">
                              {inst.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Key className="w-3.5 h-3.5" />
                            {showInstPassword === inst.id ? (
                              <span className="font-mono">{inst.password}</span>
                            ) : (
                              <span className="font-mono">••••••••</span>
                            )}
                            <button type="button" onClick={(e) => { e.stopPropagation(); setShowInstPassword(showInstPassword === inst.id ? null : inst.id) }} className="ml-auto cursor-pointer">
                              {showInstPassword === inst.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          {inst.email && <div className="text-xs text-muted-foreground truncate">✉ {inst.email}</div>}
                          {inst.phone && <div className="text-xs text-muted-foreground">📞 {inst.phone}</div>}
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{inst._count?.users || 0}</span>
                            <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" />{inst._count?.classes || 0} classes</span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1.5 flex-wrap">
                              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => {
                                setEditingInst(inst)
                                setInstForm({ name: inst.name, password: inst.password, address: inst.address || '', phone: inst.phone || '', email: inst.email || '', currentYear: inst.currentYear })
                              }}>
                                <Pencil className="w-3 h-3 mr-1" /> Modifier
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7"
                                title="Changer le mot de passe"
                                onClick={() => { setResetPwdInst(inst); setNewInstPassword(''); setShowNewInstPassword(false) }}
                              >
                                <Key className="w-3 h-3" />
                              </Button>
                              {inst.active ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950/40"
                                  title="Bloquer cette institution (désactive tous ses utilisateurs)"
                                  disabled={togglingInstId === inst.id}
                                  onClick={() => setConfirmToggleInst(inst)}
                                >
                                  {togglingInstId === inst.id ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <Lock className="w-3 h-3 mr-1" />
                                  )}
                                  Bloquer
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 text-emerald-600 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950/40"
                                  title="Réactiver cette institution"
                                  disabled={togglingInstId === inst.id}
                                  onClick={() => setConfirmToggleInst(inst)}
                                >
                                  {togglingInstId === inst.id ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3 mr-1" />
                                  )}
                                  Réactiver
                                </Button>
                              )}
                              <Button variant="destructive" size="sm" className="text-xs h-7" onClick={() => { setDeletingInst(inst); setDeleteMode('deactivate') }}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                            <button
                              type="button"
                              className="text-xs text-orange-500 font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform hover:text-orange-700 cursor-pointer"
                              onClick={() => handleOpenInstitution(inst)}
                            >
                              Ouvrir <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {institutions.length === 0 && (
                      <div className="col-span-full text-center py-12 text-muted-foreground">
                        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Aucune institution</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* === Opened Institution Detail View === */}
            {openedInst && (
              <div className="space-y-4">
                {/* Header with back button */}
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={handleCloseInstitution}>
                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                    Retour
                  </Button>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{openedInst.name}</h2>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <Badge variant={openedInst.active ? 'default' : 'secondary'} className="text-[10px]">
                          {openedInst.active ? 'Active' : 'Inactive'}
                        </Badge>
                        <span>{openedInst.currentYear}</span>
                        {openedInst.email && <span>✉ {openedInst.email}</span>}
                        {openedInst.phone && <span>📞 {openedInst.phone}</span>}
                      </div>
                    </div>
                  </div>
                  {/* Quick edit/delete on opened view */}
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditingInst(openedInst)
                      setInstForm({ name: openedInst.name, password: openedInst.password, address: openedInst.address || '', phone: openedInst.phone || '', email: openedInst.email || '', currentYear: openedInst.currentYear })
                    }}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Modifier
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setResetPwdInst(openedInst); setNewInstPassword(''); setShowNewInstPassword(false) }}>
                      <Key className="w-3.5 h-3.5 mr-1.5" /> Mot de passe
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => { setDeletingInst(openedInst); setDeleteMode('deactivate') }}>
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Supprimer
                    </Button>
                  </div>
                </div>

                {/* === Quick institution switcher dropdown (visible in detail view) === */}
                <Card className="border border-orange-200 dark:border-orange-900/40 bg-orange-50/40 dark:bg-orange-950/10">
                  <CardContent className="p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-orange-700 dark:text-orange-400 sm:w-56 shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Changer d'institution</span>
                      </div>
                      <div className="flex-1">
                        <Select
                          value={openedInst?.id || ''}
                          onValueChange={handleSelectInstitution}
                        >
                          <SelectTrigger className="w-full h-9 bg-background">
                            <SelectValue placeholder="— Sélectionner une institution —" />
                          </SelectTrigger>
                          <SelectContent className="max-h-80">
                            {institutions.map((inst) => (
                              <SelectItem key={inst.id} value={inst.id}>
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                  <span className="truncate">{inst.name}</span>
                                  <Badge variant={inst.active ? 'default' : 'secondary'} className="text-[9px] h-4 px-1 ml-1 shrink-0">
                                    {inst.active ? 'Active' : 'Inactive'}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Separator />

                {/* Detail sub-tabs */}
                <div className="flex flex-wrap gap-1.5">
                  {detailTabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                      <Button
                        key={tab.key}
                        variant={detailTab === tab.key ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => { setDetailTab(tab.key); setSearchQuery('') }}
                        className={detailTab === tab.key ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700' : 'text-muted-foreground'}
                      >
                        <Icon className="w-4 h-4 mr-1.5" />
                        {tab.label}
                      </Button>
                    )
                  })}
                </div>

                {loadingBrowse ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-muted-foreground" /></div>
                ) : instData ? (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

                    {/* ===== OVERVIEW TAB ===== */}
                    {detailTab === 'overview' && (
                      <div className="space-y-4">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                          <Card className="p-4 text-center hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
                              <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <p className="text-2xl font-bold">{instData.students.length}</p>
                            <p className="text-xs text-muted-foreground">Élèves</p>
                          </Card>
                          <Card className="p-4 text-center hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-2">
                              <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                            </div>
                            <p className="text-2xl font-bold">{instData.teachers.length}</p>
                            <p className="text-xs text-muted-foreground">Enseignants</p>
                          </Card>
                          <Card className="p-4 text-center hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-2">
                              <Heart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <p className="text-2xl font-bold">{instData.parents.length}</p>
                            <p className="text-xs text-muted-foreground">Parents</p>
                          </Card>
                          <Card className="p-4 text-center hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-2">
                              <Briefcase className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <p className="text-2xl font-bold">{instData.staff.length}</p>
                            <p className="text-xs text-muted-foreground">Personnel</p>
                          </Card>
                          <Card className="p-4 text-center hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mx-auto mb-2">
                              <Building2 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                            </div>
                            <p className="text-2xl font-bold">{instData.classes.length}</p>
                            <p className="text-xs text-muted-foreground">Classes</p>
                          </Card>
                          <Card className="p-4 text-center hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-2">
                              <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <p className="text-2xl font-bold">{instData.users.length}</p>
                            <p className="text-xs text-muted-foreground">Utilisateurs</p>
                          </Card>
                        </div>

                        {/* Payments Summary */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <CreditCard className="w-4 h-4" /> Paiements
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{instData.paymentStats.completed}</p>
                                <p className="text-xs text-muted-foreground">Complétés</p>
                              </div>
                              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{instData.paymentStats.pending}</p>
                                <p className="text-xs text-muted-foreground">En attente</p>
                              </div>
                              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{instData.paymentStats.failed}</p>
                                <p className="text-xs text-muted-foreground">Échoués</p>
                              </div>
                              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{instData.paymentStats.totalAmount.toLocaleString()} FCFA</p>
                                <p className="text-xs text-muted-foreground">Total</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Attendance & Grades */}
                        <div className="grid sm:grid-cols-2 gap-4">
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Activity className="w-4 h-4" /> Présence
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{instData.attendanceStats.present || 0}</p>
                                  <p className="text-[10px] text-muted-foreground">Présents</p>
                                </div>
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                  <p className="text-xl font-bold text-red-700 dark:text-red-400">{instData.attendanceStats.absent || 0}</p>
                                  <p className="text-[10px] text-muted-foreground">Absents</p>
                                </div>
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{instData.attendanceStats.late || 0}</p>
                                  <p className="text-[10px] text-muted-foreground">Retards</p>
                                </div>
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                  <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{instData.attendanceStats.excused || 0}</p>
                                  <p className="text-[10px] text-muted-foreground">Excusés</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <GraduationCap className="w-4 h-4" /> Notes
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-sky-50 dark:bg-sky-900/20 rounded-xl text-center">
                                  <p className="text-2xl font-bold text-sky-700 dark:text-sky-400">{instData.gradeStats.count}</p>
                                  <p className="text-xs text-muted-foreground">Notes saisies</p>
                                </div>
                                <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl text-center">
                                  <p className="text-2xl font-bold text-violet-700 dark:text-violet-400">{instData.gradeStats.average}/20</p>
                                  <p className="text-xs text-muted-foreground">Moyenne</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Extra info */}
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                            <CalendarDays className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{instData.announcementCount} annonces</p>
                              <p className="text-xs text-muted-foreground">Annonces publiées</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                            <CalendarDays className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{instData.eventCount} événements</p>
                              <p className="text-xs text-muted-foreground">Événements planifiés</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ===== STUDENTS TAB ===== */}
                    {detailTab === 'students' && (
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <GraduationCap className="w-4 h-4" /> Élèves ({instData.students.length})
                            </CardTitle>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                                <Input
                                  placeholder="Rechercher un élève..."
                                  value={searchQuery}
                                  onChange={e => setSearchQuery(e.target.value)}
                                  className="pl-8 h-9 text-sm"
                                />
                              </div>
                              <Button size="sm" onClick={() => handleCreateEntity('student')} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white shrink-0">
                                <Plus className="w-4 h-4 mr-1" /> Nouveau
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                  <th className="pb-2 pr-3 font-medium">Nom</th>
                                  <th className="pb-2 pr-3 font-medium hidden sm:table-cell">Genre</th>
                                  <th className="pb-2 pr-3 font-medium">Classe</th>
                                  <th className="pb-2 pr-3 font-medium hidden md:table-cell">Date de naissance</th>
                                  <th className="pb-2 pr-3 font-medium hidden lg:table-cell">Contact parent</th>
                                  <th className="pb-2 font-medium text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filterBySearch(instData.students, s => `${s.firstName} ${s.lastName} ${s.class?.name || ''} ${s.gender || ''}`).map(student => (
                                  <tr key={student.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                    <td className="py-2.5 pr-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 text-xs font-semibold shrink-0">
                                          {student.firstName[0]}{student.lastName[0]}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-medium truncate">{student.firstName} {student.lastName}</p>
                                          <p className="text-xs text-muted-foreground">{student.user.email}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2.5 pr-3 hidden sm:table-cell">
                                      {student.gender ? (
                                        <Badge variant="outline" className="text-[10px]">{student.gender === 'M' ? 'Masculin' : 'Féminin'}</Badge>
                                      ) : <span className="text-xs text-muted-foreground">—</span>}
                                    </td>
                                    <td className="py-2.5 pr-3">
                                      {student.class ? (
                                        <Badge variant="secondary" className="text-[10px]">{student.class.name}</Badge>
                                      ) : <span className="text-xs text-muted-foreground">Non assigné</span>}
                                    </td>
                                    <td className="py-2.5 pr-3 text-xs text-muted-foreground hidden md:table-cell">{student.dateOfBirth || '—'}</td>
                                    <td className="py-2.5 pr-3 text-xs text-muted-foreground hidden lg:table-cell">{student.parentContact || student.parentPhone || '—'}</td>
                                    <td className="py-2.5 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditEntity('student', student as unknown as Record<string, unknown>)}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeletingEntity({ type: 'student', id: student.id, name: `${student.firstName} ${student.lastName}` })}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {filterBySearch(instData.students, s => `${s.firstName} ${s.lastName} ${s.class?.name || ''}`).length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-8">Aucun élève trouvé</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* ===== TEACHERS TAB ===== */}
                    {detailTab === 'teachers' && (
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <BookOpen className="w-4 h-4" /> Enseignants ({instData.teachers.length})
                            </CardTitle>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                                <Input
                                  placeholder="Rechercher un enseignant..."
                                  value={searchQuery}
                                  onChange={e => setSearchQuery(e.target.value)}
                                  className="pl-8 h-9 text-sm"
                                />
                              </div>
                              <Button size="sm" onClick={() => handleCreateEntity('teacher')} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white shrink-0">
                                <Plus className="w-4 h-4 mr-1" /> Nouveau
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                  <th className="pb-2 pr-3 font-medium">Nom</th>
                                  <th className="pb-2 pr-3 font-medium">Matière</th>
                                  <th className="pb-2 pr-3 font-medium hidden sm:table-cell">Téléphone</th>
                                  <th className="pb-2 pr-3 font-medium hidden md:table-cell">Qualification</th>
                                  <th className="pb-2 font-medium text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filterBySearch(instData.teachers, t => `${t.firstName} ${t.lastName} ${t.subject} ${t.qualification || ''}`).map(teacher => (
                                  <tr key={teacher.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                    <td className="py-2.5 pr-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-700 dark:text-teal-300 text-xs font-semibold shrink-0">
                                          {teacher.firstName[0]}{teacher.lastName[0]}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-medium truncate">{teacher.firstName} {teacher.lastName}</p>
                                          <p className="text-xs text-muted-foreground">{teacher.user.email}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2.5 pr-3">
                                      <Badge variant="secondary" className="text-[10px]">{teacher.subject}</Badge>
                                    </td>
                                    <td className="py-2.5 pr-3 text-xs text-muted-foreground hidden sm:table-cell">{teacher.phone || teacher.user.phone || '—'}</td>
                                    <td className="py-2.5 pr-3 text-xs text-muted-foreground hidden md:table-cell">{teacher.qualification || '—'}</td>
                                    <td className="py-2.5 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditEntity('teacher', teacher as unknown as Record<string, unknown>)}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeletingEntity({ type: 'teacher', id: teacher.id, name: `${teacher.firstName} ${teacher.lastName}` })}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {filterBySearch(instData.teachers, t => `${t.firstName} ${t.lastName} ${t.subject}`).length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-8">Aucun enseignant trouvé</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* ===== PARENTS TAB ===== */}
                    {detailTab === 'parents' && (
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Heart className="w-4 h-4" /> Parents ({instData.parents.length})
                            </CardTitle>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                                <Input
                                  placeholder="Rechercher un parent..."
                                  value={searchQuery}
                                  onChange={e => setSearchQuery(e.target.value)}
                                  className="pl-8 h-9 text-sm"
                                />
                              </div>
                              <Button size="sm" onClick={() => handleCreateEntity('parent')} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white shrink-0">
                                <Plus className="w-4 h-4 mr-1" /> Nouveau
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                  <th className="pb-2 pr-3 font-medium">Nom</th>
                                  <th className="pb-2 pr-3 font-medium hidden sm:table-cell">Téléphone</th>
                                  <th className="pb-2 pr-3 font-medium hidden md:table-cell">Adresse</th>
                                  <th className="pb-2 pr-3 font-medium">Enfants</th>
                                  <th className="pb-2 font-medium text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filterBySearch(instData.parents, p => `${p.firstName} ${p.lastName} ${p.phone || ''} ${p.address || ''}`).map(parent => (
                                  <tr key={parent.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                    <td className="py-2.5 pr-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-300 text-xs font-semibold shrink-0">
                                          {parent.firstName[0]}{parent.lastName[0]}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-medium truncate">{parent.firstName} {parent.lastName}</p>
                                          <p className="text-xs text-muted-foreground">{parent.user.email}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2.5 pr-3 text-xs text-muted-foreground hidden sm:table-cell">{parent.phone || parent.user.phone || '—'}</td>
                                    <td className="py-2.5 pr-3 text-xs text-muted-foreground hidden md:table-cell">{parent.address || '—'}</td>
                                    <td className="py-2.5 pr-3">
                                      <Badge variant="outline" className="text-[10px]">{parent.children.length} enfant{parent.children.length > 1 ? 's' : ''}</Badge>
                                    </td>
                                    <td className="py-2.5 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditEntity('parent', parent as unknown as Record<string, unknown>)}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeletingEntity({ type: 'parent', id: parent.id, name: `${parent.firstName} ${parent.lastName}` })}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {filterBySearch(instData.parents, p => `${p.firstName} ${p.lastName}`).length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-8">Aucun parent trouvé</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* ===== STAFF TAB ===== */}
                    {detailTab === 'staff' && (
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Briefcase className="w-4 h-4" /> Personnel ({instData.staff.length})
                            </CardTitle>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                                <Input
                                  placeholder="Rechercher..."
                                  value={searchQuery}
                                  onChange={e => setSearchQuery(e.target.value)}
                                  className="pl-8 h-9 text-sm"
                                />
                              </div>
                              <Button size="sm" onClick={() => handleCreateEntity('staff')} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white shrink-0">
                                <Plus className="w-4 h-4 mr-1" /> Nouveau
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                  <th className="pb-2 pr-3 font-medium">Nom</th>
                                  <th className="pb-2 pr-3 font-medium">Fonction</th>
                                  <th className="pb-2 pr-3 font-medium hidden sm:table-cell">Téléphone</th>
                                  <th className="pb-2 pr-3 font-medium hidden md:table-cell">Email</th>
                                  <th className="pb-2 font-medium text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filterBySearch(instData.staff, s => `${s.firstName} ${s.lastName} ${s.fonction}`).map(staffMember => (
                                  <tr key={staffMember.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                    <td className="py-2.5 pr-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-300 text-xs font-semibold shrink-0">
                                          {staffMember.firstName[0]}{staffMember.lastName[0]}
                                        </div>
                                        <p className="font-medium">{staffMember.firstName} {staffMember.lastName}</p>
                                      </div>
                                    </td>
                                    <td className="py-2.5 pr-3">
                                      <Badge variant="secondary" className="text-[10px]">{staffMember.fonction}</Badge>
                                    </td>
                                    <td className="py-2.5 pr-3 text-xs text-muted-foreground hidden sm:table-cell">{staffMember.phone || staffMember.user.phone || '—'}</td>
                                    <td className="py-2.5 pr-3 text-xs text-muted-foreground hidden md:table-cell">{staffMember.email || staffMember.user.email}</td>
                                    <td className="py-2.5 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditEntity('staff', staffMember as unknown as Record<string, unknown>)}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeletingEntity({ type: 'staff', id: staffMember.id, name: `${staffMember.firstName} ${staffMember.lastName}` })}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {filterBySearch(instData.staff, s => `${s.firstName} ${s.lastName} ${s.fonction}`).length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-8">Aucun membre du personnel trouvé</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* ===== CLASSES TAB ===== */}
                    {detailTab === 'classes' && (
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Table2 className="w-4 h-4" /> Classes ({instData.classes.length})
                            </CardTitle>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                                <Input
                                  placeholder="Rechercher une classe..."
                                  value={searchQuery}
                                  onChange={e => setSearchQuery(e.target.value)}
                                  className="pl-8 h-9 text-sm"
                                />
                              </div>
                              <Button size="sm" onClick={() => handleCreateEntity('class')} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white shrink-0">
                                <Plus className="w-4 h-4 mr-1" /> Nouveau
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                  <th className="pb-2 pr-3 font-medium">Nom</th>
                                  <th className="pb-2 pr-3 font-medium">Niveau</th>
                                  <th className="pb-2 pr-3 font-medium hidden sm:table-cell">Section</th>
                                  <th className="pb-2 pr-3 font-medium hidden md:table-cell">Salle</th>
                                  <th className="pb-2 pr-3 font-medium">Élèves</th>
                                  <th className="pb-2 font-medium text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filterBySearch(instData.classes, c => `${c.name} ${c.level} ${c.section || ''}`).map(cls => (
                                  <tr key={cls.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                    <td className="py-2.5 pr-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-700 dark:text-sky-300 text-xs font-semibold shrink-0">
                                          {cls.name.slice(0, 2)}
                                        </div>
                                        <p className="font-medium">{cls.name}</p>
                                      </div>
                                    </td>
                                    <td className="py-2.5 pr-3 text-xs">{cls.level}</td>
                                    <td className="py-2.5 pr-3 text-xs hidden sm:table-cell">{cls.section || '—'}</td>
                                    <td className="py-2.5 pr-3 text-xs text-muted-foreground hidden md:table-cell">{cls.room || '—'}</td>
                                    <td className="py-2.5 pr-3">
                                      <Badge variant="outline" className="text-[10px]">{cls.studentCount}</Badge>
                                    </td>
                                    <td className="py-2.5 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditEntity('class', cls as unknown as Record<string, unknown>)}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeletingEntity({ type: 'class', id: cls.id, name: cls.name })}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {filterBySearch(instData.classes, c => `${c.name} ${c.level}`).length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-8">Aucune classe trouvée</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* ===== PAYMENTS TAB ===== */}
                    {detailTab === 'payments' && (
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Receipt className="w-4 h-4" /> Paiements ({instData.payments.length})
                            </CardTitle>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                                <Input
                                  placeholder="Rechercher un paiement..."
                                  value={searchQuery}
                                  onChange={e => setSearchQuery(e.target.value)}
                                  className="pl-8 h-9 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {/* Payment stats row */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-center">
                              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{instData.paymentStats.completedAmount.toLocaleString()} FCFA</p>
                              <p className="text-[10px] text-muted-foreground">Encaissé</p>
                            </div>
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
                              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{instData.paymentStats.pending}</p>
                              <p className="text-[10px] text-muted-foreground">En attente</p>
                            </div>
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                              <p className="text-sm font-bold text-red-700 dark:text-red-400">{instData.paymentStats.failed}</p>
                              <p className="text-[10px] text-muted-foreground">Échoués</p>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                              <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{instData.paymentStats.totalAmount.toLocaleString()} FCFA</p>
                              <p className="text-[10px] text-muted-foreground">Total</p>
                            </div>
                          </div>
                          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                  <th className="pb-2 pr-3 font-medium">Élève</th>
                                  <th className="pb-2 pr-3 font-medium">Montant</th>
                                  <th className="pb-2 pr-3 font-medium hidden sm:table-cell">Type</th>
                                  <th className="pb-2 pr-3 font-medium hidden md:table-cell">Méthode</th>
                                  <th className="pb-2 pr-3 font-medium">Statut</th>
                                  <th className="pb-2 pr-3 font-medium hidden lg:table-cell">Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filterBySearch(instData.payments, p => `${p.student.firstName} ${p.student.lastName} ${p.type} ${p.status}`).map(payment => (
                                  <tr key={payment.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                    <td className="py-2.5 pr-3">
                                      <div className="min-w-0">
                                        <p className="font-medium truncate">{payment.student.firstName} {payment.student.lastName}</p>
                                        {payment.student.class && <p className="text-xs text-muted-foreground">{payment.student.class.name}</p>}
                                      </div>
                                    </td>
                                    <td className="py-2.5 pr-3 font-medium">{payment.amount.toLocaleString()} FCFA</td>
                                    <td className="py-2.5 pr-3 text-xs hidden sm:table-cell">{paymentTypeLabel[payment.type] || payment.type}</td>
                                    <td className="py-2.5 pr-3 text-xs text-muted-foreground hidden md:table-cell">{paymentMethodLabel[payment.method] || payment.method}</td>
                                    <td className="py-2.5 pr-3">
                                      <Badge className={`text-[10px] ${paymentStatusColor[payment.status] || ''}`}>
                                        {paymentStatusLabel[payment.status] || payment.status}
                                      </Badge>
                                    </td>
                                    <td className="py-2.5 pr-3 text-xs text-muted-foreground hidden lg:table-cell">{payment.paymentDate || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {filterBySearch(instData.payments, p => `${p.student.firstName} ${p.student.lastName}`).length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-8">Aucun paiement trouvé</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </motion.div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Impossible de charger les données</p>
                  </div>
                )}
              </div>
            )}

            {/* Create/Edit Institution Dialog */}
            <Dialog open={showInstForm || !!editingInst} onOpenChange={(open) => { if (!open) { setShowInstForm(false); setEditingInst(null) } }}>
              <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingInst ? 'Modifier l\'institution' : 'Nouvelle institution'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nom *</Label>
                    <Input value={instForm.name} onChange={(e) => setInstForm({ ...instForm, name: e.target.value })} placeholder="Nom de l'établissement" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mot de passe *</Label>
                    <Input value={instForm.password} onChange={(e) => setInstForm({ ...instForm, password: e.target.value })} placeholder="Mot de passe d'institution" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Téléphone</Label>
                      <Input value={instForm.phone} onChange={(e) => setInstForm({ ...instForm, phone: e.target.value })} placeholder="Téléphone" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input value={instForm.email} onChange={(e) => setInstForm({ ...instForm, email: e.target.value })} placeholder="Email" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Adresse</Label>
                    <Input value={instForm.address} onChange={(e) => setInstForm({ ...instForm, address: e.target.value })} placeholder="Adresse" />
                  </div>

                  {/* ---- Auto-seed section (only shown when CREATING, not editing) ---- */}
                  {!editingInst && (
                    <>
                      <Separator className="my-2" />
                      <div className="rounded-lg border-2 border-orange-200 dark:border-orange-800/60 bg-orange-50/50 dark:bg-orange-950/20 p-3 space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <Checkbox
                            checked={instForm.autoSeed}
                            onCheckedChange={(checked) => setInstForm({ ...instForm, autoSeed: checked === true })}
                            className="mt-0.5 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                              Remplir avec des données de démonstration
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                              Crée automatiquement le compte admin, 4 enseignants, 3 classes, 12 élèves, des notes, des emplois du temps, des paiements, etc. Idéal pour tester rapidement la nouvelle institution.
                            </p>
                          </div>
                        </label>

                        {/* Admin credentials — always required when creating */}
                        <div className="space-y-2.5 pt-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compte administrateur</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={generateAdminCredentialsFromName}
                              className="h-7 text-[11px] text-orange-600 hover:text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30 px-2"
                            >
                              <Wand2 className="w-3 h-3 mr-1" />
                              Générer
                            </Button>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Nom de l&apos;admin</Label>
                            <Input
                              value={instForm.adminName}
                              onChange={(e) => setInstForm({ ...instForm, adminName: e.target.value })}
                              placeholder={`Administrateur ${instForm.name || ''}`.trim()}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Email admin {instForm.autoSeed ? '(optionnel — généré si vide)' : '*'}</Label>
                            <Input
                              type="email"
                              value={instForm.adminEmail}
                              onChange={(e) => setInstForm({ ...instForm, adminEmail: e.target.value })}
                              placeholder="admin@example.com"
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Mot de passe admin {instForm.autoSeed ? '(optionnel — défaut: admin123)' : '*'}</Label>
                            <div className="relative">
                              <Input
                                type={showInstAdminPassword ? 'text' : 'password'}
                                value={instForm.adminPassword}
                                onChange={(e) => setInstForm({ ...instForm, adminPassword: e.target.value })}
                                placeholder="••••••••"
                                className="h-9 pr-9"
                              />
                              <button
                                type="button"
                                onClick={() => setShowInstAdminPassword(!showInstAdminPassword)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                aria-label={showInstAdminPassword ? 'Masquer' : 'Afficher'}
                              >
                                {showInstAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          {!instForm.autoSeed && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                              L&apos;institution sera créée vide (sans enseignants, sans élèves). Vous pourrez ensuite la remplir manuellement ou via les Paramètres.
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowInstForm(false); setEditingInst(null) }} disabled={creatingInst}>Annuler</Button>
                  <Button
                    onClick={editingInst ? handleUpdateInstitution : handleCreateInstitution}
                    disabled={creatingInst}
                    className="bg-gradient-to-r from-orange-500 to-amber-600 text-white"
                  >
                    {creatingInst ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Création...
                      </>
                    ) : editingInst ? (
                      'Modifier'
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-1.5" />
                        Créer{instForm.autoSeed ? ' avec données' : ''}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Institution Confirm */}
            <AlertDialog open={!!deletingInst} onOpenChange={(open) => { if (!open) setDeletingInst(null) }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Supprimer l&apos;institution
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Que souhaitez-vous faire pour <strong>{deletingInst?.name}</strong> ?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 py-2">
                  <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-orange-200 dark:border-orange-800 cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
                    <input
                      type="radio"
                      name="deleteMode"
                      checked={deleteMode === 'deactivate'}
                      onChange={() => setDeleteMode('deactivate')}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-orange-500" />
                        Désactiver (recommandé)
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        L&apos;institution et tous ses utilisateurs seront désactivés. Les données sont conservées et peuvent être restaurées.
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-red-200 dark:border-red-800 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <input
                      type="radio"
                      name="deleteMode"
                      checked={deleteMode === 'permanent'}
                      onChange={() => setDeleteMode('permanent')}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium flex items-center gap-1.5 text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                        Supprimer définitivement
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ⚠️ Toutes les données seront <strong>perdues définitivement</strong> : élèves, enseignants, classes, notes, paiements, etc.
                      </p>
                    </div>
                  </label>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteInstitution}
                    disabled={deletingInstBusy}
                    className={deleteMode === 'permanent' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-orange-500 text-white hover:bg-orange-600'}
                  >
                    {deletingInstBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                    {deleteMode === 'permanent' ? 'Supprimer définitivement' : 'Désactiver'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Toggle Institution Active/Blocked Confirm */}
            <AlertDialog open={!!confirmToggleInst} onOpenChange={(open) => { if (!open) setConfirmToggleInst(null) }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    {confirmToggleInst?.active ? (
                      <>
                        <Lock className="w-5 h-5 text-orange-500" />
                        Bloquer l&apos;institution « {confirmToggleInst?.name} » ?
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5 text-emerald-600" />
                        Réactiver l&apos;institution « {confirmToggleInst?.name} » ?
                      </>
                    )}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {confirmToggleInst?.active ? (
                      <>
                        Tous les utilisateurs de cette institution seront <strong>désactivés</strong> et
                        leurs sessions actives seront <strong>clôturées immédiatement</strong>. Ils ne
                        pourront plus se connecter tant que l&apos;institution reste bloquée. Les données
                        (élèves, enseignants, classes, notes, paiements) sont <strong>conservées</strong>.
                      </>
                    ) : (
                      <>
                        L&apos;institution sera de nouveau active. Les utilisateurs resteront désactivés —
                        vous devrez les <strong>réactiver individuellement</strong> depuis le module Super
                        Admin pour qu&apos;ils puissent se reconnecter.
                      </>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => confirmToggleInst && handleToggleInstitutionActive(confirmToggleInst)}
                    disabled={!!togglingInstId}
                    className={
                      confirmToggleInst?.active
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }
                  >
                    {togglingInstId ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                    {confirmToggleInst?.active ? 'Bloquer l\'institution' : 'Réactiver l\'institution'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Reset Institution Password Dialog */}
            <Dialog open={!!resetPwdInst} onOpenChange={(open) => { if (!open) { setResetPwdInst(null); setNewInstPassword('') } }}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-orange-500" />
                    Mot de passe de l&apos;institution
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                    <p className="text-sm font-medium">{resetPwdInst?.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mot de passe actuel : <span className="font-mono">{showNewInstPassword ? resetPwdInst?.password : '••••••••'}</span>
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nouveau mot de passe *</Label>
                    <div className="relative">
                      <Input
                        type={showNewInstPassword ? 'text' : 'password'}
                        value={newInstPassword}
                        onChange={(e) => setNewInstPassword(e.target.value)}
                        placeholder="Nouveau mot de passe"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleResetInstitutionPassword() }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewInstPassword(!showNewInstPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showNewInstPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ce mot de passe sera utilisé sur la page de connexion pour accéder à cette institution.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setNewInstPassword(`inst${Math.floor(1000 + Math.random() * 9000)}`)}
                    >
                      <Key className="w-3 h-3 mr-1" /> Générer
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setResetPwdInst(null); setNewInstPassword('') }}>Annuler</Button>
                  <Button
                    onClick={handleResetInstitutionPassword}
                    disabled={resetPwdBusy || !newInstPassword}
                    className="bg-gradient-to-r from-orange-500 to-amber-600 text-white"
                  >
                    {resetPwdBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                    Enregistrer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Entity Create/Edit Dialog */}
            <Dialog open={entityFormOpen} onOpenChange={(open) => { if (!open) { setEntityFormOpen(false); setEditingEntity(null) } }}>
              <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingEntity ? `Modifier ${entityLabel(entityFormType)}` : `Nouveau ${entityLabel(entityFormType)}`}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {renderEntityForm(entityFormType, entityForm, setEntityForm, instData)}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setEntityFormOpen(false); setEditingEntity(null) }}>Annuler</Button>
                  <Button onClick={handleSaveEntity} disabled={entitySaving} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white">
                    {entitySaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {editingEntity ? 'Modifier' : 'Créer'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Entity Confirm */}
            <AlertDialog open={!!deletingEntity} onOpenChange={(open) => { if (!open) setDeletingEntity(null) }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Supprimer {entityLabel(deletingEntity?.type || '')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Êtes-vous sûr de vouloir supprimer <strong>{deletingEntity?.name}</strong> ? Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteEntity} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </motion.div>
        )}

        {/* ============= ADMINS TAB ============= */}
        {activeTab === 'admins' && (
          <motion.div key="admins" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Gestion des Administrateurs</h2>
              <Button onClick={() => { setAdminForm({ name: '', email: '', password: '', phone: '', institutionId: '' }); setShowAdminForm(true) }} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700">
                <Plus className="w-4 h-4 mr-1.5" />
                Nouvel admin
              </Button>
            </div>

            {loadingAdmins ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-3">
                {admins.map((admin) => (
                  <Card key={admin.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          {admin.avatar ? <AvatarImage src={getImageUrl(admin.avatar, admin.updatedAt)} alt={admin.name} /> : null}
                          <AvatarFallback className="bg-red-100 text-red-700 text-xs font-semibold">
                            {admin.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{admin.name}</p>
                            <Badge variant={admin.active ? 'default' : 'secondary'} className="text-[10px]">
                              {admin.active ? 'Actif' : 'Inactif'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span>{admin.email}</span>
                            <span className="font-mono">{admin.userCode}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <Building2 className="w-3 h-3" />
                            <span
                              className="text-orange-600 dark:text-orange-400 cursor-pointer hover:underline font-medium"
                              onClick={() => {
                                const inst = institutions.find(i => i.id === admin.institutionId)
                                if (inst) {
                                  setActiveTab('institutions')
                                  setTimeout(() => handleOpenInstitution(inst), 100)
                                }
                              }}
                            >
                              {admin.institution?.name || 'N/A'}
                            </span>
                            {admin.phone && <><span>·</span><span>{admin.phone}</span></>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => setShowAdminPassword(showAdminPassword === admin.id ? null : admin.id)} className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer" title="Voir le mot de passe">
                            {showAdminPassword === admin.id ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                          </button>
                          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => {
                            setEditingAdmin(admin)
                            setAdminForm({ name: admin.name, email: admin.email, password: '', phone: admin.phone || '', institutionId: admin.institutionId })
                          }}>
                            <Pencil className="w-3 h-3 mr-1" /> Modifier
                          </Button>
                          <Button variant="destructive" size="sm" className="text-xs h-7" onClick={() => setDeletingAdmin(admin)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {showAdminPassword === admin.id && (
                        <div className="mt-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded text-xs font-mono text-amber-700 dark:text-amber-400">
                          Mot de passe : Voir dans les détails de l&apos;utilisateur
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {admins.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Aucun administrateur</p>
                  </div>
                )}
              </div>
            )}

            {/* Create/Edit Admin Dialog */}
            <Dialog open={showAdminForm || !!editingAdmin} onOpenChange={(open) => { if (!open) { setShowAdminForm(false); setEditingAdmin(null) } }}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingAdmin ? 'Modifier l\'administrateur' : 'Nouvel administrateur'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nom *</Label>
                    <Input value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} placeholder="Nom complet" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Email *</Label>
                      <Input value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} placeholder="Email" type="email" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Mot de passe {editingAdmin ? '(vide = inchangé)' : '*'}</Label>
                      <Input value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} placeholder="Mot de passe" type="password" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Téléphone</Label>
                    <Input value={adminForm.phone} onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })} placeholder="Téléphone" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Institution *</Label>
                    <Select value={adminForm.institutionId} onValueChange={(v) => setAdminForm({ ...adminForm, institutionId: v })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner une institution" /></SelectTrigger>
                      <SelectContent>
                        {institutions.map((inst) => (
                          <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowAdminForm(false); setEditingAdmin(null) }}>Annuler</Button>
                  <Button onClick={editingAdmin ? handleUpdateAdmin : handleCreateAdmin} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white">
                    {editingAdmin ? 'Modifier' : 'Créer'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Admin Confirm */}
            <AlertDialog open={!!deletingAdmin} onOpenChange={(open) => { if (!open) setDeletingAdmin(null) }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Supprimer l&apos;administrateur
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Êtes-vous sûr de vouloir supprimer <strong>{deletingAdmin?.name}</strong> ?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAdmin} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </motion.div>
        )}

        {/* ============= ADMINS-LIST TAB (id / email / password) ============= */}
        {activeTab === 'admins-list' && (
          <motion.div key="admins-list" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
            {/* Header row: title + actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Table2 className="w-5 h-5 text-orange-500" />
                  Liste des administrateurs
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Identifiants de connexion de chaque administrateur d&apos;institution.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={adminListSearch}
                    onChange={(e) => setAdminListSearch(e.target.value)}
                    placeholder="Rechercher (nom, email, institution)…"
                    className="pl-9 w-full sm:w-72 h-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={fetchAdminList} disabled={loadingAdminList}>
                  <RefreshCw className={`w-4 h-4 mr-1.5 ${loadingAdminList ? 'animate-spin' : ''}`} />
                  Actualiser
                </Button>
              </div>
            </div>

            {/* Security notice */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Ces informations sont confidentielles. Chaque administrateur peut se connecter
                avec son <strong>ID</strong>, son <strong>email</strong> ou son
                <strong> code utilisateur</strong> (colonne ID) et le mot de passe affiché.
                Les mots de passe sont masqués par défaut — cliquez sur l&apos;œil pour les révéler.
              </span>
            </div>

            {/* Loading skeleton */}
            {loadingAdminList ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : adminList.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Aucun administrateur trouvé.
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Desktop table (md+ screens) */}
                <Card className="overflow-hidden hidden md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr className="text-left">
                          <th className="px-4 py-3 font-medium text-muted-foreground">ID</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">Administrateur</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">Email</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">Mot de passe</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">Institution</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminList
                          .filter((a) => {
                            if (!adminListSearch) return true
                            const q = adminListSearch.toLowerCase()
                            return (
                              a.name.toLowerCase().includes(q) ||
                              a.email.toLowerCase().includes(q) ||
                              (a.institution?.name || '').toLowerCase().includes(q) ||
                              (a.userCode || '').toLowerCase().includes(q) ||
                              a.id.toLowerCase().includes(q)
                            )
                          })
                          .map((a) => {
                            const revealed = revealedPasswords.has(a.id)
                            return (
                              <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3 align-top">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(a.id, `id-${a.id}`)}
                                    className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                                    title="Cliquer pour copier"
                                  >
                                    {copiedField === `id-${a.id}` ? (
                                      <span className="text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> Copié</span>
                                    ) : (
                                      <span className="break-all">{a.id}</span>
                                    )}
                                  </button>
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="w-7 h-7">
                                      {a.avatar ? <AvatarImage src={getImageUrl(a.avatar, a.updatedAt)} alt={a.name} /> : null}
                                      <AvatarFallback className="text-xs">{a.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium">{a.name}</p>
                                      <p className="text-xs text-muted-foreground font-mono">{a.userCode || '—'}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(a.email, `email-${a.id}`)}
                                    className="text-left hover:text-orange-600 transition-colors"
                                    title="Cliquer pour copier"
                                  >
                                    {copiedField === `email-${a.id}` ? (
                                      <span className="text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> Copié</span>
                                    ) : (
                                      <span className="break-all">{a.email}</span>
                                    )}
                                  </button>
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(a.password || '', `pwd-${a.id}`)}
                                      className={`font-mono text-sm hover:text-orange-600 transition-colors ${revealed ? '' : 'select-none'}`}
                                      title="Cliquer pour copier"
                                    >
                                      {copiedField === `pwd-${a.id}` ? (
                                        <span className="text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> Copié</span>
                                      ) : revealed ? (
                                        <span className="break-all">{a.password || '—'}</span>
                                      ) : (
                                        <span className="tracking-widest">••••••••</span>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleRevealPassword(a.id)}
                                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                                      title={revealed ? 'Masquer' : 'Afficher'}
                                    >
                                      {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <Badge variant="outline" className="font-normal">
                                    {a.institution?.name || 'N/A'}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 align-top text-right">
                                  <Badge variant={a.active ? 'default' : 'secondary'} className={a.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : ''}>
                                    {a.active ? 'Actif' : 'Inactif'}
                                  </Badge>
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Mobile cards (below md) */}
                <div className="space-y-3 md:hidden">
                  {adminList
                    .filter((a) => {
                      if (!adminListSearch) return true
                      const q = adminListSearch.toLowerCase()
                      return (
                        a.name.toLowerCase().includes(q) ||
                        a.email.toLowerCase().includes(q) ||
                        (a.institution?.name || '').toLowerCase().includes(q) ||
                        (a.userCode || '').toLowerCase().includes(q) ||
                        a.id.toLowerCase().includes(q)
                      )
                    })
                    .map((a) => {
                      const revealed = revealedPasswords.has(a.id)
                      return (
                        <Card key={a.id}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-9 h-9">
                                {a.avatar ? <AvatarImage src={getImageUrl(a.avatar, a.updatedAt)} alt={a.name} /> : null}
                                <AvatarFallback className="text-xs">{a.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{a.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{a.institution?.name || 'N/A'}</p>
                              </div>
                              <Badge variant={a.active ? 'default' : 'secondary'} className={a.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : ''}>
                                {a.active ? 'Actif' : 'Inactif'}
                              </Badge>
                            </div>

                            <div className="space-y-1.5 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-muted-foreground shrink-0">ID</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(a.id, `id-${a.id}`)}
                                  className="font-mono text-xs text-right hover:text-orange-600 transition-colors min-w-0 truncate"
                                  title="Cliquer pour copier"
                                >
                                  {copiedField === `id-${a.id}` ? <span className="text-emerald-600">Copié ✓</span> : a.id}
                                </button>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-muted-foreground shrink-0">Email</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(a.email, `email-${a.id}`)}
                                  className="text-right hover:text-orange-600 transition-colors min-w-0 truncate"
                                  title="Cliquer pour copier"
                                >
                                  {copiedField === `email-${a.id}` ? <span className="text-emerald-600">Copié ✓</span> : a.email}
                                </button>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-muted-foreground shrink-0">Mot de passe</span>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(a.password || '', `pwd-${a.id}`)}
                                    className="font-mono hover:text-orange-600 transition-colors min-w-0 truncate"
                                    title="Cliquer pour copier"
                                  >
                                    {copiedField === `pwd-${a.id}` ? (
                                      <span className="text-emerald-600">Copié ✓</span>
                                    ) : revealed ? (
                                      <span>{a.password || '—'}</span>
                                    ) : (
                                      <span className="tracking-widest">••••••••</span>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealPassword(a.id)}
                                    className="text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0"
                                    title={revealed ? 'Masquer' : 'Afficher'}
                                  >
                                    {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ============= PROFILE TAB ============= */}
        {activeTab === 'profile' && (
          <motion.div key="profile" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
            {/* Avatar & Identity Card */}
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-8 text-white">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm overflow-hidden">
                      {superAdminAvatar ? (
                        <Avatar className="w-24 h-24">
                          <AvatarImage src={superAdminAvatar} alt={superAdminName || ''} />
                          <AvatarFallback className="text-3xl bg-white/20 text-white">
                            {(superAdminName || 'SA').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <Shield className="w-12 h-12" />
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      {avatarUploading ? <Loader2 className="w-7 h-7 text-white animate-spin" /> : <Camera className="w-7 h-7 text-white" />}
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading} />
                    </label>
                    {superAdminAvatar && (
                      <button
                        type="button"
                        onClick={handleAvatarDelete}
                        className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-lg"
                        title="Supprimer l'avatar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{superAdminName}</h2>
                    <p className="text-white/80 flex items-center gap-1.5">
                      <Mail className="w-4 h-4" /> {superAdminEmail || 'superadmin@masomo.com'}
                    </p>
                    <p className="text-white/70 text-sm mt-1 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" /> Super Administrateur
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-6">
                {!editing ? (
                  <>
                    {/* Identity Info */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <UserCircle className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Nom complet</p>
                          <p className="text-sm font-medium">{superAdminName || 'Non renseigné'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm font-medium">{superAdminEmail || 'Non renseigné'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Phone className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Téléphone</p>
                          <p className="text-sm font-medium">{superAdminPhone || 'Non renseigné'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <MapPin className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Adresse</p>
                          <p className="text-sm font-medium">{superAdminAddress || 'Non renseignée'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => { setEditName(superAdminName || ''); setEditEmail(superAdminEmail || ''); setEditPhone(superAdminPhone || ''); setEditAddress(superAdminAddress || ''); setEditing(true) }}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Modifier l'identité
                      </Button>
                      <Button variant="outline" onClick={() => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); setPasswordDialogOpen(true) }}>
                        <Lock className="w-4 h-4 mr-2" />
                        Changer le mot de passe
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nom complet</Label>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom complet" />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" />
                      </div>
                      <div className="space-y-2">
                        <Label>Téléphone</Label>
                        <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Numéro de téléphone" />
                      </div>
                      <div className="space-y-2">
                        <Label>Adresse</Label>
                        <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Adresse" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveProfile} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Enregistrer
                      </Button>
                      <Button variant="outline" onClick={() => setEditing(false)}>
                        <X className="w-4 h-4 mr-2" />
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Avatar Management Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Gestion de l'avatar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative group">
                    <div className="w-28 h-28 rounded-2xl bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/30 group-hover:border-orange-400 transition-colors">
                      {superAdminAvatar ? (
                        <Avatar className="w-28 h-28">
                          <AvatarImage src={superAdminAvatar} alt={superAdminName || ''} />
                          <AvatarFallback className="text-3xl">
                            {(superAdminName || 'SA').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="text-center">
                          <Camera className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                          <p className="text-xs text-muted-foreground mt-1">Ajouter</p>
                        </div>
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      {avatarUploading ? (
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      ) : (
                        <div className="text-center text-white">
                          <Camera className="w-6 h-6 mx-auto" />
                          <p className="text-xs mt-1">Changer</p>
                        </div>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading} />
                    </label>
                  </div>
                  <div className="flex-1 text-center sm:text-left space-y-3">
                    <div>
                      <h3 className="font-semibold text-foreground">Photo de profil</h3>
                      <p className="text-sm text-muted-foreground">Utilisée pour identifier votre compte Super Admin</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      <label className="cursor-pointer">
                        <Button variant="outline" size="sm" asChild disabled={avatarUploading}>
                          <span>
                            {avatarUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                            {superAdminAvatar ? 'Changer la photo' : 'Ajouter une photo'}
                          </span>
                        </Button>
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading} />
                      </label>
                      {superAdminAvatar && (
                        <Button variant="destructive" size="sm" onClick={handleAvatarDelete}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">JPG, PNG ou GIF. Max 2 MB.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Sécurité du compte
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Key className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Mot de passe</p>
                      <p className="text-sm text-muted-foreground">Modifiez votre mot de passe pour sécuriser votre compte</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); setPasswordDialogOpen(true) }}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Modifier
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Password Change Dialog */}
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Changer le mot de passe
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Mot de passe actuel *</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Mot de passe actuel" />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Nouveau mot de passe *</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nouveau mot de passe" />
              </div>
              <div className="space-y-2">
                <Label>Confirmer le nouveau mot de passe *</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmer le mot de passe" />
              </div>
              {passwordError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 p-2 rounded-md">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {passwordError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleChangePassword} disabled={passwordSaving} className="bg-emerald-600 hover:bg-emerald-700">
                {passwordSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                Changer le mot de passe
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AnimatePresence>
    </motion.div>
  )
}

// ---------- Helper Functions for Entity CRUD ----------

function entityLabel(type: string): string {
  const labels: Record<string, string> = {
    student: 'élève',
    teacher: 'enseignant',
    parent: 'parent',
    staff: 'membre du personnel',
    class: 'classe',
  }
  return labels[type] || type
}

function getDefaultForm(type: string): Record<string, string> {
  switch (type) {
    case 'student':
      return { firstName: '', lastName: '', email: '', password: '', dateOfBirth: '', gender: 'M', address: '', parentContact: '', parentPhone: '', classId: '', phone: '' }
    case 'teacher':
      return { firstName: '', lastName: '', email: '', password: '', subject: '', phone: '', qualification: '', hireDate: '' }
    case 'parent':
      return { firstName: '', lastName: '', email: '', password: '', phone: '', address: '' }
    case 'staff':
      return { firstName: '', lastName: '', email: '', password: '', phone: '', fonction: '' }
    case 'class':
      return { name: '', level: '', section: '', capacity: '30', room: '' }
    default:
      return {}
  }
}

function prefillForm(type: string, data: Record<string, unknown>): Record<string, string> {
  const base = getDefaultForm(type)
  const filled: Record<string, string> = {}
  for (const key of Object.keys(base)) {
    const val = data[key]
    if (val !== undefined && val !== null) {
      if (typeof val === 'object' && val && 'id' in (val as object)) {
        filled[key] = (val as { id: string }).id
      } else {
        filled[key] = String(val)
      }
    }
  }
  // Also handle user.email / user.phone
  const user = data.user as Record<string, unknown> | undefined
  if (user) {
    if (!filled.email && user.email) filled.email = String(user.email)
    if (!filled.phone && user.phone) filled.phone = String(user.phone)
  }
  return { ...base, ...filled }
}

function getEntityUrl(type: string, id?: string): string {
  switch (type) {
    case 'student':
      return id ? `/api/students/${id}` : '/api/students'
    case 'teacher':
      return id ? `/api/teachers/${id}` : '/api/teachers'
    case 'parent':
      return id ? `/api/parents/${id}` : '/api/parents'
    case 'staff':
      return id ? `/api/staff/${id}` : '/api/staff'
    case 'class':
      return id ? `/api/classes/${id}` : '/api/classes'
    default:
      return '/api/students'
  }
}

function buildEntityBody(type: string, form: Record<string, string>, isEdit: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = { ...form }
  // Clean up empty strings for optional fields
  for (const [key, val] of Object.entries(body)) {
    if (val === '') body[key] = isEdit ? undefined : null
  }
  // Ensure numbers
  if (type === 'class' && form.capacity) {
    body.capacity = parseInt(form.capacity, 10) || 30
  }
  // Don't send empty password on edit
  if (isEdit && !form.password) {
    delete body.password
  }
  return body
}

function renderEntityForm(
  type: string,
  form: Record<string, string>,
  setForm: (fn: (prev: Record<string, string>) => Record<string, string>) => void,
  instData: InstitutionData | null,
): React.ReactNode {
  const field = (key: string, label: string, placeholder: string, opts?: { type?: string; required?: boolean }) => (
    <div className="space-y-1.5" key={key}>
      <Label>{label}{opts?.required ? ' *' : ''}</Label>
      <Input
        value={form[key] || ''}
        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        type={opts?.type || 'text'}
      />
    </div>
  )

  const selectField = (key: string, label: string, options: { value: string; label: string }[]) => (
    <div className="space-y-1.5" key={key}>
      <Label>{label}</Label>
      <Select value={form[key] || ''} onValueChange={v => setForm(prev => ({ ...prev, [key]: v }))}>
        <SelectTrigger><SelectValue placeholder={`Sélectionner ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  switch (type) {
    case 'student':
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            {field('firstName', 'Prénom', 'Prénom', { required: true })}
            {field('lastName', 'Nom', 'Nom', { required: true })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('email', 'Email', 'email@exemple.com')}
            {field('password', 'Mot de passe', 'Mot de passe', { type: 'password' })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('dateOfBirth', 'Date de naissance', 'AAAA-MM-JJ', { type: 'date' })}
            {selectField('gender', 'Genre', [
              { value: 'M', label: 'Masculin' },
              { value: 'F', label: 'Féminin' },
            ])}
          </div>
          {instData && instData.classes.length > 0 && selectField('classId', 'Classe', instData.classes.map(c => ({ value: c.id, label: c.name })))}
          {field('parentContact', 'Contact parent', 'Nom du parent/tuteur')}
          {field('parentPhone', 'Téléphone parent', 'Numéro du parent')}
          {field('phone', 'Téléphone', 'Numéro de téléphone')}
          {field('address', 'Adresse', 'Adresse')}
        </>
      )
    case 'teacher':
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            {field('firstName', 'Prénom', 'Prénom', { required: true })}
            {field('lastName', 'Nom', 'Nom', { required: true })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('email', 'Email', 'email@exemple.com')}
            {field('password', 'Mot de passe', 'Mot de passe', { type: 'password' })}
          </div>
          {field('subject', 'Matière', 'Matière enseignée', { required: true })}
          <div className="grid grid-cols-2 gap-3">
            {field('phone', 'Téléphone', 'Numéro de téléphone')}
            {field('qualification', 'Qualification', 'Diplôme, certification...')}
          </div>
          {field('hireDate', 'Date d\'embauche', 'AAAA-MM-JJ', { type: 'date' })}
        </>
      )
    case 'parent':
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            {field('firstName', 'Prénom', 'Prénom', { required: true })}
            {field('lastName', 'Nom', 'Nom', { required: true })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('email', 'Email', 'email@exemple.com')}
            {field('password', 'Mot de passe', 'Mot de passe', { type: 'password' })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('phone', 'Téléphone', 'Numéro de téléphone')}
            {field('address', 'Adresse', 'Adresse')}
          </div>
        </>
      )
    case 'staff':
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            {field('firstName', 'Prénom', 'Prénom', { required: true })}
            {field('lastName', 'Nom', 'Nom', { required: true })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('email', 'Email', 'email@exemple.com')}
            {field('password', 'Mot de passe', 'Mot de passe', { type: 'password' })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('phone', 'Téléphone', 'Numéro de téléphone')}
            {field('fonction', 'Fonction', 'Secrétaire, Comptable...', { required: true })}
          </div>
        </>
      )
    case 'class':
      return (
        <>
          {field('name', 'Nom', '6ème A', { required: true })}
          <div className="grid grid-cols-2 gap-3">
            {field('level', 'Niveau', '6ème', { required: true })}
            {field('section', 'Section', 'A, B, C...')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('capacity', 'Capacité', '30')}
            {field('room', 'Salle', 'Salle 101')}
          </div>
        </>
      )
    default:
      return null
  }
}
