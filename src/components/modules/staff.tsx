'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Building2,
  X,
  Loader2,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAppStore } from '@/lib/store'
import { withSchoolYear, getImageUrl } from '@/lib/utils'
import { useAvatarChangedListener } from '@/hooks/use-avatar-refresh'
import type { Staff } from '@/lib/types'

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import ImageDropZone from '@/components/image-dropzone'

// ---------- Types ----------

interface StaffFormData {
  firstName: string
  lastName: string
  phone: string
  email: string
  fonction: string
  image: string
}

const initialForm: StaffFormData = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  fonction: '',
  image: '',
}

// Fonction options for the dropdown
const FONCTION_OPTIONS = [
  'Secrétaire',
  'Secrétaire de direction',
  'Comptable',
  'Surveillant général',
  'Surveillant',
  'Censeur',
  'Directeur adjoint',
  'Directeur',
  'Agent d\'entretien',
  'Agent de sécurité',
  'Bibliothécaire',
  'Infirmier(ère)',
  'Conseiller d\'orientation',
  'Aide-éducateur',
  'Chef de cuisine',
  'Cuisinier',
  'Autre',
]

// ---------- Helper ----------

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

// ---------- Component ----------

export default function StaffModule() {
  const { currentUser, addToast } = useAppStore()
  const schoolYear = useAppStore((s) => s.schoolYear)

  // Data state
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Search & pagination
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalStaff, setTotalStaff] = useState(0)
  const PAGE_SIZE = 10

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Edit/view/delete targets
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [viewingStaff, setViewingStaff] = useState<Staff | null>(null)
  const [deletingStaff, setDeletingStaff] = useState<Staff | null>(null)

  // Form
  const [form, setForm] = useState<StaffFormData>(initialForm)
  const [imageField, setImageField] = useState<string>('')

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  // ---------- Fetch ----------

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))

      const res = await fetch(withSchoolYear(`/api/staff?${params}`, schoolYear), {
        headers: {
          'x-user-id': currentUser?.id || '',
          'x-institution-id': currentUser?.institutionId || '',
          'x-user-role': currentUser?.role || '',
        },
      })
      const data = await res.json()

      if (data.staff) {
        setStaffList(data.staff)
        setTotalPages(data.pagination?.totalPages || 1)
        setTotalStaff(data.pagination?.total || 0)
      }
    } catch (err) {
      console.error('Fetch staff error:', err)
      addToast({ type: 'error', title: 'Erreur', description: 'Impossible de charger le personnel' })
    } finally {
      setLoading(false)
    }
  }, [search, page, currentUser?.id, currentUser?.role, addToast, schoolYear])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  // Re-fetch the staff list whenever an avatar changes elsewhere in the app
  // (e.g. a staff member's photo is updated in this module's edit dialog) so
  // the cache-busted avatar URL is used immediately across all views.
  useAvatarChangedListener(() => { fetchStaff() }, [fetchStaff])

  // ---------- Handlers ----------

  function openAddForm() {
    setEditingStaff(null)
    setForm(initialForm)
    setImageField('')
    setFormOpen(true)
  }

  function openEditForm(staff: Staff) {
    setEditingStaff(staff)
    setForm({
      firstName: staff.firstName,
      lastName: staff.lastName,
      phone: staff.phone || '',
      email: staff.email || staff.user?.email || '',
      fonction: staff.fonction,
      image: staff.image || '',
    })
    setImageField(staff.image || '')
    setFormOpen(true)
  }

  function openDetail(staff: Staff) {
    setViewingStaff(staff)
    setDetailOpen(true)
  }

  function openDelete(staff: Staff) {
    setDeletingStaff(staff)
    setDeleteOpen(true)
  }

  async function handleSubmit() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.fonction.trim()) {
      addToast({ type: 'error', title: 'Erreur', description: 'Prénom, nom et fonction sont requis' })
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        ...form,
        image: imageField || null,
      }

      if (editingStaff) {
        // Update
        const res = await fetch(`/api/staff/${editingStaff.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUser?.id || '',
            'x-institution-id': currentUser?.institutionId || '',
            'x-user-role': currentUser?.role || '',
          },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Erreur lors de la mise à jour')
        }
        addToast({ type: 'success', title: 'Succès', description: 'Membre du personnel mis à jour' })
      } else {
        // Create
        const res = await fetch(withSchoolYear('/api/staff', schoolYear), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUser?.id || '',
            'x-institution-id': currentUser?.institutionId || '',
            'x-user-role': currentUser?.role || '',
          },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Erreur lors de la création')
        }
        addToast({ type: 'success', title: 'Succès', description: 'Membre du personnel ajouté' })
      }

      setFormOpen(false)
      setForm(initialForm)
      setImageField('')
      fetchStaff()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      addToast({ type: 'error', title: 'Erreur', description: message })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deletingStaff) return

    try {
      setSubmitting(true)
      const res = await fetch(`/api/staff/${deletingStaff.id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser?.id || '',
          'x-institution-id': currentUser?.institutionId || '',
          'x-user-role': currentUser?.role || '',
        },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de la suppression')
      }
      addToast({ type: 'success', title: 'Succès', description: 'Membre du personnel supprimé' })
      setDeleteOpen(false)
      setDeletingStaff(null)
      fetchStaff()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      addToast({ type: 'error', title: 'Erreur', description: message })
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- Export ----------

  async function fetchAllForExport(): Promise<Staff[]> {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('page', '1')
      params.set('limit', '9999')

      const res = await fetch(withSchoolYear(`/api/staff?${params}`, schoolYear), {
        headers: {
          'x-user-id': currentUser?.id || '',
          'x-institution-id': currentUser?.institutionId || '',
          'x-user-role': currentUser?.role || '',
        },
      })
      const data = await res.json()
      return data.staff || []
    } catch {
      return []
    }
  }

  async function exportToExcel() {
    setExporting(true)
    try {
      const allStaff = await fetchAllForExport()
      const rows = allStaff.map((s, i) => ({
        'N°': i + 1,
        'ID Personnel': s.user?.userCode || '',
        'Prénom': s.firstName,
        'Nom': s.lastName,
        'Fonction': s.fonction,
        'Téléphone': s.phone || '',
        'Email': s.email || s.user?.email || '',
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Personnel')
      XLSX.writeFile(wb, `personnel_${new Date().toISOString().slice(0, 10)}.xlsx`)
      addToast({ type: 'success', title: 'Export Excel', description: `${allStaff.length} membres exportés` })
    } catch {
      addToast({ type: 'error', title: 'Erreur', description: 'Impossible d\'exporter en Excel' })
    } finally {
      setExporting(false)
    }
  }

  async function exportToPDF() {
    setExporting(true)
    try {
      const allStaff = await fetchAllForExport()
      const doc = new jsPDF()

      doc.setFontSize(16)
      doc.text('Liste du Personnel', 14, 20)
      doc.setFontSize(10)
      doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, 14, 28)
      if (search) {
        doc.text(`Recherche: "${search}"`, 14, 34)
      }

      const head = [['N°', 'ID Personnel', 'Prénom', 'Nom', 'Fonction', 'Téléphone', 'Email']]
      const body = allStaff.map((s, i) => [
        String(i + 1),
        s.user?.userCode || '',
        s.firstName,
        s.lastName,
        s.fonction,
        s.phone || '',
        s.email || s.user?.email || '',
      ])

      autoTable(doc, {
        head,
        body,
        startY: search ? 38 : 32,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      })

      doc.save(`personnel_${new Date().toISOString().slice(0, 10)}.pdf`)
      addToast({ type: 'success', title: 'Export PDF', description: `${allStaff.length} membres exportés` })
    } catch {
      addToast({ type: 'error', title: 'Erreur', description: 'Impossible d\'exporter en PDF' })
    } finally {
      setExporting(false)
    }
  }

  async function handlePrint() {
    setExporting(true)
    try {
      const allStaff = await fetchAllForExport()
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Liste du Personnel</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1f2937; font-size: 20px; margin-bottom: 4px; }
          .meta { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #22c55e; color: white; padding: 8px; text-align: left; font-size: 12px; }
          td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
          tr:nth-child(even) td { background: #f9fafb; }
        </style></head>
        <body>
          <h1>Liste du Personnel</h1>
          <div class="meta">Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${allStaff.length} membre(s)${search ? ` — Recherche: "${search}"` : ''}</div>
          <table>
            <thead><tr><th>N°</th><th>ID Personnel</th><th>Prénom</th><th>Nom</th><th>Fonction</th><th>Téléphone</th><th>Email</th></tr></thead>
            <tbody>
              ${allStaff.map((s, i) => `<tr><td>${i + 1}</td><td>${s.user?.userCode || ''}</td><td>${s.firstName}</td><td>${s.lastName}</td><td>${s.fonction}</td><td>${s.phone || ''}</td><td>${s.email || s.user?.email || ''}</td></tr>`).join('')}
            </tbody>
          </table>
        </body></html>`
      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
        win.focus()
        win.print()
      }
    } catch {
      addToast({ type: 'error', title: 'Erreur', description: 'Impossible d\'imprimer' })
    } finally {
      setExporting(false)
    }
  }

  // ---------- Avatar helper ----------

  function getAvatarUrl(staff: Staff): string | undefined {
    // Delegate to getImageUrl so the URL carries a cache-busting `?v=<updatedAt>`
    // param. This makes a freshly-uploaded photo appear immediately across
    // every page that displays the staff avatar (list, detail dialog, etc.).
    return getImageUrl(staff.image, staff.updatedAt)
  }

  function getInitials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <Briefcase className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Gestion du Personnel</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {totalStaff} membre{totalStaff !== 1 ? 's' : ''} du personnel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Exporter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                Exporter Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF}>
                <FileText className="h-4 w-4 mr-2 text-red-600" />
                Exporter PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2 text-blue-600" />
                Imprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add button (admin only) */}
          {isAdmin && (
            <Button onClick={openAddForm} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher par nom, prénom, fonction, téléphone, email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-10"
            />
            {search && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => { setSearch(''); setPage(1) }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && staffList.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Briefcase className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {search ? 'Aucun résultat' : 'Aucun membre du personnel'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
              {search
                ? `Aucun membre ne correspond à "${search}"`
                : 'Commencez par ajouter un membre du personnel'}
            </p>
            {isAdmin && !search && (
              <Button onClick={openAddForm} className="mt-4" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un membre
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Desktop table */}
      {!loading && staffList.length > 0 && (
        <>
          <div className="hidden lg:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Prénom</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Fonction</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {staffList.map((staff) => (
                        <motion.tr
                          key={staff.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <TableCell>
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={getAvatarUrl(staff)} alt={`${staff.firstName} ${staff.lastName}`} />
                              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                {getInitials(staff.firstName, staff.lastName)}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{staff.firstName}</TableCell>
                          <TableCell className="font-medium">{staff.lastName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                              <Building2 className="h-3 w-3 mr-1" />
                              {staff.fonction}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {staff.phone ? (
                              <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                                <Phone className="h-3.5 w-3.5 text-gray-400" />
                                {staff.phone}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {(staff.email || staff.user?.email) ? (
                              <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                                <Mail className="h-3.5 w-3.5 text-gray-400" />
                                {staff.email || staff.user?.email}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openDetail(staff)}>
                                <Eye className="h-4 w-4 text-gray-500" />
                              </Button>
                              {isAdmin && (
                                <>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditForm(staff)}>
                                    <Pencil className="h-4 w-4 text-blue-500" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openDelete(staff)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </>
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

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            <AnimatePresence>
              {staffList.map((staff) => (
                <motion.div
                  key={staff.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Card className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={getAvatarUrl(staff)} alt={`${staff.firstName} ${staff.lastName}`} />
                          <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-semibold">
                            {getInitials(staff.firstName, staff.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {staff.firstName} {staff.lastName}
                          </p>
                          <Badge variant="secondary" className="mt-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">
                            <Building2 className="h-3 w-3 mr-1" />
                            {staff.fonction}
                          </Badge>
                          <div className="mt-2 space-y-1">
                            {staff.phone && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                <Phone className="h-3 w-3" /> {staff.phone}
                              </p>
                            )}
                            {(staff.email || staff.user?.email) && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 truncate">
                                <Mail className="h-3 w-3" /> {staff.email || staff.user?.email}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openDetail(staff)}>
                            <Eye className="h-4 w-4 text-gray-500" />
                          </Button>
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditForm(staff)}>
                                <Pencil className="h-4 w-4 text-blue-500" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openDelete(staff)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Précédent
              </Button>
              <div className="flex items-center gap-1">
                {generatePageNumbers(page, totalPages).map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-gray-400">...</span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === page ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  )
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Suivant
              </Button>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? 'Modifier le membre' : 'Ajouter un membre du personnel'}
            </DialogTitle>
            <DialogDescription>
              {editingStaff
                ? 'Modifiez les informations du membre du personnel'
                : 'Remplissez le formulaire pour ajouter un nouveau membre'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Photo */}
            <div className="flex justify-center">
              <ImageDropZone
                currentImage={imageField}
                fallbackInitials={form.firstName && form.lastName ? `${form.firstName[0]}${form.lastName[0]}` : undefined}
                onImageUploaded={(url) => setImageField(url)}
                onImageRemoved={() => setImageField('')}
                size="md"
                folder="staff"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Prénom */}
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  placeholder="Prénom"
                />
              </div>

              {/* Nom */}
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  placeholder="Nom"
                />
              </div>
            </div>

            {/* Fonction */}
            <div className="space-y-2">
              <Label htmlFor="fonction">Fonction *</Label>
              <Select
                value={form.fonction}
                onValueChange={(value) => setForm((f) => ({ ...f, fonction: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une fonction" />
                </SelectTrigger>
                <SelectContent>
                  {FONCTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@exemple.com"
              />
            </div>

            {/* Téléphone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Numéro de téléphone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+225 XX XX XX XX"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingStaff ? 'Mise à jour...' : 'Ajout...'}
                </>
              ) : (
                editingStaff ? 'Mettre à jour' : 'Ajouter'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Détails du membre</DialogTitle>
          </DialogHeader>

          {viewingStaff && (
            <div className="space-y-6 py-4">
              {/* Avatar & Name */}
              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={getAvatarUrl(viewingStaff)} alt={`${viewingStaff.firstName} ${viewingStaff.lastName}`} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xl font-bold">
                    {getInitials(viewingStaff.firstName, viewingStaff.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {viewingStaff.firstName} {viewingStaff.lastName}
                  </h3>
                  <Badge className="mt-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <Building2 className="h-3.5 w-3.5 mr-1" />
                    {viewingStaff.fonction}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Info grid */}
              <div className="space-y-3">
                {(viewingStaff.email || viewingStaff.user?.email) && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {viewingStaff.email || viewingStaff.user?.email}
                    </span>
                  </div>
                )}
                {viewingStaff.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{viewingStaff.phone}</span>
                  </div>
                )}
                {viewingStaff.user?.userCode && (
                  <div className="flex items-center gap-3 text-sm">
                    <Briefcase className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">
                      Code: {viewingStaff.user.userCode}
                    </span>
                  </div>
                )}
              </div>

              {/* Account info */}
              {isAdmin && viewingStaff.user && (
                <>
                  <Separator />
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Compte utilisateur</h4>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p>Email de connexion: {viewingStaff.user.email}</p>
                      <p>Mot de passe par défaut: personnel123</p>
                      <p>Statut: {viewingStaff.user.active ? '🟢 Actif' : '🔴 Inactif'}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer{' '}
              <strong>{deletingStaff?.firstName} {deletingStaff?.lastName}</strong> ?
              Cette action est irréversible et supprimera également le compte utilisateur associé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                'Supprimer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
