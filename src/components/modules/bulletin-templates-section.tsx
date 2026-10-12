'use client'

/**
 * BulletinTemplatesSection — Gestion des modèles de bulletins
 *
 * Cette section permet à l'admin de:
 *   - Uploader des fichiers Excel de bulletins (1ère à 6ème primaire, etc.)
 *   - Visualiser la structure parsée (en-tête + domaines + matières)
 *   - Modifier les métadonnées (nom, niveau)
 *   - Exporter en Excel / PDF / Word
 *   - Supprimer un modèle
 *
 * Affichée dans Paramètres > onglet Institution, après InstitutionTypeSection.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FileSpreadsheet,
  Upload,
  Eye,
  Pencil,
  Trash2,
  Download,
  FileText,
  FileType2,
  Loader2,
  AlertCircle,
  Plus,
  X,
  Save,
  GraduationCap,
  Layers,
  Calendar,
  Hash,
  School,
  BookOpen,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import { toast } from 'sonner'

// ---- Types (mirroir du parser backend) ----
interface BulletinHeader {
  pays: string
  ville: string
  commune: string
  ecole: string
  code: string
  eleveNom: string
  eleveId: string
  eleveDateNaiss: string
  eleveClasse: string
  elevePerm: string
  titre: string
}

interface BulletinCourse {
  nom: string
  maxPer: number | string
  p1: number | string
  p2: number | string
  maxEX1: number | string
  ptsObt1: number | string
  maxTrim1: number | string
  trim1Pts: number | string
  p3?: number | string
  p4?: number | string
  maxEX2?: number | string
  ptsObt2?: number | string
  maxTrim2?: number | string
  trim2Pts?: number | string
  p5?: number | string
  p6?: number | string
  maxEX3?: number | string
  ptsObt3?: number | string
  maxTrim3?: number | string
  trim3Pts?: number | string
}

interface BulletinDomain {
  nom: string
  sousDomaines: {
    nom: string
    courses: BulletinCourse[]
    sousTotal?: BulletinCourse | null
  }[]
  sousTotal?: BulletinCourse | null
}

interface BulletinStructure {
  header: BulletinHeader
  trimestres: string[]
  domaines: BulletinDomain[]
  maxima: { row: BulletinCourse } | null
  meta: {
    fileName: string
    level: number
    levelLabel: string
    detectedAt: string
    trimesterCount: 2 | 3
  }
}

interface BulletinTemplate {
  id: string
  name: string
  level: number
  fileName?: string | null
  mediaFileId?: string | null
  structure?: BulletinStructure | null
  createdAt: string
  updatedAt: string
}

interface BulletinTemplatesSectionProps {
  currentUser: ReturnType<typeof useAppStore.getState>['currentUser']
}

// ---- Composant principal ----
export function BulletinTemplatesSection({ currentUser }: BulletinTemplatesSectionProps) {
  const addToast = useAppStore((s) => s.addToast)
  const activeInstitutionId = useAppStore((s) => s.activeInstitutionId)
  const [templates, setTemplates] = useState<BulletinTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<BulletinTemplate | null>(null)
  const [editTemplate, setEditTemplate] = useState<BulletinTemplate | null>(null)
  const [deleteTemplate, setDeleteTemplate] = useState<BulletinTemplate | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  // Effective institution: for super_admin, use activeInstitutionId from store;
  // for admin, use their own institutionId.
  const effectiveInstitutionId =
    currentUser?.role === 'super_admin'
      ? activeInstitutionId
      : currentUser?.institutionId || ''

  const buildHeaders = () => ({
    'x-user-role': currentUser?.role || '',
    'x-user-id': currentUser?.id || '',
    'x-institution-id': effectiveInstitutionId || '',
  })

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings/bulletin-templates', {
        headers: buildHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [currentUser, effectiveInstitutionId])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    let successCount = 0
    let errorCount = 0

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/settings/bulletin-templates', {
          method: 'POST',
          body: formData,
          headers: buildHeaders(),
        })
        if (res.ok) {
          const data = await res.json()
          toast.success('Modèle uploadé', { description: data.message || `${file.name} ajouté` })
          successCount++
        } else {
          const err = await res.json()
          toast.error('Échec upload', { description: err.error || file.name })
          errorCount++
        }
      } catch (e) {
        toast.error('Échec upload', { description: file.name })
        errorCount++
      }
    }

    if (successCount > 0) {
      await fetchTemplates()
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (t: BulletinTemplate) => {
    try {
      const res = await fetch(`/api/settings/bulletin-templates/${t.id}`, {
        method: 'DELETE',
        headers: buildHeaders(),
      })
      if (res.ok) {
        toast.success('Modèle supprimé', { description: t.name })
        setTemplates((prev) => prev.filter((x) => x.id !== t.id))
        setDeleteTemplate(null)
      } else {
        const err = await res.json()
        toast.error('Erreur', { description: err.error || 'Suppression impossible' })
      }
    } catch {
      toast.error('Erreur', { description: 'Suppression impossible' })
    }
  }

  const handleExport = async (t: BulletinTemplate, format: 'xlsx' | 'pdf' | 'word') => {
    setExporting(`${t.id}-${format}`)
    try {
      const res = await fetch(
        `/api/settings/bulletin-templates/${t.id}/export?format=${format}`,
        {
          headers: buildHeaders(),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        toast.error('Export échoué', { description: err.error || 'Erreur' })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'docx'
      a.download = `${t.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Export réussi', { description: `${t.name}.${ext}` })
    } catch (e) {
      toast.error('Export échoué', { description: 'Erreur réseau' })
    } finally {
      setExporting(null)
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
          Seul un administrateur peut gérer les modèles de bulletins.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border-amber-300 dark:border-amber-700 shadow-lg shadow-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            Modèles de Bulletins
          </CardTitle>
          <CardDescription>
            Uploadez, modifiez et exportez les modèles de bulletins (Excel, PDF, Word) pour chaque niveau.
            Les fichiers <code className="text-xs">.xlsx</code> sont parsés automatiquement pour la visualisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Upload zone */}
          <div
            className="border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-lg p-6 text-center hover:bg-amber-50 dark:hover:bg-amber-900/10 transition cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleUpload(e.dataTransfer.files)
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Upload en cours…
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <Upload className="w-6 h-6 text-amber-700 dark:text-amber-300" />
                </div>
                <p className="text-sm font-medium">
                  Glissez-déposez vos fichiers Excel ici, ou cliquez pour parcourir
                </p>
                <p className="text-xs text-muted-foreground">
                  Formats acceptés: <code>.xlsx</code> · Multiple files autorisé · Max 4 Mo/fichier
                </p>
              </div>
            )}
          </div>

          {/* Templates list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Layers className="w-10 h-10 mx-auto mb-2 opacity-40" />
              Aucun modèle de bulletin uploadé pour le moment.
              <br />
              Uploadez vos fichiers Excel ci-dessus pour commencer.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => (
                <BulletinTemplateCard
                  key={t.id}
                  template={t}
                  onView={() => setPreviewTemplate(t)}
                  onEdit={() => setEditTemplate(t)}
                  onDelete={() => setDeleteTemplate(t)}
                  onExport={(fmt) => handleExport(t, fmt)}
                  exporting={exporting === `${t.id}-xlsx` || exporting === `${t.id}-pdf` || exporting === `${t.id}-word`}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview dialog */}
      {previewTemplate && (
        <BulletinPreviewDialog
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onExport={(fmt) => handleExport(previewTemplate, fmt)}
        />
      )}

      {/* Edit dialog */}
      {editTemplate && (
        <BulletinEditDialog
          template={editTemplate}
          currentUser={currentUser}
          onClose={() => setEditTemplate(null)}
          onSaved={() => {
            setEditTemplate(null)
            fetchTemplates()
          }}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={(o) => !o && setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce modèle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le modèle « {deleteTemplate?.name} » ?
              Cette action est irréversible et supprimera également le fichier Excel associé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplate && handleDelete(deleteTemplate)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ============================================================================
// Carte d'un modèle de bulletin
// ============================================================================

interface BulletinTemplateCardProps {
  template: BulletinTemplate
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onExport: (format: 'xlsx' | 'pdf' | 'word') => void
  exporting: boolean
}

function BulletinTemplateCard({
  template,
  onView,
  onEdit,
  onDelete,
  onExport,
  exporting,
}: BulletinTemplateCardProps) {
  const struct = template.structure
  const domainCount = struct?.domaines?.length || 0
  const courseCount =
    struct?.domaines?.reduce(
      (acc, d) => acc + d.sousDomaines.reduce((a, sd) => a + sd.courses.length, 0),
      0
    ) || 0
  const trimesterCount = struct?.meta?.trimesterCount || 2

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-md transition">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-white/20">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs opacity-80">Niveau {template.level}</p>
              <p className="font-semibold text-sm">{template.name}</p>
            </div>
          </div>
          <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
            {trimesterCount} trim.
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Domaines
            </span>
            <span className="font-semibold">{domainCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Matières
            </span>
            <span className="font-semibold">{courseCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Trimestres
            </span>
            <span className="font-semibold">{trimesterCount}</span>
          </div>
          {template.fileName && (
            <div className="flex items-center gap-1.5 pt-1 text-muted-foreground truncate">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="truncate text-xs" title={template.fileName}>
                {template.fileName}
              </span>
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onView}
              className="text-xs h-8"
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              Voir
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              className="text-xs h-8"
            >
              <Pencil className="w-3.5 h-3.5 mr-1" />
              Modifier
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onExport('xlsx')}
              disabled={exporting}
              className="text-xs h-8 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              title="Exporter en Excel"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              <span className="ml-1">XLSX</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onExport('pdf')}
              disabled={exporting}
              className="text-xs h-8 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              title="Exporter en PDF"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              <span className="ml-1">PDF</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onExport('word')}
              disabled={exporting}
              className="text-xs h-8 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              title="Exporter en Word"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileType2 className="w-3.5 h-3.5" />}
              <span className="ml-1">DOCX</span>
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="text-xs h-8 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Supprimer
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Dialogue de visualisation du bulletin
// ============================================================================

interface BulletinPreviewDialogProps {
  template: BulletinTemplate
  onClose: () => void
  onExport: (format: 'xlsx' | 'pdf' | 'word') => void
}

function BulletinPreviewDialog({ template, onClose, onExport }: BulletinPreviewDialogProps) {
  const [structure, setStructure] = useState<BulletinStructure | null>(template.structure || null)
  const [loading, setLoading] = useState(!template.structure)

  useEffect(() => {
    if (template.structure) {
      setStructure(template.structure)
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/settings/bulletin-templates/${template.id}`, {
          headers: { 'x-user-role': 'super_admin' },
        })
        if (res.ok) {
          const data = await res.json()
          if (!cancelled && data.template?.structure) {
            setStructure(data.template.structure)
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [template])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            Bulletin — {template.name}
          </DialogTitle>
          <DialogDescription>
            Niveau {template.level} · {structure?.meta?.trimesterCount || 2} trimestres
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {loading || !structure ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
          ) : (
            <BulletinHTMLPreview structure={structure} />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t">
          <Button variant="outline" size="sm" onClick={() => onExport('xlsx')}>
            <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport('pdf')}>
            <FileText className="w-4 h-4 mr-1.5" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport('word')}>
            <FileType2 className="w-4 h-4 mr-1.5" /> Word
          </Button>
          <Button size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Aperçu HTML structuré du bulletin
// ============================================================================

function BulletinHTMLPreview({ structure }: { structure: BulletinStructure }) {
  const t = structure.trimestres
  const trimesterCount = structure.meta.trimesterCount

  return (
    <div className="space-y-4">
      {/* En-tête institution */}
      <div className="rounded-lg border-2 border-slate-800 dark:border-slate-200 overflow-hidden">
        <div className="bg-slate-800 dark:bg-slate-900 text-white text-center py-2 text-sm font-bold">
          {structure.header.pays || 'REPUBLIQUE DEMOCRATIQUE DU CONGO'}
        </div>
        <div className="bg-amber-100 dark:bg-amber-900/30 text-center py-1 text-xs font-semibold">
          N° ID
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 text-xs">
          <div className="space-y-1">
            <div><span className="font-semibold">Ville:</span> {structure.header.ville}</div>
            <div><span className="font-semibold">Commune:</span> {structure.header.commune}</div>
            <div><span className="font-semibold">École:</span> {structure.header.ecole}</div>
            <div><span className="font-semibold">Code:</span> {structure.header.code}</div>
          </div>
          <div className="space-y-1">
            <div><span className="font-semibold">Élève:</span> {structure.header.eleveNom}</div>
            <div><span className="font-semibold">N° ID:</span> {structure.header.eleveId}</div>
            <div><span className="font-semibold">Naissance:</span> {structure.header.eleveDateNaiss}</div>
            <div><span className="font-semibold">Classe:</span> {structure.header.eleveClasse} · N° {structure.header.elevePerm}</div>
          </div>
        </div>
      </div>

      {/* Tableau de notes */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr>
              <th rowSpan={2} className="border border-slate-700 bg-slate-800 text-white px-2 py-1 text-left sticky left-0 z-10">
                BRANCHES
              </th>
              {t.map((trim, idx) => (
                <th
                  key={idx}
                  colSpan={7}
                  className="border border-slate-700 bg-slate-800 text-white px-2 py-1 text-center"
                >
                  {trim}
                </th>
              ))}
            </tr>
            <tr>
              {t.map((_, idx) => (
                <FragmentRow key={idx} />
              ))}
            </tr>
          </thead>
          <tbody>
            {structure.domaines.map((dom, di) => (
              <DomainRow key={di} dom={dom} trimesterCount={trimesterCount} />
            ))}
            {structure.maxima && (
              <tr className="bg-amber-500 text-white font-bold">
                <td className="border border-slate-700 px-2 py-1">MAXIMA GENERAUX</td>
                <CourseCells course={structure.maxima.row} trimesterCount={trimesterCount} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FragmentRow() {
  return (
    <>
      <th className="border border-slate-700 bg-slate-700 text-white px-1 py-1">MAX</th>
      <th className="border border-slate-700 bg-slate-700 text-white px-1 py-1">1P</th>
      <th className="border border-slate-700 bg-slate-700 text-white px-1 py-1">2P</th>
      <th className="border border-slate-700 bg-slate-700 text-white px-1 py-1">EX</th>
      <th className="border border-slate-700 bg-slate-700 text-white px-1 py-1">PTS</th>
      <th className="border border-slate-700 bg-slate-700 text-white px-1 py-1">TRIM</th>
      <th className="border border-slate-700 bg-slate-700 text-white px-1 py-1">PTS</th>
    </>
  )
}

function DomainRow({ dom, trimesterCount }: { dom: BulletinDomain; trimesterCount: number }) {
  const colCount = 1 + trimesterCount * 7
  return (
    <>
      <tr>
        <td
          colSpan={colCount}
          className="border border-slate-700 bg-slate-600 text-white px-2 py-1 font-bold text-xs"
        >
          {dom.nom}
        </td>
      </tr>
      {dom.sousDomaines.map((sd, sdi) => (
        <SousDomainRows key={sdi} sd={sd} trimesterCount={trimesterCount} />
      ))}
      {dom.sousTotal && (
        <tr className="bg-slate-200 dark:bg-slate-700 font-semibold">
          <td className="border border-slate-700 px-2 py-1">SOUS-TOTAL — {dom.sousTotal.nom}</td>
          <CourseCells course={dom.sousTotal} trimesterCount={trimesterCount} />
        </tr>
      )}
    </>
  )
}

function SousDomainRows({
  sd,
  trimesterCount,
}: {
  sd: BulletinDomain['sousDomaines'][number]
  trimesterCount: number
}) {
  const colCount = 1 + trimesterCount * 7
  return (
    <>
      {sd.nom && (
        <tr>
          <td
            colSpan={colCount}
            className="border border-slate-700 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 font-semibold text-xs"
          >
            {sd.nom}
          </td>
        </tr>
      )}
      {sd.courses.map((c, ci) => (
        <tr key={ci} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
          <td className="border border-slate-700 px-2 py-1">{c.nom}</td>
          <CourseCells course={c} trimesterCount={trimesterCount} />
        </tr>
      ))}
      {sd.sousTotal && (
        <tr className="bg-slate-200 dark:bg-slate-700 font-semibold">
          <td className="border border-slate-700 px-2 py-1">SOUS-TOTAL — {sd.sousTotal.nom}</td>
          <CourseCells course={sd.sousTotal} trimesterCount={trimesterCount} />
        </tr>
      )}
    </>
  )
}

function CourseCells({
  course,
  trimesterCount,
}: {
  course: BulletinCourse
  trimesterCount: number
}) {
  const cell = (v: number | string | undefined) => (
    <td className="border border-slate-700 px-1 py-1 text-center">{v ?? ''}</td>
  )
  return (
    <>
      {cell(course.maxPer)}
      {cell(course.p1)}
      {cell(course.p2)}
      {cell(course.maxEX1)}
      {cell(course.ptsObt1)}
      {cell(course.maxTrim1)}
      {cell(course.trim1Pts)}
      {trimesterCount >= 2 && (
        <>
          {cell(course.p3)}
          {cell(course.p4)}
          {cell(course.maxEX2)}
          {cell(course.ptsObt2)}
          {cell(course.maxTrim2)}
          {cell(course.trim2Pts)}
        </>
      )}
      {trimesterCount >= 3 && (
        <>
          {cell(course.p5)}
          {cell(course.p6)}
          {cell(course.maxEX3)}
          {cell(course.ptsObt3)}
          {cell(course.maxTrim3)}
          {cell(course.trim3Pts)}
        </>
      )}
    </>
  )
}

// ============================================================================
// Dialogue de modification
// ============================================================================

interface BulletinEditDialogProps {
  template: BulletinTemplate
  currentUser: ReturnType<typeof useAppStore.getState>['currentUser']
  onClose: () => void
  onSaved: () => void
}

function BulletinEditDialog({ template, currentUser, onClose, onSaved }: BulletinEditDialogProps) {
  const [name, setName] = useState(template.name)
  const [level, setLevel] = useState(String(template.level))
  const [saving, setSaving] = useState(false)

  const activeInstitutionId = useAppStore((s) => s.activeInstitutionId)
  const effectiveInstitutionId =
    currentUser?.role === 'super_admin'
      ? activeInstitutionId
      : currentUser?.institutionId || ''

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/settings/bulletin-templates/${template.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role || '',
          'x-user-id': currentUser?.id || '',
          'x-institution-id': effectiveInstitutionId || '',
        },
        body: JSON.stringify({
          name: name.trim(),
          level: parseInt(level, 10) || template.level,
        }),
      })
      if (res.ok) {
        toast.success('Modèle modifié', { description: `${name} mis à jour` })
        onSaved()
      } else {
        const err = await res.json()
        toast.error('Erreur', { description: err.error || 'Modification impossible' })
      }
    } catch {
      toast.error('Erreur', { description: 'Réseau' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le modèle</DialogTitle>
          <DialogDescription>
            Changez le nom et le niveau du modèle de bulletin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="bulletin-name">Nom du modèle</Label>
            <Input
              id="bulletin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: 1ère PRIMAIRE"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulletin-level">Niveau</Label>
            <Input
              id="bulletin-level"
              type="number"
              min="1"
              max="12"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Niveau 1-6 = primaire, 7-12 = secondaire
            </p>
          </div>

          {template.structure && (
            <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
              <p className="font-semibold mb-1">Structure détectée:</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Domaines:</span>
                <span>{template.structure.domaines?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Matières:</span>
                <span>
                  {template.structure.domaines?.reduce(
                    (a, d) => a + d.sousDomaines.reduce((b, sd) => b + sd.courses.length, 0),
                    0
                  ) || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trimestres:</span>
                <span>{template.structure.meta?.trimesterCount || 2}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fichier source:</span>
                <span className="truncate max-w-[200px]" title={template.fileName || ''}>
                  {template.fileName || '—'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
