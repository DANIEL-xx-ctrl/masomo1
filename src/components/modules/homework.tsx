'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen as HomeworkIcon,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Send,
  GraduationCap,
  ClipboardList,
  Users,
  Heart,
  LayoutGrid,
  List,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'

// ---------- Types ----------

interface ClassInfo {
  id: string
  name: string
  level: string
  section: string | null
}

interface TeacherInfo {
  id: string
  firstName: string
  lastName: string
}

interface SubjectInfo {
  id: string
  name: string
  code: string
}

interface SubmissionInfo {
  id: string
  studentId: string
  content: string | null
  status: string
  grade: number | null
  maxGrade: number
  comment: string | null
  submittedAt: string | null
  student: { id: string; firstName: string; lastName: string }
}

interface ChildInfo {
  id: string
  firstName: string
  lastName: string
  classId: string | null
  className: string | null
}

interface HomeworkItem {
  id: string
  title: string
  description: string | null
  subjectId: string | null
  classId: string
  teacherId: string | null
  dueDate: string
  assignedDate: string
  type: string
  status: string
  schoolYear: string
  class: ClassInfo
  teacher: TeacherInfo | null
  subject: SubjectInfo | null
  _count?: { submissions: number }
  submissions?: SubmissionInfo[]
  createdAt: string
  updatedAt: string
}

// ---------- Constants ----------

const HOMEWORK_TYPES = [
  { value: 'homework', label: 'Devoir', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400', icon: HomeworkIcon },
  { value: 'project', label: 'Projet', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400', icon: ClipboardList },
  { value: 'reading', label: 'Lecture', color: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400', icon: HomeworkIcon },
  { value: 'exercise', label: 'Exercice', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400', icon: GraduationCap },
] as const

const HOMEWORK_STATUSES = [
  { value: 'active', label: 'Actif', color: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400', border: 'border-green-300' },
  { value: 'closed', label: 'Fermé', color: 'bg-gray-100 text-gray-700 dark:bg-gray-950/50 dark:text-gray-400', border: 'border-gray-300' },
  { value: 'graded', label: 'Noté', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400', border: 'border-amber-300' },
] as const

const SUBMISSION_STATUSES = [
  { value: 'pending', label: 'En attente', color: 'bg-gray-100 text-gray-700', icon: Clock },
  { value: 'submitted', label: 'Soumis', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  { value: 'late', label: 'En retard', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  { value: 'graded', label: 'Noté', color: 'bg-amber-100 text-amber-700', icon: ClipboardList },
] as const

// ---------- Helpers ----------

function getTypeConfig(type: string) {
  return HOMEWORK_TYPES.find(t => t.value === type) || HOMEWORK_TYPES[0]
}

function getStatusConfig(status: string) {
  return HOMEWORK_STATUSES.find(s => s.value === status) || HOMEWORK_STATUSES[0]
}

function getSubmissionStatusConfig(status: string) {
  return SUBMISSION_STATUSES.find(s => s.value === status) || SUBMISSION_STATUSES[0]
}

function formatDateFR(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate + 'T23:59:59') < new Date()
}

function daysUntilDue(dueDate: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// ---------- Main Component ----------

export default function HomeworkModule() {
  const schoolYear = useAppStore((s) => s.schoolYear)
  const addToast = useAppStore((s) => s.addToast)
  const currentUser = useAppStore((s) => s.currentUser)

  const [homeworks, setHomeworks] = useState<HomeworkItem[]>([])
  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [subjects, setSubjects] = useState<SubjectInfo[]>([])
  const [teachers, setTeachers] = useState<TeacherInfo[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterClassId, setFilterClassId] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Dialogs
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editingHomework, setEditingHomework] = useState<HomeworkItem | null>(null)
  const [deleteHomework, setDeleteHomework] = useState<HomeworkItem | null>(null)
  const [detailHomework, setDetailHomework] = useState<HomeworkItem | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSubjectId, setFormSubjectId] = useState('')
  const [formClassId, setFormClassId] = useState('')
  const [formTeacherId, setFormTeacherId] = useState('')
  const [formDueDate, setFormDueDate] = useState('')
  const [formAssignedDate, setFormAssignedDate] = useState('')
  const [formType, setFormType] = useState('homework')
  const [formStatus, setFormStatus] = useState('active')

  // Submission grading
  const [gradingSubmission, setGradingSubmission] = useState<SubmissionInfo | null>(null)
  const [gradeValue, setGradeValue] = useState('')
  const [gradeComment, setGradeComment] = useState('')

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'
  const isTeacher = currentUser?.role === 'teacher'
  const isParent = currentUser?.role === 'parent'
  const canEdit = isAdmin || isTeacher

  // Parent-specific state
  const [children, setChildren] = useState<ChildInfo[]>([])
  const [filterChildId, setFilterChildId] = useState<string>('all')
  const [parentView, setParentView] = useState<'my-children' | 'all'>('my-children')

  // Computed: class IDs of parent's children
  const childClassIds = children.map(c => c.classId).filter(Boolean) as string[]

  const fetchData = useCallback(async () => {
    try {
      // For parents, fetch children first, then ALL homework
      if (isParent && currentUser) {
        // Get parentId from currentUser (set during login)
        const parentData = (currentUser as Record<string, unknown>)?.parent as { id: string } | undefined
        const parentId = parentData?.id

        if (parentId) {
          // Fetch this parent's children
          const childrenRes = await fetch(`/api/parents?forSelection=true&userId=${currentUser.id}&role=parent`, {
            headers: { 'x-user-id': currentUser.id, 'x-institution-id': currentUser.institutionId || '', 'x-user-role': currentUser.role },
          })
          if (childrenRes.ok) {
            const parentsData = await childrenRes.json()
            const parentList = parentsData.data || []
            const myParentRecord = parentList.find((p: Record<string, unknown>) => p.userId === currentUser.id)
            if (myParentRecord) {
              const childList: ChildInfo[] = ((myParentRecord as Record<string, unknown>).children || []).map((s: Record<string, unknown>) => ({
                id: s.id as string,
                firstName: s.firstName as string,
                lastName: s.lastName as string,
                classId: s.classId as string | null,
                className: (s.class as Record<string, unknown>)?.name as string | null,
              }))
              setChildren(childList)
            }
          }
        }

        // Fetch ALL homework (not filtered by parentId) so parents can see everything
        const hwRes = await fetch(`/api/homework?schoolYear=${schoolYear}`)
        if (hwRes.ok) {
          const json = await hwRes.json()
          setHomeworks(json.homeworks || [])
        }

        // Also fetch classes for filters
        const clsRes = await fetch(`/api/classes?schoolYear=${schoolYear}`)
        if (clsRes.ok) {
          const json = await clsRes.json()
          setClasses((json.classes || []).map((c: ClassInfo) => ({ id: c.id, name: c.name, level: c.level, section: c.section })))
        }
      } else {
        // Admin/Teacher flow
        const [hwRes, clsRes, subRes, tchRes] = await Promise.all([
          fetch(`/api/homework?schoolYear=${schoolYear}`),
          fetch(`/api/classes?schoolYear=${schoolYear}`),
          fetch('/api/subjects'),
          fetch('/api/teachers'),
        ])
        if (hwRes.ok) {
          const json = await hwRes.json()
          setHomeworks(json.homeworks || [])
        }
        if (clsRes.ok) {
          const json = await clsRes.json()
          setClasses((json.classes || []).map((c: ClassInfo) => ({ id: c.id, name: c.name, level: c.level, section: c.section })))
        }
        if (subRes.ok) {
          const json = await subRes.json()
          setSubjects(json.subjects || [])
        }
        if (tchRes.ok) {
          const json = await tchRes.json()
          setTeachers((json.teachers || []).map((t: { id: string; firstName: string; lastName: string }) => ({ id: t.id, firstName: t.firstName, lastName: t.lastName })))
        }
      }
    } catch (err) {
      console.error('Failed to fetch homework:', err)
    } finally {
      setLoading(false)
    }
  }, [schoolYear, isParent, currentUser])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Check if a homework belongs to parent's children's classes
  const isChildHomework = useCallback((hw: HomeworkItem) => {
    return childClassIds.includes(hw.classId)
  }, [childClassIds])

  // Get which children are in the class of a given homework
  const getChildrenForHomework = useCallback((hw: HomeworkItem) => {
    return children.filter(c => c.classId === hw.classId)
  }, [children])

  // Filter homeworks
  const filteredHomeworks = homeworks.filter(hw => {
    // Parent: when viewing only children's homework
    if (isParent && parentView === 'my-children') {
      if (!isChildHomework(hw)) return false
    }
    // Parent: filter by selected child's class
    if (isParent && filterChildId !== 'all') {
      const child = children.find(c => c.id === filterChildId)
      if (child?.classId && hw.classId !== child.classId) return false
    }
    if (filterClassId !== 'all' && hw.classId !== filterClassId) return false
    if (filterStatus !== 'all' && hw.status !== filterStatus) return false
    if (filterType !== 'all' && hw.type !== filterType) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesTitle = hw.title.toLowerCase().includes(q)
      const matchesSubject = hw.subject?.name.toLowerCase().includes(q)
      const matchesClass = hw.class?.name.toLowerCase().includes(q)
      if (!matchesTitle && !matchesSubject && !matchesClass) return false
    }
    return true
  })

  // Sort: children's homework first for parents in 'all' view
  const sortedHomeworks = isParent
    ? [...filteredHomeworks].sort((a, b) => {
        const aChild = isChildHomework(a) ? 0 : 1
        const bChild = isChildHomework(b) ? 0 : 1
        return aChild - bChild
      })
    : filteredHomeworks

  // Stats
  const myChildrenHomeworks = isParent ? homeworks.filter(h => isChildHomework(h)) : homeworks
  const stats = {
    total: isParent && parentView === 'my-children' ? myChildrenHomeworks.length : homeworks.length,
    active: (isParent && parentView === 'my-children' ? myChildrenHomeworks : homeworks).filter(h => h.status === 'active').length,
    overdue: (isParent && parentView === 'my-children' ? myChildrenHomeworks : homeworks).filter(h => h.status === 'active' && isOverdue(h.dueDate)).length,
    graded: (isParent && parentView === 'my-children' ? myChildrenHomeworks : homeworks).filter(h => h.status === 'graded').length,
    childrenTotal: isParent ? myChildrenHomeworks.length : 0,
  }

  // Open create dialog
  function handleCreate() {
    setEditingHomework(null)
    setFormTitle('')
    setFormDescription('')
    setFormSubjectId('')
    setFormClassId(classes.length > 0 ? classes[0].id : '')
    setFormTeacherId('')
    setFormDueDate('')
    setFormAssignedDate(new Date().toISOString().split('T')[0])
    setFormType('homework')
    setFormStatus('active')
    setShowFormDialog(true)
  }

  // Open edit dialog
  function handleEdit(hw: HomeworkItem) {
    setEditingHomework(hw)
    setFormTitle(hw.title)
    setFormDescription(hw.description || '')
    setFormSubjectId(hw.subjectId || '')
    setFormClassId(hw.classId)
    setFormTeacherId(hw.teacherId || '')
    setFormDueDate(hw.dueDate)
    setFormAssignedDate(hw.assignedDate)
    setFormType(hw.type)
    setFormStatus(hw.status)
    setShowFormDialog(true)
  }

  // Save homework
  async function handleSave() {
    if (!formTitle.trim() || !formClassId || !formDueDate) {
      addToast('error', 'Champs requis', 'Titre, classe et date limite sont obligatoires')
      return
    }
    setSaving(true)
    try {
      const url = editingHomework ? `/api/homework/${editingHomework.id}` : '/api/homework'
      const method = editingHomework ? 'PUT' : 'POST'
      const body = editingHomework
        ? {
            title: formTitle.trim(),
            description: formDescription.trim(),
            subjectId: formSubjectId || null,
            classId: formClassId,
            teacherId: formTeacherId || null,
            dueDate: formDueDate,
            assignedDate: formAssignedDate,
            type: formType,
            status: formStatus,
          }
        : {
            title: formTitle.trim(),
            description: formDescription.trim(),
            subjectId: formSubjectId || null,
            classId: formClassId,
            teacherId: formTeacherId || null,
            dueDate: formDueDate,
            assignedDate: formAssignedDate,
            type: formType,
            status: formStatus,
            schoolYear,
          }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-user-role': currentUser?.role || '' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        addToast('success', editingHomework ? 'Devoir modifié' : 'Devoir créé', formTitle)
        setShowFormDialog(false)
        fetchData()
      } else {
        const json = await res.json()
        addToast('error', 'Erreur', json.error || 'Impossible de sauvegarder')
      }
    } catch {
      addToast('error', 'Erreur', 'Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  // Delete homework
  async function handleDeleteConfirm() {
    if (!deleteHomework) return
    try {
      const res = await fetch(`/api/homework/${deleteHomework.id}`, {
        method: 'DELETE',
        headers: { 'x-user-role': currentUser?.role || '' },
      })
      if (res.ok) {
        addToast('success', 'Devoir supprimé', deleteHomework.title)
        setDeleteHomework(null)
        fetchData()
      } else {
        addToast('error', 'Erreur', 'Impossible de supprimer')
      }
    } catch {
      addToast('error', 'Erreur', 'Erreur réseau')
    }
  }

  // View detail
  async function handleViewDetail(hw: HomeworkItem) {
    try {
      const res = await fetch(`/api/homework/${hw.id}`)
      if (res.ok) {
        const json = await res.json()
        setDetailHomework(json.homework)
      }
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les détails')
    }
  }

  // Grade submission
  async function handleGradeSubmission() {
    if (!gradingSubmission || !gradeValue) return
    try {
      const res = await fetch(`/api/homework/submissions/${gradingSubmission.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-role': currentUser?.role || '' },
        body: JSON.stringify({
          grade: parseFloat(gradeValue),
          comment: gradeComment || null,
          status: 'graded',
        }),
      })
      if (res.ok) {
        addToast('success', 'Note enregistrée', `${gradingSubmission.student.firstName} ${gradingSubmission.student.lastName}`)
        setGradingSubmission(null)
        setGradeValue('')
        setGradeComment('')
        if (detailHomework) {
          handleViewDetail(detailHomework)
        }
        fetchData()
      } else {
        addToast('error', 'Erreur', 'Impossible d\'enregistrer la note')
      }
    } catch {
      addToast('error', 'Erreur', 'Erreur réseau')
    }
  }

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-96 bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* ===== Header ===== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
            <HomeworkIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">
              {isParent ? 'Devoirs' : 'Devoirs à domicile'}
            </h2>
            <p className="text-sm text-muted-foreground">Année {schoolYear}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button onClick={handleCreate} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouveau devoir</span>
            </Button>
          )}
        </div>
      </div>

      {/* ===== Stats ===== */}
      <div className={`grid grid-cols-2 ${isParent ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-3`}>
        {isParent && (
          <Card className="p-3 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center">
                <Heart className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{stats.childrenTotal}</p>
                <p className="text-xs text-muted-foreground">Mes enfants</p>
              </div>
            </div>
          </Card>
        )}
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Actifs</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.overdue}</p>
              <p className="text-xs text-muted-foreground">En retard</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.graded}</p>
              <p className="text-xs text-muted-foreground">Notés</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ===== Parent View Toggle & Children Info ===== */}
      {isParent && (
        <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
          <CardContent className="p-4">
            {/* View Toggle */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex bg-white dark:bg-gray-900 rounded-lg p-1 border border-purple-200 dark:border-purple-700">
                <button
                  type="button"
                  onClick={() => { setParentView('my-children'); setFilterChildId('all') }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    parentView === 'my-children'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" />
                  Mes enfants
                </button>
                <button
                  type="button"
                  onClick={() => setParentView('all')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    parentView === 'all'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Tous les devoirs
                </button>
              </div>
              {parentView === 'my-children' && children.length > 0 && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 text-xs ml-auto">
                  {stats.childrenTotal} devoir{stats.childrenTotal !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {/* Children Filter */}
            {children.length > 0 && (
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-900 dark:text-purple-100">
                  Filtrer par enfant :
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {children.map(child => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => {
                    setFilterChildId(filterChildId === child.id ? 'all' : child.id)
                    if (parentView !== 'my-children') setParentView('my-children')
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    filterChildId === child.id
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  {child.firstName} {child.lastName}
                  {child.className && (
                    <span className={`text-[10px] ${filterChildId === child.id ? 'text-purple-200' : 'text-muted-foreground'}`}>
                      ({child.className})
                    </span>
                  )}
                </button>
              ))}
              {filterChildId !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterChildId('all')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  × Voir tout
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== Filters ===== */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un devoir..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterClassId} onValueChange={setFilterClassId}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {HOMEWORK_STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {HOMEWORK_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ===== Homework List ===== */}
      {sortedHomeworks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <HomeworkIcon className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              {isParent && parentView === 'my-children'
                ? 'Aucun devoir trouvé pour vos enfants'
                : 'Aucun devoir trouvé'}
            </p>
            {isParent && parentView === 'my-children' && (
              <Button
                onClick={() => setParentView('all')}
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5"
              >
                <LayoutGrid className="w-4 h-4" /> Voir tous les devoirs
              </Button>
            )}
            {canEdit && (
              <Button onClick={handleCreate} variant="outline" size="sm" className="mt-3 gap-1.5">
                <Plus className="w-4 h-4" /> Créer un devoir
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedHomeworks.map(hw => {
            const typeCfg = getTypeConfig(hw.type)
            const statusCfg = getStatusConfig(hw.status)
            const overdue = hw.status === 'active' && isOverdue(hw.dueDate)
            const days = daysUntilDue(hw.dueDate)
            const TypeIcon = typeCfg.icon
            const isMyChildHw = isParent && isChildHomework(hw)
            const hwChildren = isParent ? getChildrenForHomework(hw) : []

            return (
              <motion.div
                key={hw.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className={`overflow-hidden hover:shadow-md transition-shadow ${
                  isMyChildHw
                    ? 'border-purple-300 dark:border-purple-700 bg-purple-50/30 dark:bg-purple-950/10'
                    : overdue
                      ? 'border-red-200 dark:border-red-900'
                      : ''
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isMyChildHw ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400' : typeCfg.color}`}>
                        {isMyChildHw ? <Heart className="w-5 h-5" /> : <TypeIcon className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`font-semibold text-sm truncate ${isMyChildHw ? 'text-purple-900 dark:text-purple-100' : ''}`}>{hw.title}</h3>
                          {isMyChildHw && (
                            <Badge className="text-[10px] h-5 px-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 gap-0.5">
                              <Heart className="w-3 h-3" /> Mon enfant
                            </Badge>
                          )}
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${typeCfg.color}`}>
                            {typeCfg.label}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${statusCfg.color}`}>
                            {statusCfg.label}
                          </Badge>
                          {overdue && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-red-100 text-red-700 border-red-300">
                              <AlertTriangle className="w-3 h-3 mr-0.5" /> En retard
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3.5 h-3.5" />
                            {hw.class?.name}
                          </span>
                          {hw.subject && (
                            <span className="flex items-center gap-1">
                              <HomeworkIcon className="w-3.5 h-3.5" />
                              {hw.subject.name}
                            </span>
                          )}
                          {hw.teacher && (
                            <span>
                              Par {hw.teacher.firstName} {hw.teacher.lastName}
                            </span>
                          )}
                        </div>
                        {/* Show which children are concerned */}
                        {isMyChildHw && hwChildren.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {hwChildren.map(child => (
                              <span key={child.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                <GraduationCap className="w-3 h-3" />
                                {child.firstName} {child.lastName}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <CalendarDays className="w-3.5 h-3.5" />
                            Limite: {formatDateFR(hw.dueDate)}
                          </span>
                          {hw.status === 'active' && !overdue && days <= 3 && days >= 0 && (
                            <span className="text-amber-600 font-medium flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {days === 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : `Dans ${days} jours`}
                            </span>
                          )}
                          {hw._count && (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Send className="w-3.5 h-3.5" />
                              {hw._count.submissions} soumission{hw._count.submissions !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {hw.description && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{hw.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleViewDetail(hw)}>
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                        {canEdit && (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(hw)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setDeleteHomework(hw)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ===== Detail Dialog ===== */}
      <Dialog open={!!detailHomework} onOpenChange={(open) => !open && setDetailHomework(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {detailHomework?.title}
              {detailHomework && isParent && isChildHomework(detailHomework) && (
                <Badge className="text-[10px] h-5 px-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 gap-0.5">
                  <Heart className="w-3 h-3" /> Mon enfant
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 flex-wrap">
              {detailHomework?.class?.name} — {detailHomework?.subject?.name || 'Aucune matière'}
              {detailHomework && isParent && isChildHomework(detailHomework) && (
                <span className="inline-flex items-center gap-1 text-purple-600">
                  {getChildrenForHomework(detailHomework).map(c => (
                    <span key={c.id} className="inline-flex items-center gap-0.5 text-[10px] font-medium">
                      <GraduationCap className="w-3 h-3" />{c.firstName} {c.lastName}
                    </span>
                  ))}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {detailHomework && (
            <div className="space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Date limite:</span>
                  <p className="font-medium">{formatDateFR(detailHomework.dueDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date assignée:</span>
                  <p className="font-medium">{formatDateFR(detailHomework.assignedDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <div className="mt-0.5">
                    <Badge variant="outline" className={getTypeConfig(detailHomework.type).color}>
                      {getTypeConfig(detailHomework.type).label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Statut:</span>
                  <div className="mt-0.5">
                    <Badge variant="outline" className={getStatusConfig(detailHomework.status).color}>
                      {getStatusConfig(detailHomework.status).label}
                    </Badge>
                  </div>
                </div>
              </div>

              {detailHomework.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description:</p>
                    <p className="text-sm whitespace-pre-wrap">{detailHomework.description}</p>
                  </div>
                </>
              )}

              {/* Submissions */}
              {detailHomework.submissions && detailHomework.submissions.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      {isParent ? `Soumissions (${detailHomework.submissions.length})` : `Soumissions (${detailHomework.submissions.length})`}
                    </h4>
                    <ScrollArea className="max-h-64">
                      <div className="space-y-2">
                        {/* Sort: parent's children submissions first */}
                        {[...detailHomework.submissions]
                          .sort((a, b) => {
                            if (!isParent) return 0
                            const aChild = children.some(c => c.id === a.studentId) ? 0 : 1
                            const bChild = children.some(c => c.id === b.studentId) ? 0 : 1
                            return aChild - bChild
                          })
                          .map(sub => {
                            const subCfg = getSubmissionStatusConfig(sub.status)
                            const SubIcon = subCfg.icon
                            const isMyChild = children.some(c => c.id === sub.studentId)
                            return (
                              <div key={sub.id} className={`flex items-center justify-between p-2 rounded-lg text-sm ${isMyChild && isParent ? 'bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800' : 'bg-muted/50'}`}>
                                <div className="flex items-center gap-2">
                                  <SubIcon className={`w-4 h-4 ${isMyChild && isParent ? 'text-purple-600' : ''}`} />
                                  <span className={`font-medium ${isMyChild && isParent ? 'text-purple-900 dark:text-purple-100' : ''}`}>{sub.student.firstName} {sub.student.lastName}</span>
                                  <Badge variant="outline" className={`text-[9px] h-4 px-1 ${subCfg.color}`}>
                                    {subCfg.label}
                                  </Badge>
                                  {isMyChild && isParent && (
                                    <Badge className="text-[9px] h-4 px-1 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                                      Mon enfant
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {sub.grade !== null ? (
                                    <span className="font-bold text-amber-600">{sub.grade}/{sub.maxGrade}</span>
                                  ) : canEdit ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[10px] gap-1"
                                      onClick={() => {
                                        setGradingSubmission(sub)
                                        setGradeValue('')
                                        setGradeComment(sub.comment || '')
                                      }}
                                    >
                                      <GraduationCap className="w-3 h-3" /> Noter
                                    </Button>
                                  ) : null}
                                  {sub.comment && isParent && isMyChild && (
                                    <span className="text-xs text-muted-foreground italic max-w-[200px] truncate" title={sub.comment}>
                                      {sub.comment}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        {isParent && detailHomework.submissions.filter(sub => children.some(c => c.id === sub.studentId)).length === 0 && (
                          <div className="text-center py-4 text-muted-foreground text-sm">
                            <p>Aucune soumission de vos enfants pour ce devoir</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Create/Edit Dialog ===== */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingHomework ? 'Modifier le devoir' : 'Nouveau devoir'}</DialogTitle>
            <DialogDescription>
              {editingHomework ? 'Modifiez les détails du devoir' : 'Ajoutez un nouveau devoir à domicile'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hw-title">Titre *</Label>
              <Input
                id="hw-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: Exercices page 45"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Classe *</Label>
                <Select value={formClassId} onValueChange={setFormClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Matière</Label>
                <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {subjects.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOMEWORK_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Enseignant</Label>
                <Select value={formTeacherId} onValueChange={setFormTeacherId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {teachers.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="hw-assigned-date">Date d&apos;assignation</Label>
                <Input
                  id="hw-assigned-date"
                  type="date"
                  value={formAssignedDate}
                  onChange={(e) => setFormAssignedDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hw-due-date">Date limite *</Label>
                <Input
                  id="hw-due-date"
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  min={formAssignedDate}
                />
              </div>
            </div>

            {editingHomework && (
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOMEWORK_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="hw-description">Description</Label>
              <Textarea
                id="hw-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Détails du devoir (optionnel)"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || !formTitle.trim() || !formClassId || !formDueDate}>
              {saving ? 'Enregistrement...' : editingHomework ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Grading Dialog ===== */}
      <Dialog open={!!gradingSubmission} onOpenChange={(open) => !open && setGradingSubmission(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Noter la soumission</DialogTitle>
            <DialogDescription>
              {gradingSubmission?.student.firstName} {gradingSubmission?.student.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Note (sur 20)</Label>
              <Input
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={gradeValue}
                onChange={(e) => setGradeValue(e.target.value)}
                placeholder="0-20"
              />
            </div>
            <div className="space-y-2">
              <Label>Commentaire</Label>
              <Textarea
                value={gradeComment}
                onChange={(e) => setGradeComment(e.target.value)}
                placeholder="Feedback (optionnel)"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradingSubmission(null)}>Annuler</Button>
            <Button onClick={handleGradeSubmission} disabled={!gradeValue || parseFloat(gradeValue) < 0 || parseFloat(gradeValue) > 20}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirmation ===== */}
      <AlertDialog open={!!deleteHomework} onOpenChange={(open) => !open && setDeleteHomework(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le devoir</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le devoir &quot;{deleteHomework?.title}&quot; ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
