'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  School,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Users,
  MapPin,
  Calendar,
  BookOpen,
  GraduationCap,
  X,
  Loader2,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { withSchoolYear, getImageUrl } from '@/lib/utils'
import { useAvatarChangedListener } from '@/hooks/use-avatar-refresh'
import type { Class, Student, ClassTeacher, Schedule, Teacher } from '@/lib/types'
import { CLASS_LEVELS, DAY_LABELS, CURRENT_SCHOOL_YEAR } from '@/lib/constants'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

// ---------- Types ----------

interface ClassWithCount extends Class {
  studentCount?: number
}

interface ClassDetail extends ClassWithCount {
  students?: Student[]
  teachers?: ClassTeacher[]
  schedules?: Schedule[]
}

interface ClassFormData {
  name: string
  level: string
  section: string
  capacity: string
  room: string
  schoolYear: string
}

interface AssignedTeacher {
  teacherId: string
  subject: string
}

const emptyForm: ClassFormData = {
  name: '',
  level: '',
  section: '',
  capacity: '30',
  room: '',
  schoolYear: CURRENT_SCHOOL_YEAR,
}

// ---------- Component ----------

export default function ClassesModule() {
  const addToast = useAppStore((s) => s.addToast)
  const currentUser = useAppStore((s) => s.currentUser)
  const schoolYear = useAppStore((s) => s.schoolYear)
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  // Data state
  const [classes, setClasses] = useState<ClassWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassWithCount | null>(null)
  const [viewingClass, setViewingClass] = useState<ClassDetail | null>(null)
  const [deletingClass, setDeletingClass] = useState<ClassWithCount | null>(null)
  const [form, setForm] = useState<ClassFormData>(emptyForm)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [assignedTeachers, setAssignedTeachers] = useState<AssignedTeacher[]>([])

  // ---------- Data Fetching ----------

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(withSchoolYear('/api/classes', schoolYear))
      const data = await res.json()
      setClasses(data.classes || [])
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les classes')
    } finally {
      setLoading(false)
    }
  }, [schoolYear, addToast])

  useEffect(() => {
    fetchClasses()
  }, [fetchClasses])

  // Re-fetch the classes list whenever an avatar changes elsewhere in the app
  // (e.g. a student's or teacher's photo is updated in their dedicated module)
  // so the class cards and detail view use the cache-busted avatar URL.
  useAvatarChangedListener(() => { fetchClasses() }, [fetchClasses])

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch(withSchoolYear('/api/teachers?limit=9999', schoolYear))
      const data = await res.json()
      setTeachers(data.teachers || [])
    } catch {
      // Silent fail
    }
  }, [schoolYear])

  useEffect(() => {
    fetchTeachers()
  }, [fetchTeachers])

  // ---------- Handlers ----------

  const openAddForm = () => {
    setEditingClass(null)
    setForm(emptyForm)
    setAssignedTeachers([])
    setFormOpen(true)
  }

  const openEditForm = async (cls: ClassWithCount) => {
    setEditingClass(cls)
    setForm({
      name: cls.name,
      level: cls.level,
      section: cls.section || '',
      capacity: String(cls.capacity),
      room: cls.room || '',
      schoolYear: cls.schoolYear,
    })
    // Load existing teacher assignments
    try {
      const res = await fetch(`/api/classes/${cls.id}`)
      const data = await res.json()
      const existing = (data.class?.teachers || []) as ClassTeacher[]
      setAssignedTeachers(existing.map((ct: ClassTeacher) => ({
        teacherId: ct.teacherId,
        subject: ct.subject || ct.teacher?.subject || '',
      })))
    } catch {
      setAssignedTeachers([])
    }
    setFormOpen(true)
  }

  const openDetail = async (cls: ClassWithCount) => {
    try {
      const res = await fetch(`/api/classes/${cls.id}`)
      const data = await res.json()
      setViewingClass(data.class || cls)
      setDetailOpen(true)
    } catch {
      setViewingClass(cls as unknown as ClassDetail)
      setDetailOpen(true)
    }
  }

  const openDelete = (cls: ClassWithCount) => {
    setDeletingClass(cls)
    setDeleteOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.name || !form.level) {
      addToast('error', 'Erreur', 'Nom et niveau sont requis')
      return
    }

    try {
      setSubmitting(true)

      if (editingClass) {
        const res = await fetch(`/api/classes/${editingClass.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-role': currentUser?.role || '' },
          body: JSON.stringify({
            name: form.name,
            level: form.level,
            section: form.section || undefined,
            capacity: form.capacity ? parseInt(form.capacity) : undefined,
            room: form.room || undefined,
            schoolYear: form.schoolYear || CURRENT_SCHOOL_YEAR,
            teachers: assignedTeachers,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erreur lors de la modification')
        }
        addToast('success', 'Classe modifiée', `${form.name} a été modifiée`)
      } else {
        const res = await fetch('/api/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': currentUser?.role || '' },
          body: JSON.stringify({
            name: form.name,
            level: form.level,
            section: form.section || undefined,
            capacity: form.capacity ? parseInt(form.capacity) : 30,
            schoolYear: form.schoolYear || CURRENT_SCHOOL_YEAR,
            room: form.room || undefined,
            teachers: assignedTeachers,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erreur lors de la création')
        }
        addToast('success', 'Classe ajoutée', `${form.name} a été créée`)
      }

      setFormOpen(false)
      setForm(emptyForm)
      setEditingClass(null)
      setAssignedTeachers([])
      fetchClasses()
    } catch (err) {
      addToast('error', 'Erreur', err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingClass) return
    try {
      const res = await fetch(`/api/classes/${deletingClass.id}`, {
        method: 'DELETE',
        headers: { 'x-user-role': currentUser?.role || '' },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la suppression')
      }
      addToast('success', 'Classe supprimée', `${deletingClass.name} a été supprimée`)
      setDeleteOpen(false)
      setDeletingClass(null)
      fetchClasses()
    } catch (err) {
      addToast('error', 'Erreur', err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const updateForm = (field: keyof ClassFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const getLevelColor = (level: string) => {
    const levelDef = CLASS_LEVELS.find((l) => l.value === level)
    if (!levelDef) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    switch (levelDef.cycle) {
      case 'Primaire':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'Collège':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      case 'Lycée':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  const getLevelCycle = (level: string) => {
    const levelDef = CLASS_LEVELS.find((l) => l.value === level)
    return levelDef?.cycle || ''
  }

  const getOccupancyColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 70) return 'text-amber-600'
    return 'text-emerald-600'
  }

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <School className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestion des Classes</h1>
            <p className="text-sm text-muted-foreground">
              {classes.length} classe{classes.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={openAddForm} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <Plus className="h-4 w-4" />
            Ajouter une classe
          </Button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && classes.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <School className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Aucune classe trouvée</h3>
            <p className="mt-1 text-sm text-muted-foreground text-center">
              Commencez par ajouter votre première classe.
            </p>
            {isAdmin && (
              <Button onClick={openAddForm} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                <Plus className="h-4 w-4" />
                Ajouter une classe
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Classes Grid */}
      {!loading && classes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {classes.map((cls) => {
              const studentCount = cls.studentCount ?? 0
              const capacity = cls.capacity || 30
              const occupancy = capacity > 0 ? Math.round((studentCount / capacity) * 100) : 0

              return (
                <motion.div
                  key={cls.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="h-full flex flex-col">
                    <CardContent className="p-6 flex-1 flex flex-col">
                      {/* Class Name & Level */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{cls.name}</h3>
                          <Badge variant="secondary" className={`mt-1 text-xs ${getLevelColor(cls.level)}`}>
                            {cls.level} {getLevelCycle(cls.level) && `— ${getLevelCycle(cls.level)}`}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(cls)} title="Voir">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditForm(cls)} title="Modifier">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => openDelete(cls)}
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Student Count & Progress */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            <span>Effectif</span>
                          </div>
                          <span className={`font-medium ${getOccupancyColor(occupancy)}`}>
                            {studentCount} / {capacity}
                          </span>
                        </div>
                        <Progress
                          value={occupancy}
                          className="h-2"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {occupancy}% de remplissage
                        </p>
                      </div>

                      {/* Details */}
                      <div className="mt-4 space-y-2 flex-1">
                        {cls.room && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>Salle {cls.room}</span>
                          </div>
                        )}
                        {cls.schoolYear && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Année {cls.schoolYear}</span>
                          </div>
                        )}
                        {cls.section && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>Section {cls.section}</span>
                          </div>
                        )}
                      </div>

                      {/* Teachers Assigned — names visible directly on the card */}
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                          <GraduationCap className="h-3.5 w-3.5" />
                          <span>Enseignants assignés</span>
                          {cls.teachers && cls.teachers.length > 0 && (
                            <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5">
                              {cls.teachers.length}
                            </Badge>
                          )}
                        </div>
                        {cls.teachers && cls.teachers.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-[84px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                            {cls.teachers.map((ct: ClassTeacher) => {
                              const teacherName = `${ct.teacher?.firstName ?? ''} ${ct.teacher?.lastName ?? ''}`.trim()
                              const subject = ct.subject || ct.teacher?.subject
                              return (
                                <div
                                  key={ct.id}
                                  className="inline-flex items-center gap-1 rounded-md bg-teal-50 border border-teal-200 px-1.5 py-0.5 text-[11px] text-teal-700 dark:bg-teal-900/20 dark:border-teal-800 dark:text-teal-300"
                                  title={subject ? `${teacherName} — ${subject}` : teacherName}
                                >
                                  <span className="font-medium">{teacherName || 'Inconnu'}</span>
                                  {subject && (
                                    <span className="text-teal-500/80 dark:text-teal-400/70">
                                      · {subject}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/60 italic">
                            Aucun enseignant assigné
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ===== Add/Edit Class Dialog ===== */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingClass ? 'Modifier la classe' : 'Ajouter une classe'}
            </DialogTitle>
            <DialogDescription>
              {editingClass
                ? 'Modifiez les informations de la classe ci-dessous.'
                : 'Remplissez les informations pour créer une nouvelle classe.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="c-name">Nom de la classe *</Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Ex: 6ème A"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c-level">Niveau *</Label>
                <Input
                  id="c-level"
                  value={form.level}
                  onChange={(e) => updateForm('level', e.target.value)}
                  placeholder="Ex: 6ème, 5ème, Terminale..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-section">Section</Label>
                <Input
                  id="c-section"
                  value={form.section}
                  onChange={(e) => updateForm('section', e.target.value)}
                  placeholder="Ex: A, B, Scientifique..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c-capacity">Capacité</Label>
                <Input
                  id="c-capacity"
                  type="number"
                  value={form.capacity}
                  onChange={(e) => updateForm('capacity', e.target.value)}
                  placeholder="30"
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-room">Salle</Label>
                <Input
                  id="c-room"
                  value={form.room}
                  onChange={(e) => updateForm('room', e.target.value)}
                  placeholder="Ex: Salle 12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="c-schoolYear">Année scolaire</Label>
              <Input
                id="c-schoolYear"
                value={form.schoolYear}
                onChange={(e) => updateForm('schoolYear', e.target.value)}
                placeholder="2024-2025"
              />
            </div>

            <Separator />

            {/* Teacher Assignments */}
            <div className="space-y-3">
              <Label>Enseignants assignés</Label>
              {assignedTeachers.length > 0 && (
                <div className="space-y-2">
                  {assignedTeachers.map((at, idx) => {
                    const teacher = teachers.find((t) => t.id === at.teacherId)
                    return (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="text-sm font-medium truncate">
                            {teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Inconnu'}
                          </div>
                          <Input
                            value={at.subject}
                            onChange={(e) => {
                              const updated = [...assignedTeachers]
                              updated[idx] = { ...updated[idx], subject: e.target.value }
                              setAssignedTeachers(updated)
                            }}
                            placeholder="Matière"
                            className="h-8 text-sm"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setAssignedTeachers(assignedTeachers.filter((_, i) => i !== idx))
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
              {teachers.length > 0 ? (
                <div className="flex items-center gap-2">
                  <Select
                    value=""
                    onValueChange={(val) => {
                      if (val && !assignedTeachers.some((at) => at.teacherId === val)) {
                        const teacher = teachers.find((t) => t.id === val)
                        setAssignedTeachers([...assignedTeachers, { teacherId: val, subject: teacher?.subject || '' }])
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="+ Ajouter un enseignant" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers
                        .filter((t) => !assignedTeachers.some((at) => at.teacherId === t.id))
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.firstName} {t.lastName} {t.subject ? `(${t.subject})` : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun enseignant disponible. Ajoutez d'abord des enseignants.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingClass ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Class Detail Dialog ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de la classe</DialogTitle>
          </DialogHeader>
          {viewingClass && (
            <div className="space-y-4">
              {/* Class Header Info */}
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                  <School className="h-6 w-6 sm:h-7 sm:w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-xl font-semibold break-words">{viewingClass.name}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                    <Badge variant="secondary" className={`text-xs shrink-0 ${getLevelColor(viewingClass.level)}`}>
                      {viewingClass.level}
                    </Badge>
                    {viewingClass.section && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        Section {viewingClass.section}
                      </Badge>
                    )}
                    {viewingClass.room && (
                      <span className="text-xs text-muted-foreground shrink-0">Salle {viewingClass.room}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-lg bg-muted p-2 sm:p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-emerald-600">
                    {viewingClass.studentCount ?? viewingClass.students?.length ?? 0}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Élèves</p>
                </div>
                <div className="rounded-lg bg-muted p-2 sm:p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-teal-600">
                    {viewingClass.teachers?.length ?? 0}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Enseignants</p>
                </div>
                <div className="rounded-lg bg-muted p-2 sm:p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-amber-600">
                    {viewingClass.capacity}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Capacité</p>
                </div>
              </div>

              <Separator />

              {/* Tabs */}
              <Tabs defaultValue="students" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-auto gap-1">
                  <TabsTrigger value="students" className="py-2 px-1 sm:px-2 min-w-0 text-xs sm:text-sm">
                    <span className="truncate">Élèves</span>
                  </TabsTrigger>
                  <TabsTrigger value="teachers" className="py-2 px-1 sm:px-2 min-w-0 text-xs sm:text-sm">
                    <span className="truncate">Enseignants</span>
                  </TabsTrigger>
                  <TabsTrigger value="schedule" className="py-2 px-1 sm:px-2 min-w-0 text-xs sm:text-sm">
                    <span className="truncate">Emploi du temps</span>
                  </TabsTrigger>
                </TabsList>

                {/* Students Tab */}
                <TabsContent value="students" className="mt-4">
                  <ScrollArea className="max-h-64">
                    {viewingClass.students && viewingClass.students.length > 0 ? (
                      <div className="space-y-2">
                        {viewingClass.students.map((student, idx) => (
                          <div
                            key={student.id}
                            className="flex items-center justify-between rounded-md bg-muted/50 p-2.5 gap-2"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarImage src={getImageUrl(student.image, student.updatedAt)} alt={`${student.firstName} ${student.lastName}`} />
                                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                  {student.firstName[0]}{student.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {student.firstName} {student.lastName}
                                </p>
                                {student.user?.email && (
                                  <p className="text-xs text-muted-foreground truncate">{student.user.email}</p>
                                )}
                              </div>
                            </div>
                            {student.gender && (
                              <Badge
                                variant="secondary"
                                className={`text-xs shrink-0 ${
                                  student.gender === 'F'
                                    ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
                                    : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                                }`}
                              >
                                {student.gender === 'F' ? 'F' : 'M'}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Aucun élève dans cette classe</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Teachers Tab */}
                <TabsContent value="teachers" className="mt-4">
                  <ScrollArea className="max-h-64">
                    {viewingClass.teachers && viewingClass.teachers.length > 0 ? (
                      <div className="space-y-2">
                        {viewingClass.teachers.map((ct: ClassTeacher) => (
                          <div
                            key={ct.id}
                            className="flex items-center justify-between rounded-md bg-muted/50 p-2.5 gap-2"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarImage src={getImageUrl(ct.teacher?.image, ct.teacher?.updatedAt)} alt={`${ct.teacher?.firstName} ${ct.teacher?.lastName}`} />
                                <AvatarFallback className="bg-teal-100 text-teal-700 text-xs font-semibold">
                                  {ct.teacher?.firstName?.[0]}{ct.teacher?.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {ct.teacher?.firstName} {ct.teacher?.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{ct.subject}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800 shrink-0 max-w-[100px] truncate">
                              {ct.subject}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Aucun enseignant assigné</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Schedule Tab */}
                <TabsContent value="schedule" className="mt-4">
                  <ScrollArea className="max-h-64 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                    {viewingClass.schedules && viewingClass.schedules.length > 0 ? (
                      <div className="space-y-3">
                        {/* Group by day */}
                        {Object.entries(
                          viewingClass.schedules.reduce<Record<number, Schedule[]>>((acc, sch) => {
                            if (!acc[sch.dayOfWeek]) acc[sch.dayOfWeek] = []
                            acc[sch.dayOfWeek].push(sch)
                            return acc
                          }, {})
                        )
                          .sort(([a], [b]) => Number(a) - Number(b))
                          .map(([day, schedules]) => (
                            <div key={day}>
                              <h4 className="text-sm font-semibold mb-1.5 text-emerald-700 dark:text-emerald-400">
                                {DAY_LABELS[Number(day)] || `Jour ${day}`}
                              </h4>
                              <div className="space-y-1.5 ml-2">
                                {schedules
                                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                  .map((sch: Schedule) => (
                                    <div
                                      key={sch.id}
                                      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md bg-muted/50 p-2 text-sm gap-1"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <BookOpen className="h-3 w-3 text-teal-600 shrink-0" />
                                        <span className="font-medium truncate">{sch.subject}</span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-muted-foreground text-xs shrink-0">
                                        <span>{sch.startTime} - {sch.endTime}</span>
                                        {sch.teacher && (
                                          <span className="truncate max-w-[120px]">
                                            ({sch.teacher.firstName} {sch.teacher.lastName})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Aucun emploi du temps défini</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirmation Dialog ===== */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la classe{' '}
              <strong>{deletingClass?.name}</strong>
              {' '}? Les élèves de cette classe seront désinscrits. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingClass(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
