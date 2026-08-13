'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Users,
  Phone,
  Mail,
  MapPin,
  X,
  Loader2,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  KeyRound,
  GraduationCap,
  Info,
  CalendarDays,
  School,
  ChevronDown,
  Check,
  UserCheck,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAppStore } from '@/lib/store'
import type { Parent, Student } from '@/lib/types'

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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import ImageDropZone from '@/components/image-dropzone'
import { getImageUrl, withSchoolYear } from '@/lib/utils'
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

interface ParentFormData {
  firstName: string
  lastName: string
  phone: string
  address: string
  email: string
  password: string
  image: string
  childrenIds: string[]
}

const emptyForm: ParentFormData = {
  firstName: '',
  lastName: '',
  phone: '',
  address: '',
  email: '',
  password: 'parent123',
  image: '',
  childrenIds: [],
}

/** Lightweight student info for the children picker */
interface StudentOption {
  id: string
  firstName: string
  lastName: string
  gender?: string | null
  className?: string | null
  level?: string | null
  section?: string | null
  currentParentId?: string | null
  currentParentName?: string | null
}

/** Extended Parent type with children computed from API */
interface ParentWithChildren extends Parent {
  children?: (Student & { class?: { name: string; schoolYear?: string } })[]
}

// ---------- Children List Component ----------

function ChildrenList({ children, compact = false }: { children: ParentWithChildren['children']; compact?: boolean }) {
  if (!children || children.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <GraduationCap className="w-5 h-5 mr-2 opacity-40" />
        <span className="text-sm italic">Aucun enfant associé</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {children.map((child) => {
        const initials = `${child.firstName[0]}${child.lastName[0]}`
        return (
          <div
            key={child.id}
            className={`flex items-center gap-3 rounded-lg border border-purple-100 dark:border-purple-900/50 bg-white dark:bg-gray-900 p-2.5 transition-colors hover:bg-purple-50/50 dark:hover:bg-purple-950/20 ${
              compact ? 'p-2' : ''
            }`}
          >
            <Avatar className={`${compact ? 'h-8 w-8' : 'h-10 w-10'} ring-2 ring-purple-100 dark:ring-purple-900/50`}>
              <AvatarImage src={getImageUrl(child.image)} alt={`${child.firstName} ${child.lastName}`} />
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate ${compact ? 'text-xs' : 'text-sm'}`}>
                {child.firstName} {child.lastName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {child.class && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <School className="w-3 h-3" />
                    {child.class.name}
                  </span>
                )}
                {child.class?.schoolYear && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CalendarDays className="w-3 h-3" />
                    {child.class.schoolYear}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {child.class && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800">
                  {child.class.name}
                </Badge>
              )}
              {child.class?.schoolYear && (
                <span className="text-[10px] text-muted-foreground">{child.class.schoolYear}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
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

/** Get children display text for a parent */
function getChildrenText(parent: ParentWithChildren): string {
  if (!parent.children || parent.children.length === 0) return '—'
  return parent.children.map((c) => `${c.firstName} ${c.lastName}`).join(', ')
}

/** Get children count badge */
function getChildrenCount(parent: ParentWithChildren): number {
  return parent.children?.length ?? 0
}

// ---------- Component ----------

export default function ParentsModule() {
  const addToast = useAppStore((s) => s.addToast)
  const currentUser = useAppStore((s) => s.currentUser)
  const schoolYear = useAppStore((s) => s.schoolYear)
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  // Data state
  const [parents, setParents] = useState<ParentWithChildren[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filter state
  const [search, setSearch] = useState('')

  // Pagination state
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalParents, setTotalParents] = useState(0)
  const PAGE_SIZE = 10

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingParent, setEditingParent] = useState<ParentWithChildren | null>(null)
  const [viewingParent, setViewingParent] = useState<ParentWithChildren | null>(null)
  const [deletingParent, setDeletingParent] = useState<ParentWithChildren | null>(null)
  const [form, setForm] = useState<ParentFormData>(emptyForm)
  const [imageField, setImageField] = useState<string | null>(null)
  // Available students (from institution) for the children picker
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([])
  const [studentOptionsLoading, setStudentOptionsLoading] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')

  // ---------- Data Fetching ----------

  const fetchParents = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))
      const res = await fetch(withSchoolYear(`/api/parents?${params.toString()}`, schoolYear))
      const data = await res.json()
      // API returns { parents: [...], pagination: { total, totalPages, ... } }
      const result = data.parents || data.data || []
      setParents(result)
      // Update pagination info from API
      const pag = data.pagination || data
      if (pag.total !== undefined) {
        setTotalPages(pag.totalPages || 1)
        setTotalParents(pag.total)
      }
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les parents')
    } finally {
      setLoading(false)
    }
  }, [search, page, addToast, schoolYear])

  // Reset page when search changes
  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    fetchParents()
  }, [fetchParents])

  // ---------- Handlers ----------

  /** Fetch all students of the current institution for the children picker.
   *  We fetch a large limit to get them all in one shot. */
  const fetchStudentOptions = useCallback(async () => {
    setStudentOptionsLoading(true)
    try {
      const res = await fetch(withSchoolYear('/api/students?limit=9999', schoolYear), {
        headers: {
          'x-user-id': currentUser?.id || '',
          'x-institution-id': currentUser?.institutionId || '',
          'x-user-role': currentUser?.role || '',
        },
      })
      const data = await res.json()
      const list = data.students || data.data || []
      const opts: StudentOption[] = list.map((s: Student & { class?: { name?: string; level?: string; section?: string | null } | null; parent?: { firstName?: string; lastName?: string } | null }) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        className: s.class?.name || null,
        level: s.class?.level || null,
        section: s.class?.section || null,
        currentParentId: (s as { parentId?: string | null }).parentId || null,
        currentParentName: s.parent ? `${s.parent.firstName ?? ''} ${s.parent.lastName ?? ''}`.trim() : null,
      }))
      setStudentOptions(opts)
    } catch {
      setStudentOptions([])
    } finally {
      setStudentOptionsLoading(false)
    }
  }, [schoolYear, currentUser])

  const openAddForm = () => {
    setEditingParent(null)
    setForm({ ...emptyForm, password: 'parent123' })
    setImageField(null)
    setStudentSearch('')
    fetchStudentOptions()
    setFormOpen(true)
  }

  const openEditForm = (parent: ParentWithChildren) => {
    setEditingParent(parent)
    setForm({
      firstName: parent.firstName,
      lastName: parent.lastName,
      phone: parent.phone || '',
      address: parent.address || '',
      email: parent.user?.email || '',
      password: '',
      image: '',
      // Pre-select the parent's current children
      childrenIds: (parent.children || []).map((c) => c.id),
    })
    setImageField(parent.image || null)
    setStudentSearch('')
    fetchStudentOptions()
    setFormOpen(true)
  }

  /** Toggle a student in the childrenIds list (a parent can have several children) */
  const toggleChild = (studentId: string) => {
    setForm((prev) => {
      const isSelected = prev.childrenIds.includes(studentId)
      return {
        ...prev,
        childrenIds: isSelected
          ? prev.childrenIds.filter((id) => id !== studentId)
          : [...prev.childrenIds, studentId],
      }
    })
  }

  const openDetail = (parent: ParentWithChildren) => {
    setViewingParent(parent)
    setDetailOpen(true)
  }

  const openDelete = (parent: ParentWithChildren) => {
    setDeletingParent(parent)
    setDeleteOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName) {
      addToast('error', 'Erreur', 'Prénom et nom sont requis')
      return
    }

    try {
      setSubmitting(true)

      if (editingParent) {
        const res = await fetch(`/api/parents/${editingParent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '', 'x-institution-id': currentUser?.institutionId || '', 'x-user-role': currentUser?.role || '' },
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone || undefined,
            address: form.address || undefined,
            image: imageField,
            childrenIds: form.childrenIds,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erreur lors de la modification')
        }
        addToast('success', 'Parent modifié', `${form.firstName} ${form.lastName} a été modifié${form.childrenIds.length > 0 ? ` (${form.childrenIds.length} enfant${form.childrenIds.length > 1 ? 's' : ''})` : ''}`)
      } else {
        const res = await fetch(withSchoolYear('/api/parents', schoolYear), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '', 'x-institution-id': currentUser?.institutionId || '', 'x-user-role': currentUser?.role || '' },
          body: JSON.stringify({
            email: form.email || undefined,
            password: form.password || undefined,
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone || undefined,
            address: form.address || undefined,
            image: imageField,
            childrenIds: form.childrenIds,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erreur lors de la création')
        }
        addToast('success', 'Parent ajouté', `${form.firstName} ${form.lastName} a été ajouté${form.childrenIds.length > 0 ? ` avec ${form.childrenIds.length} enfant${form.childrenIds.length > 1 ? 's' : ''} en charge` : ''}`)
      }

      setFormOpen(false)
      setForm(emptyForm)
      setEditingParent(null)
      setImageField(null)
      fetchParents()

      // Notify the rest of the app that a parent's photo may have changed.
      notifyAvatarChanged({ role: 'parent' })
    } catch (err) {
      addToast('error', 'Erreur', err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingParent) return
    try {
      const res = await fetch(`/api/parents/${deletingParent.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': currentUser?.id || '', 'x-institution-id': currentUser?.institutionId || '', 'x-user-role': currentUser?.role || '' },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la suppression')
      }
      addToast('success', 'Parent supprimé', `${deletingParent.firstName} ${deletingParent.lastName} a été supprimé`)
      setDeleteOpen(false)
      setDeletingParent(null)
      fetchParents()
    } catch (err) {
      addToast('error', 'Erreur', err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const updateForm = (field: keyof ParentFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // ---------- Export Helpers ----------

  /** Fetch ALL parents matching current filters (no pagination) for export */
  const fetchAllForExport = useCallback(async (): Promise<ParentWithChildren[]> => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('limit', '9999')
      const res = await fetch(withSchoolYear(`/api/parents?${params.toString()}`, schoolYear))
      const data = await res.json()
      return data.parents || data.data || []
    } catch {
      addToast('error', 'Erreur', 'Impossible de récupérer les données pour l\'export')
      return []
    }
  }, [search, addToast, schoolYear])

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
      const rows = data.map((p, i) => ({
        'N°': i + 1,
        'ID Parent': p.user?.userCode || '',
        'Nom': p.lastName,
        'Prénom': p.firstName,
        'Téléphone': p.phone || '',
        'Adresse': p.address || '',
        'Email': p.user?.email || '',
        'Enfants': getChildrenText(p),
        "Nombre d'enfants": getChildrenCount(p),
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      // Auto-size columns
      const colWidths = Object.keys(rows[0]).map((key) => ({
        wch: Math.max(key.length, ...rows.map((r) => String(r[key as keyof typeof r] || '').length)) + 2,
      }))
      ws['!cols'] = colWidths
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Parents')
      const fileName = `parents_${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, fileName)
      addToast('success', 'Export Excel', `${data.length} parents exportés avec succès`)
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
      doc.text('Liste des Parents', 14, 15)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${data.length} parent(s)`, 14, 22)

      // Filters info
      const filterParts: string[] = []
      if (search) filterParts.push(`Recherche: "${search}"`)
      if (filterParts.length > 0) {
        doc.setFontSize(9)
        doc.setTextColor(100)
        doc.text(`Filtres: ${filterParts.join(' | ')}`, 14, 28)
        doc.setTextColor(0)
      }

      const tableData = data.map((p, i) => [
        i + 1,
        p.user?.userCode || '',
        p.lastName,
        p.firstName,
        p.phone || '',
        p.address || '',
        p.user?.email || '',
        getChildrenText(p),
      ])

      autoTable(doc, {
        startY: filterParts.length > 0 ? 32 : 26,
        head: [['#', 'ID Parent', 'Nom', 'Prénom', 'Téléphone', 'Adresse', 'Email', 'Enfants']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [147, 51, 234], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [250, 245, 255] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 18 },
        },
      })

      const fileName = `parents_${new Date().toISOString().slice(0, 10)}.pdf`
      doc.save(fileName)
      addToast('success', 'Export PDF', `${data.length} parents exportés avec succès`)
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

      const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Liste des Parents</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #1a1a1a; }
            h1 { font-size: 20px; margin-bottom: 4px; color: #9333ea; }
            .subtitle { font-size: 12px; color: #666; margin-bottom: 8px; }
            .filters { font-size: 11px; color: #888; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #9333ea; color: white; padding: 8px 6px; text-align: left; font-weight: 600; }
            td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
            tr:nth-child(even) td { background: #faf5ff; }
            tr:hover td { background: #f3e8ff; }
            .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Liste des Parents</h1>
          <p class="subtitle">Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${data.length} parent(s)</p>
          ${filterParts.length > 0 ? `<p class="filters">Filtres: ${filterParts.join(' | ')}</p>` : ''}
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>ID Parent</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Téléphone</th>
                <th>Adresse</th>
                <th>Email</th>
                <th>Enfants</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((p, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${p.user?.userCode || ''}</td>
                  <td>${p.lastName}</td>
                  <td>${p.firstName}</td>
                  <td>${p.phone || ''}</td>
                  <td>${p.address || ''}</td>
                  <td>${p.user?.email || ''}</td>
                  <td>${getChildrenText(p)}</td>
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            <Heart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestion des Parents</h1>
            <p className="text-sm text-muted-foreground">
              {totalParents} parent{totalParents !== 1 ? 's' : ''} enregistré{totalParents !== 1 ? 's' : ''}
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
                <FileSpreadsheet className="mr-2 h-4 w-4 text-purple-600" />
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
            <Button onClick={openAddForm} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un parent
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher (nom, prénom, téléphone, adresse, email...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {search && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearch('')}
                className="gap-1 text-muted-foreground shrink-0"
              >
                <X className="h-3 w-3" />
                Réinitialiser
              </Button>
            )}
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
      {!loading && parents.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Aucun parent trouvé</h3>
            <p className="mt-1 text-sm text-muted-foreground text-center">
              {search
                ? 'Aucun parent ne correspond à vos critères de recherche.'
                : isAdmin
                  ? 'Commencez par ajouter votre premier parent.'
                  : 'Aucun parent enregistré pour le moment.'}
            </p>
            {isAdmin && !search && (
              <Button onClick={openAddForm} className="mt-4 bg-purple-600 hover:bg-purple-700 text-white gap-2">
                <Plus className="h-4 w-4" />
                Ajouter un parent
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Desktop Table */}
      {!loading && parents.length > 0 && (
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
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Adresse</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Enfants</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {parents.map((parent) => (
                        <motion.tr
                          key={parent.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="border-b transition-colors hover:bg-muted/50"
                        >
                          <TableCell>
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={getImageUrl(parent.image)} alt={`${parent.firstName} ${parent.lastName}`} />
                              <AvatarFallback className="bg-purple-100 text-purple-700 text-xs font-semibold">
                                {parent.firstName[0]}{parent.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{parent.lastName}</TableCell>
                          <TableCell>{parent.firstName}</TableCell>
                          <TableCell className="text-sm">{parent.phone || '—'}</TableCell>
                          <TableCell className="text-sm max-w-[150px] truncate">{parent.address || '—'}</TableCell>
                          <TableCell className="text-sm">{parent.user?.email || '—'}</TableCell>
                          <TableCell>
                            {getChildrenCount(parent) > 0 ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
                                  >
                                    <GraduationCap className="w-3.5 h-3.5" />
                                    {getChildrenCount(parent)} enfant{getChildrenCount(parent) > 1 ? 's' : ''}
                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-3" align="start">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Heart className="w-4 h-4 text-purple-600" />
                                    <span className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                                      Enfants de {parent.firstName} {parent.lastName}
                                    </span>
                                  </div>
                                  <ScrollArea className="max-h-64">
                                    <ChildrenList children={parent.children} compact />
                                  </ScrollArea>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openDetail(parent)} title="Voir">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {isAdmin && (
                                <Button variant="ghost" size="icon" onClick={() => openEditForm(parent)} title="Modifier">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openDelete(parent)}
                                  title="Supprimer"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
              {parents.map((parent) => (
                <motion.div
                  key={parent.id}
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
                            <AvatarImage src={getImageUrl(parent.image)} alt={`${parent.firstName} ${parent.lastName}`} />
                            <AvatarFallback className="bg-purple-100 text-purple-700 text-xs font-semibold">
                              {parent.firstName[0]}{parent.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {parent.firstName} {parent.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {parent.phone || 'Pas de téléphone'}
                            </p>
                          </div>
                        </div>
                        {getChildrenCount(parent) > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
                              >
                                <GraduationCap className="w-3.5 h-3.5" />
                                {getChildrenCount(parent)} enfant{getChildrenCount(parent) > 1 ? 's' : ''}
                                <ChevronDown className="w-3 h-3 opacity-50" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-3" align="end">
                              <div className="flex items-center gap-2 mb-3">
                                <Heart className="w-4 h-4 text-purple-600" />
                                <span className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                                  Enfants de {parent.firstName} {parent.lastName}
                                </span>
                              </div>
                              <ScrollArea className="max-h-64">
                                <ChildrenList children={parent.children} compact />
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                      {parent.user?.email && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          ✉️ {parent.user.email}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openDetail(parent)} className="gap-1">
                          <Eye className="h-3 w-3" />
                          Voir
                        </Button>
                        {isAdmin && (
                          <Button variant="outline" size="sm" onClick={() => openEditForm(parent)} className="gap-1">
                            <Pencil className="h-3 w-3" />
                            Modifier
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDelete(parent)}
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
                Affichage de {((page - 1) * PAGE_SIZE) + 1} à {Math.min(page * PAGE_SIZE, totalParents)} sur {totalParents} parents
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

      {/* ===== Add/Edit Parent Dialog ===== */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingParent ? 'Modifier le parent' : 'Ajouter un parent'}
            </DialogTitle>
            <DialogDescription>
              {editingParent
                ? 'Modifiez les informations du parent ci-dessous.'
                : 'Remplissez les informations pour ajouter un nouveau parent.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Photo upload */}
            <div className="space-y-2">
              <Label>Photo du parent</Label>
              <ImageDropZone
                currentImage={imageField}
                fallbackInitials={form.firstName && form.lastName ? `${form.firstName[0]}${form.lastName[0]}` : undefined}
                onImageUploaded={(url) => setImageField(url)}
                onImageRemoved={() => setImageField(null)}
                folder="parents"
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
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                  placeholder="+243 6XX XXX XXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => updateForm('address', e.target.value)}
                  placeholder="Adresse du parent"
                />
              </div>
            </div>

            <Separator />

            {/* Login credentials — only for new parents */}
            {!editingParent && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (identifiant de connexion)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    placeholder="parent@ecole.com (généré automatiquement si vide)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="text"
                    value={form.password}
                    onChange={(e) => updateForm('password', e.target.value)}
                    placeholder="Mot de passe par défaut"
                  />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Info className="h-3 w-3" />
                    <span>Mot de passe par défaut : <strong>parent123</strong></span>
                  </div>
                </div>
              </>
            )}

            {editingParent && (
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-purple-600" />
                  Identifiants de connexion
                </p>
                <p className="text-xs text-muted-foreground">
                  Email : <strong>{editingParent.user?.email || '—'}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Code utilisateur : <strong>{editingParent.user?.userCode || '—'}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Mot de passe par défaut : <strong>parent123</strong>
                </p>
              </div>
            )}

            {/* ===== Children assignment ===== */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-purple-600" />
                    Enfants en charge
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Sélectionnez un ou plusieurs élèves dont ce parent est responsable.
                  </p>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <GraduationCap className="h-3 w-3" />
                  {form.childrenIds.length} sélectionné{form.childrenIds.length > 1 ? 's' : ''}
                </Badge>
              </div>

              {/* Search box for students */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Rechercher un élève (nom, prénom, classe...)"
                  className="pl-8"
                />
                {studentSearch && (
                  <button
                    type="button"
                    onClick={() => setStudentSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Students list — scrollable, with checkboxes */}
              <div className="rounded-lg border max-h-64 overflow-y-auto">
                {studentOptionsLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement des élèves...
                  </div>
                ) : (() => {
                  const q = studentSearch.trim().toLowerCase()
                  const filtered = q
                    ? studentOptions.filter((s) => {
                        const full = `${s.firstName} ${s.lastName} ${s.className || ''} ${s.level || ''} ${s.section || ''}`.toLowerCase()
                        return full.includes(q)
                      })
                    : studentOptions

                  if (filtered.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground gap-1">
                        <GraduationCap className="h-6 w-6 opacity-40" />
                        {q ? 'Aucun élève ne correspond à votre recherche.' : 'Aucun élève disponible dans cette institution.'}
                      </div>
                    )
                  }
                  return (
                    <div className="divide-y">
                      {filtered.map((s) => {
                        const isSelected = form.childrenIds.includes(s.id)
                        // For edit mode: a student already linked to THIS parent is "ours".
                        // A student linked to ANOTHER parent will be "transferred" if selected.
                        const isOurs = editingParent && s.currentParentId === editingParent.id
                        const belongsToOther = s.currentParentId && (!editingParent || s.currentParentId !== editingParent.id)
                        return (
                          <div
                            key={s.id}
                            role="button"
                            tabIndex={0}
                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors ${
                              isSelected ? 'bg-purple-50/60 dark:bg-purple-950/20' : ''
                            }`}
                            onClick={() => toggleChild(s.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                toggleChild(s.id)
                              }
                            }}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                // Only toggle if the change doesn't match current state
                                // (avoids double-toggle when the row click also fires)
                                if (checked !== isSelected) toggleChild(s.id)
                              }}
                              className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600 pointer-events-none"
                              aria-label={`Sélectionner ${s.firstName} ${s.lastName}`}
                            />
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={getImageUrl((s as Student & { image?: string }).image)} alt={`${s.firstName} ${s.lastName}`} />
                              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                                {s.firstName[0]}{s.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {s.firstName} {s.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {s.className || s.level || '—'}{s.section ? ` ${s.section}` : ''}
                              </p>
                            </div>
                            {isOurs && (
                              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 text-[10px] gap-1">
                                <Check className="h-3 w-3" />
                                En charge
                              </Badge>
                            )}
                            {belongsToOther && !isSelected && (
                              <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 dark:text-amber-400">
                                Autre: {s.currentParentName || '—'}
                              </Badge>
                            )}
                            {belongsToOther && isSelected && (
                              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-[10px]">
                                À transférer
                              </Badge>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
              {form.childrenIds.length > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3 w-3" />
                  {editingParent
                    ? 'La liste sera mise à jour : les élèves décochés ne seront plus en charge de ce parent.'
                    : 'Les élèves sélectionnés seront liés à ce parent. Un élève ne peut avoir qu\'un seul parent responsable.'}
                </p>
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
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingParent ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Parent Detail Dialog ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Détails du parent</DialogTitle>
          </DialogHeader>
          {viewingParent && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4">
                {/* Avatar & Name */}
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={getImageUrl(viewingParent.image)} alt={`${viewingParent.firstName} ${viewingParent.lastName}`} />
                    <AvatarFallback className="bg-purple-100 text-purple-700 text-2xl font-bold">
                      {viewingParent.firstName[0]}{viewingParent.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">
                      {viewingParent.firstName} {viewingParent.lastName}
                    </h3>
                    {viewingParent.user?.userCode && (
                      <Badge variant="outline" className="mt-1 text-xs">{viewingParent.user.userCode}</Badge>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Info Grid */}
                <div className="grid gap-3">
                  {viewingParent.user?.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{viewingParent.user.email}</span>
                    </div>
                  )}
                  {viewingParent.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{viewingParent.phone}</span>
                    </div>
                  )}
                  {viewingParent.address && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{viewingParent.address}</span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Login Info */}
                <div className="rounded-lg border bg-purple-50 dark:bg-purple-900/20 p-3 space-y-1">
                  <p className="text-sm font-semibold flex items-center gap-2 text-purple-700 dark:text-purple-400">
                    <KeyRound className="h-4 w-4" />
                    Identifiants de connexion
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Email : <strong>{viewingParent.user?.email || '—'}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Code utilisateur : <strong>{viewingParent.user?.userCode || '—'}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Mot de passe par défaut : <strong>parent123</strong>
                  </p>
                </div>

                {/* Children List */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-purple-600" />
                    Enfants ({getChildrenCount(viewingParent)})
                  </h4>
                  <ChildrenList children={viewingParent.children} />
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
              Êtes-vous sûr de vouloir supprimer le parent{' '}
              <strong>
                {deletingParent?.firstName} {deletingParent?.lastName}
              </strong>
              {' '}? Cette action est irréversible et supprimera toutes les données associées, y compris le compte utilisateur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingParent(null)}>Annuler</AlertDialogCancel>
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
