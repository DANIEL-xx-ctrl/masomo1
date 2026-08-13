'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Phone,
  Mail,
  BookOpen,
  Award,
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
import type { Teacher, ClassTeacher, Schedule, PersonStatus } from '@/lib/types'
import {
  DAY_LABELS,
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
import ImageDropZone from '@/components/image-dropzone'
import { getImageUrl } from '@/lib/utils'
import { notifyAvatarChanged } from '@/hooks/use-avatar-refresh'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
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

interface TeacherFormData {
  firstName: string
  lastName: string
  email: string
  subject: string
  phone: string
  qualification: string
  gender: string
  hireDate: string
  status: PersonStatus
  statusDate: string
}

const todayISO = () => new Date().toISOString().split('T')[0]

const emptyForm: TeacherFormData = {
  firstName: '',
  lastName: '',
  email: '',
  subject: '',
  phone: '',
  qualification: '',
  gender: '',
  hireDate: todayISO(),
  status: 'active' as PersonStatus,
  statusDate: '',
}

interface TeacherDetail {
  id: string
  userId: string
  firstName: string
  lastName: string
  subject: string
  phone: string | null
  qualification: string | null
  hireDate: string
  image: string | null
  status?: PersonStatus
  statusDate?: string | null
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    email: string
    phone: string | null
    active: boolean
  }
  classes?: ClassTeacher[]
  schedules?: Schedule[]
}

// ---------- Helpers ----------

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

export default function TeachersModule() {
  const addToast = useAppStore((s) => s.addToast)
  const currentUser = useAppStore((s) => s.currentUser)
  const schoolYear = useAppStore((s) => s.schoolYear)
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  // Data state
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filter state
  const [search, setSearch] = useState('')
  const [hireDateFrom, setHireDateFrom] = useState('')
  const [hireDateTo, setHireDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Pagination state
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalTeachers, setTotalTeachers] = useState(0)
  const PAGE_SIZE = 10

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [viewingTeacher, setViewingTeacher] = useState<TeacherDetail | null>(null)
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null)
  const [form, setForm] = useState<TeacherFormData>(emptyForm)
  const [imageField, setImageField] = useState<string | null>(null)

  // ---------- Data Fetching ----------

  const fetchTeachers = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (hireDateFrom) params.set('hireDateFrom', hireDateFrom)
      if (hireDateTo) params.set('hireDateTo', hireDateTo)
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))
      const res = await fetch(withSchoolYear(`/api/teachers?${params.toString()}`, schoolYear))
      const data = await res.json()
      setTeachers(data.teachers || [])
      const pag = data.pagination
      if (pag) {
        setTotalPages(pag.totalPages)
        setTotalTeachers(pag.total)
      }
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les enseignants')
    } finally {
      setLoading(false)
    }
  }, [search, hireDateFrom, hireDateTo, statusFilter, page, schoolYear, addToast])

  // Reset page when search or date filters change
  useEffect(() => {
    setPage(1)
  }, [search, hireDateFrom, hireDateTo, statusFilter])

  useEffect(() => {
    fetchTeachers()
  }, [fetchTeachers])

  // ---------- Handlers ----------

  const openAddForm = () => {
    setEditingTeacher(null)
    setForm({ ...emptyForm, hireDate: todayISO() })
    setImageField(null)
    setFormOpen(true)
  }

  const openEditForm = (teacher: Teacher) => {
    setEditingTeacher(teacher)
    setForm({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.user?.email || '',
      password: '',
      subject: teacher.subject,
      phone: teacher.phone || '',
      qualification: teacher.qualification || '',
      gender: '',
      hireDate: teacher.hireDate || todayISO(),
      status: teacher.status || 'active',
      statusDate: teacher.statusDate || '',
    })
    setImageField(teacher.image || null)
    setFormOpen(true)
  }

  const openDetail = async (teacher: Teacher) => {
    try {
      const res = await fetch(`/api/teachers/${teacher.id}`)
      const data = await res.json()
      setViewingTeacher(data.teacher || teacher)
      setDetailOpen(true)
    } catch {
      setViewingTeacher(teacher as unknown as TeacherDetail)
      setDetailOpen(true)
    }
  }

  const openDelete = (teacher: Teacher) => {
    setDeletingTeacher(teacher)
    setDeleteOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName) {
      addToast('error', 'Erreur', 'Prénom et nom sont requis')
      return
    }

    if (!editingTeacher && !form.subject) {
      addToast('error', 'Erreur', 'La matière est requise')
      return
    }

    try {
      setSubmitting(true)

      if (editingTeacher) {
        const res = await fetch(`/api/teachers/${editingTeacher.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': currentUser?.role || '',
            'x-institution-id': currentUser?.institutionId || '',
          },
          body: JSON.stringify({
            email: form.email || undefined,
            firstName: form.firstName,
            lastName: form.lastName,
            subject: form.subject,
            phone: form.phone || undefined,
            qualification: form.qualification || undefined,
            hireDate: form.hireDate || undefined,
            image: imageField,
            status: form.status,
            statusDate: form.statusDate || undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erreur lors de la modification')
        }
        addToast('success', 'Enseignant modifié', `${form.firstName} ${form.lastName} a été modifié`)
      } else {
        const res = await fetch('/api/teachers', {
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
            subject: form.subject,
            phone: form.phone || undefined,
            qualification: form.qualification || undefined,
            hireDate: form.hireDate || undefined,
            image: imageField,
            status: form.status,
            statusDate: form.statusDate || undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Erreur lors de la création")
        }
        addToast('success', 'Enseignant ajouté', `${form.firstName} ${form.lastName} a été ajouté`)
      }

      // Détection d'un changement de statut lors d'une modification.
      // Si le nouveau statut ne correspond plus au filtre actuel (par ex. on passe
      // de "active" à "deceased" alors que le filtre est "Actifs uniquement"),
      // l'enseignant disparaîtrait du tableau. On bascule alors le filtre sur
      // "Tous les statuts" afin que l'utilisateur voie immédiatement la mise à jour.
      const previousStatus = editingTeacher?.status || 'active'
      const newStatus = form.status || 'active'
      const statusChanged = !!editingTeacher && newStatus !== previousStatus
      const newStatusVisibleWithFilter =
        statusFilter === 'all' || statusFilter === newStatus

      setFormOpen(false)
      setForm(emptyForm)
      setEditingTeacher(null)
      setImageField(null)

      if (statusChanged && !newStatusVisibleWithFilter) {
        // Le useEffect surveillant statusFilter déclenchera fetchTeachers.
        setStatusFilter('all')
      } else {
        fetchTeachers()
      }

      // Notify the rest of the app that a teacher's photo may have changed.
      notifyAvatarChanged({ role: 'teacher' })
    } catch (err) {
      addToast('error', 'Erreur', err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingTeacher) return
    try {
      const res = await fetch(`/api/teachers/${deletingTeacher.id}`, {
        method: 'DELETE',
        headers: { 'x-user-role': currentUser?.role || '' },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la suppression')
      }
      addToast('success', 'Enseignant supprimé', `${deletingTeacher.firstName} ${deletingTeacher.lastName} a été supprimé`)
      setDeleteOpen(false)
      setDeletingTeacher(null)
      fetchTeachers()
    } catch (err) {
      addToast('error', 'Erreur', err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const handleStatusChange = async (teacher: Teacher, newStatus: PersonStatus) => {
    if (teacher.status === newStatus) return
    try {
      const res = await fetch(`/api/teachers/${teacher.id}`, {
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
      addToast('success', 'Statut mis à jour', `${teacher.firstName} ${teacher.lastName} est maintenant ${PERSON_STATUS_LABELS[newStatus]}`)

      // Si le nouveau statut ne correspond plus au filtre actuel (par ex. filtre
      // "Actifs uniquement" mais l'enseignant passe à "Décédé"), l'enseignant
      // disparaîtrait du tableau. On bascule sur "Tous les statuts" pour qu'il
      // reste visible avec son nouveau badge.
      const newStatusVisibleWithFilter =
        statusFilter === 'all' || statusFilter === newStatus
      if (!newStatusVisibleWithFilter) {
        // Le useEffect surveillant statusFilter déclenchera fetchTeachers.
        setStatusFilter('all')
      } else {
        fetchTeachers()
      }
    } catch (err) {
      addToast('error', 'Erreur', err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const updateForm = (field: keyof TeacherFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // ---------- Export Helpers ----------

  /** Fetch ALL teachers matching current search for export */
  const fetchAllForExport = useCallback(async (): Promise<Teacher[]> => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (hireDateFrom) params.set('hireDateFrom', hireDateFrom)
      if (hireDateTo) params.set('hireDateTo', hireDateTo)
      if (statusFilter) params.set('status', statusFilter)
      params.set('limit', '9999')
      const res = await fetch(withSchoolYear(`/api/teachers?${params.toString()}`, schoolYear))
      const data = await res.json()
      return data.teachers || []
    } catch {
      addToast('error', 'Erreur', 'Impossible de récupérer les données pour l\'export')
      return []
    }
  }, [search, hireDateFrom, hireDateTo, statusFilter, schoolYear, addToast])

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
      const rows = data.map((t, i) => ({
        'N°': i + 1,
        'ID Enseignant': t.user?.userCode || '',
        'Nom': t.lastName,
        'Prénom': t.firstName,
        'Email': t.user?.email || '',
        'Téléphone': t.phone || t.user?.phone || '',
        'Matière': t.subject,
        'Qualification': t.qualification || '',
        'Date recrutement': t.hireDate || '',
        'Statut': PERSON_STATUS_LABELS[t.status] || 'Actif',
        'Date de constat': t.statusDate || '',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const colWidths = Object.keys(rows[0]).map((key) => ({
        wch: Math.max(key.length, ...rows.map((r) => String(r[key as keyof typeof r] || '').length)) + 2,
      }))
      ws['!cols'] = colWidths
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Enseignants')
      const fileName = `enseignants_${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, fileName)
      addToast('success', 'Export Excel', `${data.length} enseignants exportés avec succès`)
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

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Liste des Enseignants', 14, 15)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${data.length} enseignant(s)`, 14, 22)

      const filterLines: string[] = []
      if (search) filterLines.push(`Recherche: "${search}"`)
      if (hireDateFrom || hireDateTo) {
        const fromLabel = hireDateFrom ? new Date(hireDateFrom).toLocaleDateString('fr-FR') : '…'
        const toLabel = hireDateTo ? new Date(hireDateTo).toLocaleDateString('fr-FR') : '…'
        filterLines.push(`Recrutement: du ${fromLabel} au ${toLabel}`)
      }
      filterLines.forEach((line, i) => {
        doc.setFontSize(9)
        doc.setTextColor(100)
        doc.text(line, 14, 28 + i * 5)
      })
      if (filterLines.length > 0) doc.setTextColor(0)

      const tableData = data.map((t, i) => [
        i + 1,
        t.user?.userCode || '',
        t.lastName,
        t.firstName,
        t.user?.email || '',
        t.phone || t.user?.phone || '',
        t.subject,
        t.qualification || '',
        t.hireDate || '',
        PERSON_STATUS_LABELS[t.status] || 'Actif',
        t.statusDate || '',
      ])

      autoTable(doc, {
        startY: filterLines.length > 0 ? 28 + filterLines.length * 5 + 2 : 26,
        head: [['#', 'ID Enseignant', 'Nom', 'Prénom', 'Email', 'Téléphone', 'Matière', 'Qualification', 'Date recrutement', 'Statut', 'Date constat']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [240, 253, 250] },
        margin: { left: 14, right: 14 },
      })

      const fileName = `enseignants_${new Date().toISOString().slice(0, 10)}.pdf`
      doc.save(fileName)
      addToast('success', 'Export PDF', `${data.length} enseignants exportés avec succès`)
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

      const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Liste des Enseignants</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #1a1a1a; }
            h1 { font-size: 20px; margin-bottom: 4px; color: #0d9488; }
            .subtitle { font-size: 12px; color: #666; margin-bottom: 8px; }
            .filters { font-size: 11px; color: #888; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #0d9488; color: white; padding: 8px 6px; text-align: left; font-weight: 600; }
            td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
            tr:nth-child(even) td { background: #f0fdfa; }
            .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Liste des Enseignants</h1>
          <p class="subtitle">Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${data.length} enseignant(s)</p>
          ${[
            search ? `<p class="filters">Recherche: "${search}"</p>` : '',
            (hireDateFrom || hireDateTo)
              ? `<p class="filters">Recrutement: du ${hireDateFrom ? new Date(hireDateFrom).toLocaleDateString('fr-FR') : '…'} au ${hireDateTo ? new Date(hireDateTo).toLocaleDateString('fr-FR') : '…'}</p>`
              : '',
          ].join('')}
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>ID Enseignant</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Matière</th>
                <th>Qualification</th>
                <th>Date recrutement</th>
                <th>Statut</th>
                <th>Date constat</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((t, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${t.user?.userCode || ''}</td>
                  <td>${t.lastName}</td>
                  <td>${t.firstName}</td>
                  <td>${t.user?.email || ''}</td>
                  <td>${t.phone || t.user?.phone || ''}</td>
                  <td>${t.subject}</td>
                  <td>${t.qualification || ''}</td>
                  <td>${t.hireDate ? new Date(t.hireDate).toLocaleDateString('fr-FR') : ''}</td>
                  <td>${PERSON_STATUS_LABELS[t.status] || 'Actif'}</td>
                  <td>${t.statusDate ? new Date(t.statusDate).toLocaleDateString('fr-FR') : ''}</td>
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

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestion des Enseignants</h1>
            <p className="text-sm text-muted-foreground">
              {totalTeachers} enseignant{totalTeachers !== 1 ? 's' : ''}
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
            <Button onClick={openAddForm} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un enseignant
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher sur toutes les colonnes (nom, prénom, matière, email, téléphone, qualification...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Hire date range filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  Recrutement
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="t-filter-from" className="text-[11px] text-muted-foreground">
                    Du
                  </Label>
                  <Input
                    id="t-filter-from"
                    type="date"
                    value={hireDateFrom}
                    onChange={(e) => setHireDateFrom(e.target.value)}
                    className="w-[160px] h-9 text-sm"
                  />
                </div>
                <span className="text-muted-foreground pb-2">—</span>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="t-filter-to" className="text-[11px] text-muted-foreground">
                    Au
                  </Label>
                  <Input
                    id="t-filter-to"
                    type="date"
                    value={hireDateTo}
                    onChange={(e) => setHireDateTo(e.target.value)}
                    className="w-[160px] h-9 text-sm"
                  />
                </div>
              </div>
            </div>
            {(search || hireDateFrom || hireDateTo || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setHireDateFrom('')
                  setHireDateTo('')
                  setStatusFilter('all')
                }}
                className="gap-1 text-muted-foreground shrink-0 sm:ml-auto"
              >
                <X className="h-3 w-3" />
                Réinitialiser
              </Button>
            )}
          </div>

          {/* Status filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Statut
              </span>
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); }}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                {PERSON_STATUS_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
      {!loading && teachers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Aucun enseignant trouvé</h3>
            <p className="mt-1 text-sm text-muted-foreground text-center">
              {(search || hireDateFrom || hireDateTo || statusFilter !== 'all')
                ? 'Aucun enseignant ne correspond à votre recherche.'
                : isAdmin
                  ? 'Commencez par ajouter votre premier enseignant.'
                  : 'Aucun enseignant enregistré pour le moment.'}
            </p>
            {!(search || hireDateFrom || hireDateTo || statusFilter !== 'all') && isAdmin && (
              <Button onClick={openAddForm} className="mt-4 bg-teal-600 hover:bg-teal-700 text-white gap-2">
                <Plus className="h-4 w-4" />
                Ajouter un enseignant
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Desktop Table */}
      {!loading && teachers.length > 0 && (
        <>
          <div className="hidden lg:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Photo</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Prénom</TableHead>
                      <TableHead>Matière</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Recrutement
                        </span>
                      </TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {teachers.map((teacher) => (
                        <motion.tr
                          key={teacher.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="border-b transition-colors hover:bg-muted/50"
                        >
                          <TableCell>
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={getImageUrl(teacher.image, teacher.updatedAt)} alt={`${teacher.firstName} ${teacher.lastName}`} />
                              <AvatarFallback className="bg-teal-100 text-teal-700 text-xs font-semibold">
                                {teacher.firstName[0]}{teacher.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{teacher.lastName}</TableCell>
                          <TableCell>{teacher.firstName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800">
                              {teacher.subject}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{teacher.phone || '—'}</TableCell>
                          <TableCell className="text-sm">{teacher.user?.email || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {teacher.hireDate
                              ? new Date(teacher.hireDate).toLocaleDateString('fr-FR')
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className={`text-xs ${PERSON_STATUS_BADGE_CLASSES[teacher.status] || PERSON_STATUS_BADGE_CLASSES.active}`}>
                                {PERSON_STATUS_LABELS[teacher.status] || 'Actif'}
                              </Badge>
                              {teacher.status && teacher.status !== 'active' && teacher.statusDate && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <CalendarClock className="h-3 w-3 text-rose-500" />
                                  {new Date(teacher.statusDate).toLocaleDateString('fr-FR')}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openDetail(teacher)} title="Voir">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {isAdmin && (
                                <Button variant="ghost" size="icon" onClick={() => openEditForm(teacher)} title="Modifier">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openDelete(teacher)}
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
                                        onClick={() => handleStatusChange(teacher, s.value as PersonStatus)}
                                        className={teacher.status === s.value ? 'font-semibold' : ''}
                                      >
                                        {s.label}
                                        {teacher.status === s.value && ' ✓'}
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

          {/* Mobile/Tablet Card Grid */}
          <div className="lg:hidden grid gap-4 sm:grid-cols-2">
            <AnimatePresence>
              {teachers.map((teacher) => (
                <motion.div
                  key={teacher.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="h-full">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage src={getImageUrl(teacher.image, teacher.updatedAt)} alt={`${teacher.firstName} ${teacher.lastName}`} />
                          <AvatarFallback className="bg-teal-100 text-teal-700 text-xs font-bold">
                            {teacher.firstName[0]}{teacher.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">
                            {teacher.firstName} {teacher.lastName}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800 text-xs"
                            >
                              {teacher.subject}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs ${PERSON_STATUS_BADGE_CLASSES[teacher.status] || PERSON_STATUS_BADGE_CLASSES.active}`}
                            >
                              {PERSON_STATUS_LABELS[teacher.status] || 'Actif'}
                            </Badge>
                            {teacher.status && teacher.status !== 'active' && teacher.statusDate && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                <CalendarClock className="h-3 w-3 text-rose-500" />
                                {new Date(teacher.statusDate).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        {teacher.user?.email && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{teacher.user.email}</span>
                          </div>
                        )}
                        {teacher.phone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{teacher.phone}</span>
                          </div>
                        )}
                        {teacher.hireDate && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>Recruté le {new Date(teacher.hireDate).toLocaleDateString('fr-FR')}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openDetail(teacher)} className="gap-1 flex-1">
                          <Eye className="h-3 w-3" />
                          Voir
                        </Button>
                        {isAdmin && (
                          <Button variant="outline" size="sm" onClick={() => openEditForm(teacher)} className="gap-1 flex-1">
                            <Pencil className="h-3 w-3" />
                            Modifier
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDelete(teacher)}
                            className="gap-1 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
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
                Affichage de {((page - 1) * PAGE_SIZE) + 1} à {Math.min(page * PAGE_SIZE, totalTeachers)} sur {totalTeachers} enseignants
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

      {/* ===== Add/Edit Teacher Dialog ===== */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTeacher ? "Modifier l'enseignant" : 'Ajouter un enseignant'}
            </DialogTitle>
            <DialogDescription>
              {editingTeacher
                ? "Modifiez les informations de l'enseignant ci-dessous."
                : 'Remplissez les informations pour ajouter un nouvel enseignant.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Photo upload */}
            <div className="space-y-2">
              <Label>Photo de l'enseignant</Label>
              <ImageDropZone
                currentImage={imageField}
                fallbackInitials={form.firstName && form.lastName ? `${form.firstName[0]}${form.lastName[0]}` : undefined}
                onImageUploaded={(url) => setImageField(url)}
                onImageRemoved={() => setImageField(null)}
                folder="teachers"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="t-firstName">Prénom *</Label>
                <Input
                  id="t-firstName"
                  value={form.firstName}
                  onChange={(e) => updateForm('firstName', e.target.value)}
                  placeholder="Prénom"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-lastName">Nom *</Label>
                <Input
                  id="t-lastName"
                  value={form.lastName}
                  onChange={(e) => updateForm('lastName', e.target.value)}
                  placeholder="Nom de famille"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="t-email">Email</Label>
                <Input
                  id="t-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  placeholder="enseignant@ecole.com (optionnel)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-phone">Téléphone</Label>
                <Input
                  id="t-phone"
                  value={form.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                  placeholder="+243 6XX XXX XXX"
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="t-subject">Matière *</Label>
                <Input
                  id="t-subject"
                  value={form.subject}
                  onChange={(e) => updateForm('subject', e.target.value)}
                  placeholder="Ex: Mathématiques"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-qualification">Qualification</Label>
                <Input
                  id="t-qualification"
                  value={form.qualification}
                  onChange={(e) => updateForm('qualification', e.target.value)}
                  placeholder="Ex: Licence, Master, Doctorat..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="t-status">Statut</Label>
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
                  <SelectTrigger id="t-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSON_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-hireDate">Date de recrutement</Label>
                <Input
                  id="t-hireDate"
                  type="date"
                  value={form.hireDate}
                  onChange={(e) => updateForm('hireDate', e.target.value)}
                  className="sm:w-[200px]"
                />
              </div>
            </div>

            {/* Date de constat du statut — visible uniquement pour un statut non-actif */}
            {form.status !== 'active' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="t-statusDate" className="flex items-center gap-2">
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingTeacher ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Teacher Detail Dialog ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Détails de l&apos;enseignant</DialogTitle>
          </DialogHeader>
          {viewingTeacher && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4">
                {/* Avatar & Name */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={getImageUrl(viewingTeacher.image)} alt={`${viewingTeacher.firstName} ${viewingTeacher.lastName}`} />
                    <AvatarFallback className="bg-teal-100 text-teal-700 text-2xl font-bold">
                      {viewingTeacher.firstName[0]}{viewingTeacher.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">
                      {viewingTeacher.firstName} {viewingTeacher.lastName}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800">
                        {viewingTeacher.subject}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${PERSON_STATUS_BADGE_CLASSES[viewingTeacher.status || 'active'] || PERSON_STATUS_BADGE_CLASSES.active}`}
                      >
                        {PERSON_STATUS_LABELS[viewingTeacher.status || 'active'] || 'Actif'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Info Grid */}
                <div className="grid gap-3">
                  {viewingTeacher.user?.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{viewingTeacher.user.email}</span>
                    </div>
                  )}
                  {viewingTeacher.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{viewingTeacher.phone}</span>
                    </div>
                  )}
                  {viewingTeacher.qualification && (
                    <div className="flex items-center gap-2 text-sm">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span>{viewingTeacher.qualification}</span>
                    </div>
                  )}
                  {viewingTeacher.hireDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Recruté le {new Date(viewingTeacher.hireDate).toLocaleDateString('fr-FR')}</span>
                    </div>
                  )}
                  {viewingTeacher.status && viewingTeacher.status !== 'active' && viewingTeacher.statusDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarClock className="h-4 w-4 text-rose-500" />
                      <span>
                        {viewingTeacher.status === 'deceased' && 'Décès constaté le'}
                        {viewingTeacher.status === 'abandoned' && 'Abandon constaté le'}
                        {viewingTeacher.status === 'migrated' && 'Migration constatée le'}
                        {' '}{new Date(viewingTeacher.statusDate).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Assigned Classes */}
                {viewingTeacher.classes && viewingTeacher.classes.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Classes assignées</h4>
                      <div className="flex flex-wrap gap-2">
                        {viewingTeacher.classes.map((ct: ClassTeacher) => (
                          <Badge key={ct.id} variant="secondary">
                            {ct.class?.name || 'Classe'} — {ct.subject}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Schedule Summary */}
                {viewingTeacher.schedules && viewingTeacher.schedules.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Emploi du temps</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                        {viewingTeacher.schedules.map((sch: Schedule) => (
                          <div
                            key={sch.id}
                            className="flex items-center justify-between rounded-md bg-muted/50 p-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-3 w-3 text-teal-600" />
                              <span className="font-medium">
                                {DAY_LABELS[sch.dayOfWeek] || `Jour ${sch.dayOfWeek}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span>{sch.startTime} - {sch.endTime}</span>
                              {sch.class && (
                                <Badge variant="outline" className="text-xs">
                                  {sch.class.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
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
              Êtes-vous sûr de vouloir supprimer l&apos;enseignant{' '}
              <strong>
                {deletingTeacher?.firstName} {deletingTeacher?.lastName}
              </strong>
              {' '}? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingTeacher(null)}>Annuler</AlertDialogCancel>
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
