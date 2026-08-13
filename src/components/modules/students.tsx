'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Users,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CalendarClock,
  X,
  XCircle,
  Loader2,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Filter,
  MoreHorizontal,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAppStore } from '@/lib/store'
import { withSchoolYear } from '@/lib/utils'
import type { Student, Class, PersonStatus } from '@/lib/types'
import {
  GENDERS,
  GENDER_LABELS,
  PERSON_STATUSES,
  PERSON_STATUS_LABELS,
  PERSON_STATUS_BADGE_CLASSES,
  PERSON_STATUS_FILTER_OPTIONS,
} from '@/lib/constants'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import ImageDropZone from '@/components/image-dropzone'
import { getImageUrl } from '@/lib/utils'
import { notifyAvatarChanged } from '@/hooks/use-avatar-refresh'
import {
  Pagination as PaginationNav,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination'

// ---------- Types ----------

interface StudentFormData {
  firstName: string
  lastName: string
  email: string
  dateOfBirth: string
  gender: string
  status: PersonStatus
  statusDate: string
  address: string
  classId: string
  parentContact: string
  parentPhone: string
  phone: string
}

const todayISO = () => new Date().toISOString().split('T')[0]

const emptyForm: StudentFormData = {
  firstName: '',
  lastName: '',
  email: '',
  dateOfBirth: '',
  gender: '',
  status: 'active' as PersonStatus,
  statusDate: '',
  address: '',
  classId: '',
  parentContact: '',
  parentPhone: '',
  phone: '',
}

// ---------- Helper ----------

/** Generate page numbers with ellipsis for pagination */
function generatePageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | 'ellipsis')[] = [1]
  if (current > 3) pages.push('ellipsis')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2) pages.push('ellipsis')
  pages.push(total)
  return pages
}

// ---------- Component ----------

export default function StudentsModule() {
  const addToast = useAppStore((s) => s.addToast)
  const currentUser = useAppStore((s) => s.currentUser)
  const schoolYear = useAppStore((s) => s.schoolYear)
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  // Data state
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filter state
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [genderFilter, setGenderFilter] = useState('all')
  // Default to 'all' so abandoned / migrated / deceased students are visible,
  // exactly like the teachers page (cf. PERSON_STATUS_FILTER_OPTIONS).
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Pagination state
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalStudents, setTotalStudents] = useState(0)
  const PAGE_SIZE = 10

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null)
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null)
  const [form, setForm] = useState<StudentFormData>(emptyForm)
  const [imageField, setImageField] = useState<string | null>(null)

  // ---------- Data Fetching ----------

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      // Send search term to API (searches all columns: name, class, gender, email, phone, address, etc.)
      // If gender filter is active, use it as the search term so API matches it
      if (search) {
        params.set('search', search)
      } else if (genderFilter && genderFilter !== 'all') {
        // When only gender filter is active (no text search), search by gender label
        // The API will map "Masculin"/"Féminin" to M/F automatically
        const genderLabel = GENDER_LABELS[genderFilter] || genderFilter
        params.set('search', genderLabel)
      }
      if (classFilter && classFilter !== 'all') params.set('classId', classFilter)
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))
      const res = await fetch(withSchoolYear(`/api/students?${params.toString()}`, schoolYear))
      const data = await res.json()
      let result = data.students || []

      // If both search and gender filter are active, filter gender client-side
      if (search && genderFilter && genderFilter !== 'all') {
        result = result.filter((s: Student) => s.gender === genderFilter)
      }

      setStudents(result)
      // Update pagination info from API
      const pag = data.pagination
      if (pag) {
        setTotalPages(pag.totalPages)
        setTotalStudents(pag.total)
      }
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les élèves')
    } finally {
      setLoading(false)
    }
  }, [search, classFilter, genderFilter, statusFilter, page, schoolYear, addToast])

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch(withSchoolYear('/api/classes', schoolYear))
      const data = await res.json()
      setClasses(data.classes || [])
    } catch {
      // Silent fail for dropdown data
    }
  }, [schoolYear])

  // Reset page when search or filters change
  useEffect(() => {
    setPage(1)
  }, [search, classFilter, genderFilter, statusFilter])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  useEffect(() => {
    fetchClasses()
  }, [fetchClasses])

  // ---------- Handlers ----------

  const openAddForm = () => {
    setEditingStudent(null)
    setForm(emptyForm)
    setImageField(null)
    setFormOpen(true)
  }

  const openEditForm = (student: Student) => {
    setEditingStudent(student)
    setForm({
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.user?.email || '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '',
      gender: student.gender || '',
      status: student.status || 'active',
      statusDate: student.statusDate || '',
      address: student.address || '',
      classId: student.classId || '',
      parentContact: student.parentContact || '',
      parentPhone: student.parentPhone || '',
      phone: student.user?.phone || '',
    })
    setImageField(student.image || null)
    setFormOpen(true)
  }

  const openDetail = (student: Student) => {
    setViewingStudent(student)
    setDetailOpen(true)
  }

  const openDelete = (student: Student) => {
    setDeletingStudent(student)
    setDeleteOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName) {
      addToast('error', 'Erreur', 'Prénom et nom sont requis')
      return
    }

    try {
      setSubmitting(true)

      if (editingStudent) {
        const res = await fetch(`/api/students/${editingStudent.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': currentUser?.role || '',
            'x-institution-id': currentUser?.institutionId || '',
          },
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            dateOfBirth: form.dateOfBirth || undefined,
            gender: form.gender || undefined,
            status: form.status,
            statusDate: form.statusDate || undefined,
            address: form.address || undefined,
            classId: form.classId || null,
            parentContact: form.parentContact || undefined,
            parentPhone: form.parentPhone || undefined,
            image: imageField,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erreur lors de la modification')
        }
        addToast('success', 'Élève modifié', `${form.firstName} ${form.lastName} a été modifié`)
      } else {
        const res = await fetch('/api/students', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': currentUser?.role || '',
            'x-institution-id': currentUser?.institutionId || '',
          },
          body: JSON.stringify({
            email: form.email || undefined,
            firstName: form.firstName,
            lastName: form.lastName,
            dateOfBirth: form.dateOfBirth || undefined,
            gender: form.gender || undefined,
            status: form.status,
            statusDate: form.statusDate || undefined,
            address: form.address || undefined,
            classId: form.classId || undefined,
            parentContact: form.parentContact || undefined,
            parentPhone: form.parentPhone || undefined,
            phone: form.phone || undefined,
            image: imageField,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Erreur lors de la création")
        }
        addToast('success', 'Élève ajouté', `${form.firstName} ${form.lastName} a été inscrit`)
      }

      // Détection d'un changement de statut lors d'une modification.
      // Si le nouveau statut ne correspond plus au filtre actuel (par ex. on passe
      // de "active" à "deceased" alors que le filtre est "Actifs uniquement"),
      // l'élève disparaîtrait du tableau. On bascule alors le filtre sur
      // "Tous les statuts" afin que l'utilisateur voie immédiatement la mise à jour.
      const previousStatus = editingStudent?.status || 'active'
      const newStatus = form.status || 'active'
      const statusChanged = !!editingStudent && newStatus !== previousStatus
      const newStatusVisibleWithFilter =
        statusFilter === 'all' || statusFilter === newStatus

      setFormOpen(false)
      setForm(emptyForm)
      setEditingStudent(null)
      setImageField(null)

      if (statusChanged && !newStatusVisibleWithFilter) {
        // Le useEffect surveillant statusFilter déclenchera fetchStudents.
        setStatusFilter('all')
      } else {
        fetchStudents()
      }

      // Notify the rest of the app that a student's photo may have changed,
      // so any component displaying it (this list, the detail view, other
      // modules) re-fetches a cache-busted copy.
      notifyAvatarChanged({ role: 'student' })
    } catch (err) {
      addToast('error', 'Erreur', err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingStudent) return
    try {
      const res = await fetch(`/api/students/${deletingStudent.id}`, {
        method: 'DELETE',
        headers: { 'x-user-role': currentUser?.role || '' },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la suppression')
      }
      addToast('success', 'Élève supprimé', `${deletingStudent.firstName} ${deletingStudent.lastName} a été supprimé`)
      setDeleteOpen(false)
      setDeletingStudent(null)
      fetchStudents()
    } catch (err) {
      addToast('error', 'Erreur', err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const updateForm = (field: keyof StudentFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleStatusChange = async (student: Student, newStatus: PersonStatus) => {
    if (student.status === newStatus) return
    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role || '',
          'x-institution-id': currentUser?.institutionId || '',
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors du changement de statut')
      }
      addToast('success', 'Statut mis à jour', `${student.firstName} ${student.lastName} est maintenant ${PERSON_STATUS_LABELS[newStatus]}`)

      // Si le nouveau statut ne correspond plus au filtre actuel (par ex. filtre
      // "Actifs uniquement" mais l'élève passe à "Décédé"), l'élève disparaîtrait
      // du tableau. On bascule sur "Tous les statuts" pour qu'il reste visible
      // avec son nouveau badge.
      const newStatusVisibleWithFilter =
        statusFilter === 'all' || statusFilter === newStatus
      if (!newStatusVisibleWithFilter) {
        // Le useEffect surveillant statusFilter déclenchera fetchStudents.
        setStatusFilter('all')
      } else {
        fetchStudents()
      }
    } catch (err) {
      addToast('error', 'Erreur', err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  // ---------- Export Helpers ----------

  const getClassName = (classId: string | null) => {
    if (!classId) return '—'
    const cls = classes.find((c) => c.id === classId)
    return cls ? cls.name : '—'
  }

  /** Fetch ALL students matching current filters (no pagination) for export */
  const fetchAllForExport = useCallback(async (): Promise<Student[]> => {
    try {
      const params = new URLSearchParams()
      if (search) {
        params.set('search', search)
      } else if (genderFilter && genderFilter !== 'all') {
        const genderLabel = GENDER_LABELS[genderFilter] || genderFilter
        params.set('search', genderLabel)
      }
      if (classFilter && classFilter !== 'all') params.set('classId', classFilter)
      if (statusFilter) params.set('status', statusFilter)
      params.set('limit', '9999')
      const res = await fetch(withSchoolYear(`/api/students?${params.toString()}`, schoolYear))
      const data = await res.json()
      let result: Student[] = data.students || []
      if (search && genderFilter && genderFilter !== 'all') {
        result = result.filter((s: Student) => s.gender === genderFilter)
      }
      return result
    } catch {
      addToast('error', 'Erreur', 'Impossible de récupérer les données pour l\'export')
      return []
    }
  }, [search, classFilter, genderFilter, statusFilter, schoolYear, addToast])

  const [exporting, setExporting] = useState(false)

  /** Export to Excel (.xlsx) */
  const exportToExcel = async () => {
    setExporting(true)
    try {
      const data = await fetchAllForExport()
      if (data.length === 0) {
        addToast('error', 'Erreur', 'Aucune donnée à exporter')
        return
      }
      const rows = data.map((s, i) => ({
        'N°': i + 1,
        'ID Élève': s.user?.userCode || '',
        'Nom': s.lastName,
        'Prénom': s.firstName,
        'Email': s.user?.email || '',
        'Téléphone': s.user?.phone || '',
        'Classe': getClassName(s.classId),
        'Genre': s.gender ? (GENDER_LABELS[s.gender] || s.gender) : '',
        'Statut': PERSON_STATUS_LABELS[s.status] || 'Actif',
        'Date de constat': s.statusDate ? new Date(s.statusDate).toLocaleDateString('fr-FR') : '',
        'Date de naissance': s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('fr-FR') : '',
        'Adresse': s.address || '',
        'Contact Parent': s.parentContact || '',
        'Tél. Parent': s.parentPhone || '',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      // Auto-size columns
      const colWidths = Object.keys(rows[0]).map((key) => ({
        wch: Math.max(key.length, ...rows.map((r) => String(r[key as keyof typeof r] || '').length)) + 2,
      }))
      ws['!cols'] = colWidths
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Élèves')
      const fileName = `eleves_${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, fileName)
      addToast('success', 'Export Excel', `${data.length} élèves exportés avec succès`)
    } catch {
      addToast('error', 'Erreur', "Erreur lors de l'export Excel")
    } finally {
      setExporting(false)
    }
  }

  /** Export to PDF */
  const exportToPDF = async () => {
    setExporting(true)
    try {
      const data = await fetchAllForExport()
      if (data.length === 0) {
        addToast('error', 'Erreur', 'Aucune donnée à exporter')
        return
      }
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      // Title
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Liste des Élèves', 14, 15)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${data.length} élève(s)`, 14, 22)

      // Filters info
      const filterParts: string[] = []
      if (search) filterParts.push(`Recherche: "${search}"`)
      if (classFilter !== 'all') {
        const cls = classes.find((c) => c.id === classFilter)
        if (cls) filterParts.push(`Classe: ${cls.name}`)
      }
      if (genderFilter !== 'all') filterParts.push(`Genre: ${GENDER_LABELS[genderFilter]}`)
      if (statusFilter && statusFilter !== 'all') {
        const statusOpt = PERSON_STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)
        if (statusOpt) filterParts.push(`Statut: ${statusOpt.label}`)
      }
      if (filterParts.length > 0) {
        doc.setFontSize(9)
        doc.setTextColor(100)
        doc.text(`Filtres: ${filterParts.join(' | ')}`, 14, 28)
        doc.setTextColor(0)
      }

      const tableData = data.map((s, i) => [
        i + 1,
        s.user?.userCode || '',
        s.lastName,
        s.firstName,
        s.user?.email || '',
        s.user?.phone || '',
        getClassName(s.classId),
        s.gender ? (GENDER_LABELS[s.gender] || s.gender) : '',
        PERSON_STATUS_LABELS[s.status] || 'Actif',
        s.statusDate ? new Date(s.statusDate).toLocaleDateString('fr-FR') : '',
        s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('fr-FR') : '',
        s.parentContact || '',
        s.parentPhone || '',
      ])

      autoTable(doc, {
        startY: filterParts.length > 0 ? 32 : 26,
        head: [['#', 'ID Élève', 'Nom', 'Prénom', 'Email', 'Tél', 'Classe', 'Genre', 'Statut', 'Date constat', 'Date naiss.', 'Contact Parent', 'Tél. Parent']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 18 },
          6: { cellWidth: 20 },
          7: { cellWidth: 18 },
          8: { cellWidth: 20 },
          9: { cellWidth: 22 },
          10: { cellWidth: 22 },
        },
      })

      const fileName = `eleves_${new Date().toISOString().slice(0, 10)}.pdf`
      doc.save(fileName)
      addToast('success', 'Export PDF', `${data.length} élèves exportés avec succès`)
    } catch {
      addToast('error', 'Erreur', "Erreur lors de l'export PDF")
    } finally {
      setExporting(false)
    }
  }

  /** Print current results */
  const handlePrint = async () => {
    setExporting(true)
    try {
      const data = await fetchAllForExport()
      if (data.length === 0) {
        addToast('error', 'Erreur', 'Aucune donnée à imprimer')
        return
      }
      const filterParts: string[] = []
      if (search) filterParts.push(`Recherche: "${search}"`)
      if (classFilter !== 'all') {
        const cls = classes.find((c) => c.id === classFilter)
        if (cls) filterParts.push(`Classe: ${cls.name}`)
      }
      if (genderFilter !== 'all') filterParts.push(`Genre: ${GENDER_LABELS[genderFilter]}`)
      if (statusFilter && statusFilter !== 'all') {
        const statusOpt = PERSON_STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)
        if (statusOpt) filterParts.push(`Statut: ${statusOpt.label}`)
      }

      const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Liste des Élèves</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #1a1a1a; }
            h1 { font-size: 20px; margin-bottom: 4px; color: #059669; }
            .subtitle { font-size: 12px; color: #666; margin-bottom: 8px; }
            .filters { font-size: 11px; color: #888; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #059669; color: white; padding: 8px 6px; text-align: left; font-weight: 600; }
            td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
            tr:nth-child(even) td { background: #f0fdf4; }
            tr:hover td { background: #d1fae5; }
            .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Liste des Élèves</h1>
          <p class="subtitle">Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${data.length} élève(s)</p>
          ${filterParts.length > 0 ? `<p class="filters">Filtres: ${filterParts.join(' | ')}</p>` : ''}
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>ID Élève</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Email</th>
                <th>Tél</th>
                <th>Classe</th>
                <th>Genre</th>
                <th>Statut</th>
                <th>Date constat</th>
                <th>Date naiss.</th>
                <th>Contact Parent</th>
                <th>Tél. Parent</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((s, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${s.user?.userCode || ''}</td>
                  <td>${s.lastName}</td>
                  <td>${s.firstName}</td>
                  <td>${s.user?.email || ''}</td>
                  <td>${s.user?.phone || ''}</td>
                  <td>${getClassName(s.classId)}</td>
                  <td>${s.gender ? (GENDER_LABELS[s.gender] || s.gender) : ''}</td>
                  <td>${PERSON_STATUS_LABELS[s.status] || 'Actif'}</td>
                  <td>${s.statusDate ? new Date(s.statusDate).toLocaleDateString('fr-FR') : ''}</td>
                  <td>${s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('fr-FR') : ''}</td>
                  <td>${s.parentContact || ''}</td>
                  <td>${s.parentPhone || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p class="footer">MASOMO — Gestion Scolaire</p>
        </body>
        </html>
      `
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(printHtml)
        printWindow.document.close()
        printWindow.onload = () => {
          printWindow.print()
        }
      }
    } catch {
      addToast('error', 'Erreur', 'Erreur lors de l\'impression')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestion des Élèves</h1>
            <p className="text-sm text-muted-foreground">
              {totalStudents} élève{totalStudents !== 1 ? 's' : ''} inscrit{totalStudents !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exporter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToExcel} disabled={exporting}>
                <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
                Exporter en Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF} disabled={exporting}>
                <FileText className="mr-2 h-4 w-4 text-red-500" />
                Exporter en PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint} disabled={exporting}>
                <Printer className="mr-2 h-4 w-4 text-muted-foreground" />
                Imprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isAdmin && (
            <Button onClick={openAddForm} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un élève
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher sur toutes les colonnes (nom, prénom, classe, genre, email, téléphone, adresse...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {(search || classFilter !== 'all' || genderFilter !== 'all' || statusFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('')
                    setClassFilter('all')
                    setGenderFilter('all')
                    setStatusFilter('all')
                  }}
                  className="gap-1 text-muted-foreground shrink-0"
                >
                  <X className="h-3 w-3" />
                  Réinitialiser
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Toutes les classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les classes</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Tous les genres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les genres</SelectItem>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  {PERSON_STATUS_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && students.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Aucun élève trouvé</h3>
            <p className="mt-1 text-sm text-muted-foreground text-center">
              {search || classFilter !== 'all' || genderFilter !== 'all' || statusFilter !== 'all'
                ? 'Aucun élève ne correspond à vos critères de recherche.'
                : isAdmin
                  ? 'Commencez par ajouter votre premier élève.'
                  : 'Aucun élève inscrit pour le moment.'}
            </p>
            {isAdmin && !search && classFilter === 'all' && genderFilter === 'all' && statusFilter === 'all' && (
              <Button onClick={openAddForm} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                <Plus className="h-4 w-4" />
                Ajouter un élève
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Desktop Table */}
      {!loading && students.length > 0 && (
        <>
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Photo</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Prénom</TableHead>
                      <TableHead>Classe</TableHead>
                      <TableHead>Genre</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Contact Parent</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {students.map((student) => (
                        <motion.tr
                          key={student.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="border-b transition-colors hover:bg-muted/50"
                        >
                          <TableCell>
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={getImageUrl(student.image, student.updatedAt)} alt={`${student.firstName} ${student.lastName}`} />
                              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                {student.firstName[0]}{student.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{student.lastName}</TableCell>
                          <TableCell>{student.firstName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {getClassName(student.classId)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                student.gender === 'F'
                                  ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
                                  : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                              }
                            >
                              {student.gender ? GENDER_LABELS[student.gender] || student.gender : '—'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className={`text-xs ${PERSON_STATUS_BADGE_CLASSES[student.status] || PERSON_STATUS_BADGE_CLASSES.active}`}>
                                {PERSON_STATUS_LABELS[student.status] || 'Actif'}
                              </Badge>
                              {student.status && student.status !== 'active' && student.statusDate && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                                  <CalendarClock className="h-3 w-3 text-rose-500" />
                                  {new Date(student.statusDate).toLocaleDateString('fr-FR')}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{student.parentContact || '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openDetail(student)} title="Voir">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {isAdmin && (
                                <Button variant="ghost" size="icon" onClick={() => openEditForm(student)} title="Modifier">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openDelete(student)}
                                  title="Supprimer"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                              {isAdmin && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" title="Changer le statut">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Statut</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {PERSON_STATUSES.map((s) => (
                                      <DropdownMenuItem
                                        key={s.value}
                                        onClick={() => handleStatusChange(student, s.value as PersonStatus)}
                                        className={student.status === s.value ? 'font-semibold' : ''}
                                      >
                                        {s.label}
                                        {student.status === s.value && ' ✓'}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden space-y-3">
            <AnimatePresence>
              {students.map((student) => (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={getImageUrl(student.image, student.updatedAt)} alt={`${student.firstName} ${student.lastName}`} />
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                              {student.firstName[0]}{student.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {getClassName(student.classId)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            variant="secondary"
                            className={
                              student.gender === 'F'
                                ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
                                : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                            }
                          >
                            {student.gender ? GENDER_LABELS[student.gender] || student.gender : '—'}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${PERSON_STATUS_BADGE_CLASSES[student.status] || PERSON_STATUS_BADGE_CLASSES.active}`}>
                            {PERSON_STATUS_LABELS[student.status] || 'Actif'}
                          </Badge>
                          {student.status && student.status !== 'active' && student.statusDate && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                              <CalendarClock className="h-3 w-3 text-rose-500" />
                              {new Date(student.statusDate).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </div>
                      </div>
                      {student.parentContact && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          📞 {student.parentContact}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openDetail(student)} className="gap-1">
                          <Eye className="h-3 w-3" />
                          Voir
                        </Button>
                        {isAdmin && (
                          <Button variant="outline" size="sm" onClick={() => openEditForm(student)} className="gap-1">
                            <Pencil className="h-3 w-3" />
                            Modifier
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDelete(student)}
                            className="gap-1 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                            Supprimer
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Affichage de {((page - 1) * PAGE_SIZE) + 1} à {Math.min(page * PAGE_SIZE, totalStudents)} sur {totalStudents} élèves
              </p>
              <PaginationNav>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {generatePageNumbers(page, totalPages).map((p, i) =>
                    p === 'ellipsis' ? (
                      <PaginationItem key={`ellipsis-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={p === page}
                          onClick={() => setPage(p as number)}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </PaginationNav>
            </div>
          )}
        </>
      )}

      {/* ===== Add/Edit Student Dialog ===== */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStudent ? 'Modifier l\'élève' : 'Ajouter un élève'}
            </DialogTitle>
            <DialogDescription>
              {editingStudent
                ? 'Modifiez les informations de l\'élève ci-dessous.'
                : 'Remplissez les informations pour inscrire un nouvel élève.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Photo upload */}
            <div className="space-y-2">
              <Label>Photo de l'élève</Label>
              <ImageDropZone
                currentImage={imageField}
                fallbackInitials={form.firstName && form.lastName ? `${form.firstName[0]}${form.lastName[0]}` : undefined}
                onImageUploaded={(url) => setImageField(url)}
                onImageRemoved={() => setImageField(null)}
                folder="students"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => updateForm('firstName', e.target.value)}
                  placeholder="Prénom"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => updateForm('lastName', e.target.value)}
                  placeholder="Nom de famille"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  placeholder="eleve@ecole.com (optionnel)"
                  disabled={!!editingStudent}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                  placeholder="Numéro de téléphone"
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date de naissance</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => updateForm('dateOfBirth', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Genre</Label>
                <Select value={form.gender} onValueChange={(v) => updateForm('gender', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => updateForm('address', e.target.value)}
                placeholder="Adresse de l'élève"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Classe</Label>
                <Select value={form.classId} onValueChange={(v) => updateForm('classId', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner une classe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune classe</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} — {cls.level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-status">Statut</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => {
                    const newStatus = v as PersonStatus
                    // En passant en "active", on efface la date de constat.
                    // En passant en statut non-actif sans date, on pré-remplit avec la date du jour.
                    if (newStatus === 'active') {
                      setForm((prev) => ({ ...prev, status: newStatus, statusDate: '' }))
                    } else {
                      setForm((prev) => ({
                        ...prev,
                        status: newStatus,
                        statusDate: prev.statusDate || todayISO(),
                      }))
                    }
                  }}
                >
                  <SelectTrigger id="s-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSON_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date de constat du statut — visible uniquement pour un statut non-actif */}
            {form.status !== 'active' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="s-statusDate" className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-rose-500" />
                    {form.status === 'deceased' && 'Date du décès'}
                    {form.status === 'abandoned' && "Date d'abandon"}
                    {form.status === 'migrated' && 'Date de migration'}
                    <span className="text-xs font-normal text-muted-foreground">
                      (date à laquelle ce statut a été constaté)
                    </span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={`h-10 sm:w-[220px] justify-start text-left font-normal ${!form.statusDate ? 'text-muted-foreground' : ''}`}
                      >
                        <CalendarClock className="mr-2 h-4 w-4 shrink-0 text-rose-500" />
                        <span className="truncate">
                          {form.statusDate
                            ? format(new Date(form.statusDate + 'T00:00:00'), 'dd MMMM yyyy', { locale: fr })
                            : 'Choisir une date'}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="flex items-center justify-between px-3 pb-2 pt-3">
                        <span className="text-sm font-medium">
                          {form.statusDate
                            ? format(new Date(form.statusDate + 'T00:00:00'), 'dd MMMM yyyy', { locale: fr })
                            : 'Aucune date sélectionnée'}
                        </span>
                        {form.statusDate && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => updateForm('statusDate', '')}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Effacer
                          </Button>
                        )}
                      </div>
                      <CalendarPicker
                        mode="single"
                        selected={form.statusDate ? new Date(form.statusDate + 'T00:00:00') : undefined}
                        onSelect={(date) => updateForm('statusDate', date ? format(date, 'yyyy-MM-dd') : '')}
                        disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                        locale={fr}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parentContact">Contact parent</Label>
                <Input
                  id="parentContact"
                  value={form.parentContact}
                  onChange={(e) => updateForm('parentContact', e.target.value)}
                  placeholder="Nom du parent/tuteur"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentPhone">Téléphone parent</Label>
                <Input
                  id="parentPhone"
                  value={form.parentPhone}
                  onChange={(e) => updateForm('parentPhone', e.target.value)}
                  placeholder="+243 6XX XXX XXX"
                />
              </div>
            </div>

            {!editingStudent && (
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone élève</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                  placeholder="+243 6XX XXX XXX"
                />
              </div>
            )}
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
              {editingStudent ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Student Detail Dialog ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Détails de l&apos;élève</DialogTitle>
          </DialogHeader>
          {viewingStudent && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4">
                {/* Avatar & Name */}
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={getImageUrl(viewingStudent.image, viewingStudent.updatedAt)} alt={`${viewingStudent.firstName} ${viewingStudent.lastName}`} />
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-2xl font-bold">
                      {viewingStudent.firstName[0]}{viewingStudent.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">
                      {viewingStudent.firstName} {viewingStudent.lastName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{getClassName(viewingStudent.classId)}</Badge>
                      <Badge variant="outline" className={`text-xs ${PERSON_STATUS_BADGE_CLASSES[viewingStudent.status] || PERSON_STATUS_BADGE_CLASSES.active}`}>
                        {PERSON_STATUS_LABELS[viewingStudent.status] || 'Actif'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Info Grid */}
                <div className="grid gap-3">
                  {viewingStudent.user?.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{viewingStudent.user.email}</span>
                    </div>
                  )}
                  {viewingStudent.dateOfBirth && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Né(e) le {new Date(viewingStudent.dateOfBirth).toLocaleDateString('fr-FR')}</span>
                    </div>
                  )}
                  {viewingStudent.gender && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{GENDER_LABELS[viewingStudent.gender] || viewingStudent.gender}</span>
                    </div>
                  )}
                  {viewingStudent.address && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{viewingStudent.address}</span>
                    </div>
                  )}
                  {viewingStudent.parentContact && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Parent : {viewingStudent.parentContact}</span>
                    </div>
                  )}
                  {viewingStudent.parentPhone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>Tél. parent : {viewingStudent.parentPhone}</span>
                    </div>
                  )}
                  {viewingStudent.status && viewingStudent.status !== 'active' && viewingStudent.statusDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarClock className="h-4 w-4 text-rose-500" />
                      <span>
                        {viewingStudent.status === 'deceased' && 'Décès constaté le'}
                        {viewingStudent.status === 'abandoned' && 'Abandon constaté le'}
                        {viewingStudent.status === 'migrated' && 'Migration constatée le'}
                        {' '}{new Date(viewingStudent.statusDate).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">
                      {viewingStudent.grades?.length ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Notes</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">
                      {viewingStudent.attendances?.length ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Présences</p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirmation Dialog ===== */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l&apos;élève{' '}
              <strong>
                {deletingStudent?.firstName} {deletingStudent?.lastName}
              </strong>
              {' '}? Cette action est irréversible et supprimera toutes les données associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingStudent(null)}>Annuler</AlertDialogCancel>
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
