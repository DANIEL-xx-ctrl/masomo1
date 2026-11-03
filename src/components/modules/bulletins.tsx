'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  Printer,
  Eye,
  Loader2,
  Award,
  Users,
  FileDown,
  FileSpreadsheet,
  Trophy,
  FileType2,
  X,
  AlertTriangle,
  Search,
  GraduationCap,
  Hash,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { withSchoolYear } from '@/lib/utils';
import { TRIMESTERS, TRIMESTER_LABELS } from '@/lib/constants';
import type { Class, Student } from '@/lib/types';

// ============================================================================
// Helpers — duplication légère de `bulletin-parser.ts` (côté client, sans
// dépendance à `xlsx`). Sert à détecter le niveau (1-12) d'une classe depuis
// son nom pour pré-trier les élèves selon le template de leur promotion.
// ============================================================================

/** Détecte le numéro de niveau (1-12) à partir d'un nom de classe. */
function detectClassLevelClient(className: string): number {
  if (!className) return 0;
  const base = className.toLowerCase();
  const m =
    base.match(/(\d)[èe]me/) ||
    base.match(/(\d)_?me/) ||
    base.match(/(\d)_?re/) ||
    base.match(/(\d)re/) ||
    base.match(/(\d)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Label joli pour un niveau numérique (ex: 4 → "4ème PRIMAIRE"). */
function levelLabelClient(level: number): string {
  const map: Record<number, string> = {
    1: '1ère PRIMAIRE',
    2: '2ème PRIMAIRE',
    3: '3ème PRIMAIRE',
    4: '4ème PRIMAIRE',
    5: '5ème PRIMAIRE',
    6: '6ème PRIMAIRE',
    7: '1ère SECONDAIRE',
    8: '2ème SECONDAIRE',
    9: '3ème SECONDAIRE',
    10: '4ème SECONDAIRE',
    11: '5ème SECONDAIRE',
    12: '6ème SECONDAIRE',
  };
  return map[level] || `Niveau ${level}`;
}

// ============================================================================
// Types locaux
// ============================================================================

interface TemplateInfo {
  id: string;
  name: string;
  level: number;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PreviewMeta {
  templateName: string;
  level: number;
  sheetName: string;
  subjectsCount: number;
  gradesInserted: number;
}

// ============================================================================
// Proclamation types (sous-module conservé mais compacté)
// ============================================================================

type Period = 'trimester' | 'semester' | 'annual';
interface ProcEntry {
  rank: number;
  studentId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  className: string;
  classLevel: string;
  average: number;
  percentage: number;
  appreciation: string;
  mention: string;
  passed: boolean;
}
interface ProcResult {
  entries: ProcEntry[];
  params: {
    schoolYear: string;
    period: Period;
    periodLabel: string;
    classLabel: string;
    trimester: string | null;
    semester: string | null;
  };
  institution: { name: string } | null;
  stats: {
    totalStudents: number;
    passedCount: number;
    failedCount: number;
    classAverage: number;
    successRate: number;
    highestAverage: number;
    lowestAverage: number;
  };
}

// ============================================================================
// Composant principal
// ============================================================================

export default function BulletinsModule() {
  const addToast = useAppStore((s) => s.addToast);
  const schoolYear = useAppStore((s) => s.schoolYear);
  const currentUser = useAppStore((s) => s.currentUser);
  const activeInstitutionId = useAppStore((s) => s.activeInstitutionId);

  // Institution effective : super_admin → activeInstitutionId ; sinon →
  // l'institution de l'utilisateur courant.
  const effectiveInstitutionId = useMemo(
    () => activeInstitutionId || currentUser?.institutionId || null,
    [activeInstitutionId, currentUser]
  );

  // ----- State -----
  const [classes, setClasses] = useState<Class[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Filtres
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [studentSearch, setStudentSearch] = useState<string>('');

  // Élèves de la classe sélectionnée
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [classStudentsLoading, setClassStudentsLoading] = useState(false);

  // ----- State : prévisualisation du bulletin -----
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewMeta, setPreviewMeta] = useState<PreviewMeta | null>(null);
  const [previewError, setPreviewError] = useState<string>('');
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | 'word' | null>(null);

  // ----- State : proclamation (sous-module compacté) -----
  const [procDialogOpen, setProcDialogOpen] = useState(false);
  const [procPeriod, setProcPeriod] = useState<Period>('trimester');
  const [procClassId, setProcClassId] = useState<string>('all');
  const [procTrimester, setProcTrimester] = useState<string>('1er');
  const [procSemester, setProcSemester] = useState<string>('1');
  const [procLoading, setProcLoading] = useState(false);
  const [procResult, setProcResult] = useState<ProcResult | null>(null);
  const [procError, setProcError] = useState<string>('');
  const [procExporting, setProcExporting] = useState<'pdf' | 'excel' | 'word' | null>(null);
  const [procCandidates, setProcCandidates] = useState<Array<{ id: string; firstName: string; lastName: string; className: string }>>([]);
  const [procCandidatesLoading, setProcCandidatesLoading] = useState(false);
  const [procSelectedIds, setProcSelectedIds] = useState<Set<string>>(new Set());
  const [procConfirmedStudents, setProcConfirmedStudents] = useState<Array<{ id: string; firstName: string; lastName: string; className: string }>>([]);

  // ============================================================================
  // Fetchers
  // ============================================================================

  const fetchClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const res = await fetch(withSchoolYear('/api/classes', schoolYear));
      const data = await res.json();
      setClasses(data.classes || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les classes');
    } finally {
      setLoadingClasses(false);
    }
  }, [addToast, schoolYear]);

  const fetchTemplates = useCallback(async () => {
    // On envoie les mêmes headers que la page Paramètres → Institution
    // (bulletin-templates-section.tsx) pour que l'API puisse résoudre
    // l'institutionId via x-institution-id ou x-user-id, même quand
    // effectiveInstitutionId est null (super_admin sans institution
    // active, ou currentUser pas encore chargé).
    const headers: Record<string, string> = {
      'x-user-role': currentUser?.role || '',
      'x-user-id': currentUser?.id || '',
      'x-institution-id': effectiveInstitutionId || '',
    };
    setLoadingTemplates(true);
    try {
      const url = effectiveInstitutionId
        ? `/api/bulletins/templates-by-level?institutionId=${effectiveInstitutionId}`
        : `/api/bulletins/templates-by-level`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      // Silencieux : on continue avec templates vides (la carte élève montrera "pas de template")
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, [effectiveInstitutionId, currentUser]);

  const fetchClassStudents = useCallback(async (classId: string) => {
    if (!classId) {
      setClassStudents([]);
      return;
    }
    setClassStudentsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('classId', classId);
      params.set('limit', '300');
      params.set('status', 'all');
      const res = await fetch(withSchoolYear(`/api/students?${params.toString()}`, schoolYear));
      const data = await res.json();
      setClassStudents(data.students || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les élèves de cette classe');
      setClassStudents([]);
    } finally {
      setClassStudentsLoading(false);
    }
  }, [addToast, schoolYear]);

  // Effets initiaux
  useEffect(() => { fetchClasses(); }, [fetchClasses]);
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Recharge les élèves quand la classe change
  useEffect(() => {
    if (filterClassId && filterClassId !== 'all') {
      fetchClassStudents(filterClassId);
    } else {
      setClassStudents([]);
    }
  }, [filterClassId, fetchClassStudents]);

  // ============================================================================
  // Map niveau → template disponible
  // ============================================================================

  const templatesByLevel = useMemo(() => {
    const m = new Map<number, TemplateInfo>();
    for (const t of templates) m.set(t.level, t);
    return m;
  }, [templates]);

  // Pour chaque classe, calcule son niveau + indique si un template existe
  const classInfoMap = useMemo(() => {
    const m = new Map<string, { level: number; hasTemplate: boolean; templateName?: string }>();
    for (const cls of classes) {
      const level = detectClassLevelClient(cls.name) || detectClassLevelClient(cls.level);
      const tpl = level > 0 ? templatesByLevel.get(level) : undefined;
      m.set(cls.id, { level, hasTemplate: !!tpl, templateName: tpl?.name });
    }
    return m;
  }, [classes, templatesByLevel]);

  // Élèves filtrés par recherche
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return classStudents;
    const q = studentSearch.toLowerCase().trim();
    return classStudents.filter((s) => {
      const fullName = `${s.lastName} ${s.firstName}`.toLowerCase();
      const userCode = (s as Student & { user?: { userCode?: string } }).user?.userCode || '';
      return fullName.includes(q) || userCode.toLowerCase().includes(q);
    });
  }, [classStudents, studentSearch]);

  // ============================================================================
  // Actions : prévisualisation + export
  // ============================================================================

  /** Ouvre le dialog de prévisualisation pour un élève.
   *  Appelle `/api/bulletins/template-rendered/preview` qui :
   *    1. Charge le template Excel de la promotion de l'élève.
   *    2. Trouve la feuille LISTE correspondante.
   *    3. Efface toutes les lignes élèves (rows 3+) du template.
   *    4. Insère UNE ligne avec : NOMS, N° ID (userCode), SEXE, DATE_NAISS,
   *       CLASSE + les notes de l'élève placées dans les colonnes correspondant
   *       aux en-têtes de cours (9 colonnes par matière : T1=P,P,EX puis
   *       T2=P,P,EX puis T3=P,P,EX).
   *    5. Renvoie le HTML de la feuille remplie (tableau fidèle au template).
   */
  const handlePreview = async (student: Student) => {
    setPreviewStudent(student);
    setPreviewDialogOpen(true);
    setPreviewLoading(true);
    setPreviewHtml('');
    setPreviewMeta(null);
    setPreviewError('');
    try {
      const params = new URLSearchParams();
      params.set('studentId', student.id);
      params.set('schoolYear', schoolYear);
      if (filterClassId && filterClassId !== 'all') params.set('classId', filterClassId);
      const res = await fetch(`/api/bulletins/template-rendered/preview?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      const data = await res.json();
      setPreviewHtml(data.html || '');
      setPreviewMeta(data.meta || null);
      if (!data.html) {
        setPreviewError('Aperçu vide — vérifiez que le template contient bien une feuille LISTE.');
      }
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Impossible de générer l\'aperçu');
    } finally {
      setPreviewLoading(false);
    }
  };

  /** Téléchargement générique d'un blob binaire renvoyé par l'API. */
  const triggerDownload = async (url: string, fallbackName: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur ${res.status}`);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    const cd = res.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename="?([^";]+)"?/);
    a.download = match ? match[1] : fallbackName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  };

  /** Construit l'URL d'export pour un élève donné (format xlsx | pdf | word).
   *  Le backend charge le template de la promotion, efface les lignes élèves,
   *  insère la ligne de l'élève avec ses notes + N° ID, puis renvoie le
   *  fichier dans le format demandé. Pour pdf/word, conversion via LibreOffice
   *  headless — le résultat est conforme à la mise en page du template
   *  (bordures, fusions, couleurs, largeurs de colonnes). */
  const buildExportUrl = (format: 'xlsx' | 'pdf' | 'word') => {
    const params = new URLSearchParams();
    params.set('studentId', previewStudent!.id);
    params.set('schoolYear', schoolYear);
    params.set('format', format);
    if (filterClassId && filterClassId !== 'all') params.set('classId', filterClassId);
    return `/api/bulletins/template-rendered?${params.toString()}`;
  };

  const handleExport = async (format: 'xlsx' | 'pdf' | 'word') => {
    if (!previewStudent) return;
    setExporting(format);
    try {
      const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'docx';
      const safeName = `${previewStudent.lastName || 'eleve'}_${previewStudent.firstName || ''}_${schoolYear}`.replace(/\s+/g, '-');
      await triggerDownload(buildExportUrl(format), `bulletin_${safeName}.${ext}`);
      addToast(
        'success',
        `Export ${format.toUpperCase()}`,
        `Le bulletin de ${previewStudent.firstName} ${previewStudent.lastName} a été exporté (${format.toUpperCase()})`
      );
    } catch (error) {
      addToast('error', 'Erreur', error instanceof Error ? error.message : `Export ${format.toUpperCase()} impossible`);
    } finally {
      setExporting(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // ============================================================================
  // Proclamation handlers (sous-module conservé en compacté)
  // ============================================================================

  const buildProcUrl = (endpoint: 'list' | 'pdf' | 'excel' | 'word') => {
    const params = new URLSearchParams();
    params.set('schoolYear', schoolYear);
    params.set('period', procPeriod);
    if (procClassId && procClassId !== 'all') params.set('classId', procClassId);
    if (procPeriod === 'trimester') params.set('trimester', procTrimester);
    if (procPeriod === 'semester') params.set('semester', procSemester);
    if (procConfirmedStudents.length > 0) {
      params.set('studentIds', procConfirmedStudents.map((s) => s.id).join(','));
    }
    const base =
      endpoint === 'list'
        ? '/api/bulletins/proclamation'
        : `/api/bulletins/proclamation/export/${endpoint}`;
    return `${base}?${params.toString()}`;
  };

  const handleLoadProcCandidates = async () => {
    if (!procClassId || procClassId === 'all') {
      addToast('error', 'Classe requise', 'Veuillez sélectionner une classe spécifique');
      return;
    }
    setProcCandidatesLoading(true);
    try {
      const res = await fetch(
        `/api/bulletins/proclamation/candidates?classId=${procClassId}&schoolYear=${encodeURIComponent(schoolYear)}`
      );
      if (!res.ok) throw new Error('Échec du chargement des élèves');
      const data = await res.json();
      const students: Array<{ id: string; firstName: string; lastName: string; className: string }> = (data.students || []).map((s: { id: string; firstName: string; lastName: string; className: string }) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        className: s.className,
      }));
      setProcCandidates(students);
      setProcSelectedIds(new Set());
    } catch (error) {
      addToast('error', 'Erreur', error instanceof Error ? error.message : 'Erreur inconnue');
      setProcCandidates([]);
      setProcSelectedIds(new Set());
    } finally {
      setProcCandidatesLoading(false);
    }
  };

  const toggleProcStudent = (id: string) => {
    setProcSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmProcSelection = () => {
    if (procSelectedIds.size === 0) {
      addToast('error', 'Aucun élève sélectionné', 'Cochez au moins un élève');
      return;
    }
    const existingIds = new Set(procConfirmedStudents.map((s) => s.id));
    const toMove = procCandidates.filter((s) => procSelectedIds.has(s.id) && !existingIds.has(s.id));
    if (toMove.length === 0) {
      addToast('info', 'Déjà ajoutés', 'Tous les élèves cochés sont déjà dans la zone de proclamation');
      setProcSelectedIds(new Set());
      return;
    }
    setProcConfirmedStudents((prev) => [...prev, ...toMove]);
    setProcSelectedIds(new Set());
    addToast('success', 'Élèves passés', `${toMove.length} élève(s) ajouté(s) à la zone de proclamation`);
  };

  const removeFromProcConfirmed = (id: string) => {
    setProcConfirmedStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const handleGenerateProclamation = async () => {
    setProcLoading(true);
    setProcError('');
    setProcResult(null);
    try {
      const res = await fetch(buildProcUrl('list'));
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      const data: ProcResult = await res.json();
      setProcResult(data);
      if (data.entries.length === 0) {
        setProcError('Aucune note trouvée pour ces critères. Vérifiez que des notes existent pour la période et la classe sélectionnées.');
      }
    } catch (error) {
      setProcError(error instanceof Error ? error.message : 'Impossible de générer la proclamation');
    } finally {
      setProcLoading(false);
    }
  };

  const handleExportProclamation = async (format: 'pdf' | 'excel' | 'word') => {
    if (!procResult || procResult.entries.length === 0) return;
    setProcExporting(format);
    try {
      // Utiliser la nouvelle route template-export qui charge le template
      // Excel uploadé (feuille LISTE), insère tous les élèves sur des lignes
      // différentes, ajoute des formules SUM et RANK, cache les colonnes
      // périodes/examens, et ne montre que : Nom, Promotion, Totaux par
      // matière, Total obtenu, Total max, Rang.
      const params = new URLSearchParams();
      params.set('schoolYear', schoolYear);
      if (procClassId && procClassId !== 'all') params.set('classId', procClassId);
      if (procConfirmedStudents.length > 0) {
        params.set('studentIds', procConfirmedStudents.map((s) => s.id).join(','));
      }
      params.set('format', format);
      const templateUrl = `/api/bulletins/proclamation/template-export?${params.toString()}`;
      await triggerDownload(
        templateUrl,
        `proclamation_${procPeriod}_${schoolYear}.${format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : 'pdf'}`
      );
      addToast('success', `Export ${format.toUpperCase()}`, 'La proclamation a été exportée depuis le template');
    } catch (error) {
      addToast('error', 'Erreur', error instanceof Error ? error.message : `Export ${format.toUpperCase()} impossible`);
    } finally {
      setProcExporting(null);
    }
  };

  const openProclamationDialog = () => {
    setProcResult(null);
    setProcError('');
    setProcPeriod('trimester');
    setProcClassId('all');
    setProcTrimester('1er');
    setProcSemester('1');
    setProcCandidates([]);
    setProcSelectedIds(new Set());
    setProcConfirmedStudents([]);
    setProcDialogOpen(true);
  };

  const getProcRankBadge = (rank: number) => {
    if (rank === 1) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    if (rank === 2) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    if (rank === 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    return 'bg-muted text-muted-foreground';
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-emerald-600" />
            Bulletins scolaires
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Bulletins générés à partir des templates Excel uploadés par promotion
            (Paramètres → Institution). Sélectionnez une classe puis un élève pour
            visualiser et exporter son bulletin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={openProclamationDialog}
            variant="outline"
            className="border-amber-400 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
            title="Générer la liste de proclamation par classe / période"
          >
            <Trophy className="w-4 h-4 mr-2" />
            Liste de proclamation
          </Button>
        </div>
      </div>

      {/* Bandeau d'info sur les templates disponibles */}
      {!loadingTemplates && templates.length > 0 && (
        <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/10">
          <CardContent className="p-3 flex flex-wrap items-center gap-2 text-xs">
            <Info className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              {templates.length} template{templates.length > 1 ? 's' : ''} disponible{templates.length > 1 ? 's' : ''} :
            </span>
            {templates.map((t) => (
              <Badge key={t.id} variant="outline" className="bg-background border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
                {t.name || levelLabelClient(t.level)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
      {!loadingTemplates && templates.length === 0 && (
        <Card className="border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-amber-800 dark:text-amber-300">
              <p className="font-semibold">Aucun template de bulletin trouvé pour cette institution</p>
              <p className="mt-1">
                Uploadez au moins un fichier Excel de bulletin par promotion dans
                <strong> Paramètres → Institution → Modèles de bulletins</strong> pour
                activer la génération de bulletins sur cette page.
              </p>
              <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/80">
                Si vous avez déjà uploadé des templates et voyez ce message,
                vérifiez que vous êtes connecté avec le bon compte (super_admin
                doit avoir une institution active sélectionnée).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtres : classe + recherche */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Classe</Label>
              <Select value={filterClassId} onValueChange={setFilterClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les classes</SelectItem>
                  {classes.map((cls) => {
                    const info = classInfoMap.get(cls.id);
                    const hasTpl = info?.hasTemplate;
                    return (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                        {cls.level ? ` — ${cls.level}` : ''}
                        {hasTpl === false && info?.level ? ' (⚠ pas de template)' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {filterClassId && filterClassId !== 'all' && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Rechercher un élève…"
                  className="pl-8"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Liste des élèves de la classe sélectionnée */}
      {filterClassId === 'all' ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-14 h-14 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Sélectionnez une classe</p>
            <p className="text-sm text-muted-foreground mt-1">
              Choisissez une classe ci-dessus pour lister ses élèves et générer leurs bulletins
              à partir du template Excel de leur promotion.
            </p>
          </CardContent>
        </Card>
      ) : classStudentsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {studentSearch ? 'Aucun élève ne correspond à votre recherche' : 'Aucun élève dans cette classe'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Légende + stats classe */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="bg-background">
              <Users className="w-3 h-3 mr-1" />
              {filteredStudents.length} élève{filteredStudents.length > 1 ? 's' : ''}
            </Badge>
            {(() => {
              const cls = classes.find((c) => c.id === filterClassId);
              const info = cls ? classInfoMap.get(cls.id) : undefined;
              if (!cls || !info) return null;
              return (
                <>
                  {info.level > 0 && (
                    <Badge variant="outline" className="bg-background">
                      <GraduationCap className="w-3 h-3 mr-1" />
                      {levelLabelClient(info.level)}
                    </Badge>
                  )}
                  {info.hasTemplate ? (
                    <Badge variant="outline" className="bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400">
                      <FileSpreadsheet className="w-3 h-3 mr-1" />
                      Template : {info.templateName || levelLabelClient(info.level)}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Pas de template pour le niveau {info.level}
                    </Badge>
                  )}
                </>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((student) => {
              const cls = classes.find((c) => c.id === student.classId);
              const info = student.classId ? classInfoMap.get(student.classId) : undefined;
              const hasTpl = !!info?.hasTemplate;
              const userCode = (student as Student & { user?: { userCode?: string } }).user?.userCode;
              return (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Card className="hover:shadow-md transition-shadow h-full">
                    <CardContent className="p-5 flex flex-col gap-3 h-full">
                      {/* En-tête carte : initiales + nom */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {(student.firstName?.[0] || '')}{(student.lastName?.[0] || '')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-foreground truncate">
                            {student.lastName} {student.firstName}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {cls?.name || '—'}
                          </p>
                        </div>
                        {hasTpl ? (
                          <Badge variant="outline" className="shrink-0 bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400 text-[10px]">
                            <Check2 />
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="shrink-0 bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400 text-[10px]">
                            ⚠
                          </Badge>
                        )}
                      </div>

                      {/* Identité : N° ID + sexe + date naiss */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Hash className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">N° ID :</span>
                          <span className="font-mono font-semibold truncate">{userCode || '—'}</span>
                        </div>
                        <div className="text-muted-foreground truncate">
                          {student.gender || '—'} · {student.dateOfBirth || '—'}
                        </div>
                      </div>

                      {info && info.level > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          Promotion : <span className="font-medium text-foreground">{levelLabelClient(info.level)}</span>
                        </div>
                      )}

                      <Separator />

                      {/* Bouton visualiser */}
                      <Button
                        onClick={() => handlePreview(student)}
                        disabled={!hasTpl}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        title={
                          hasTpl
                            ? 'Générer et visualiser le bulletin à partir du template Excel'
                            : `Aucun template uploadé pour le niveau ${info?.level || '?'} — allez dans Paramètres → Institution`
                        }
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Visualiser le bulletin
                      </Button>
                      {!hasTpl && (
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 text-center -mt-1">
                          Template manquant pour cette promotion
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* ====================================================================
          Dialog : prévisualisation du bulletin
          - Affiche le HTML de la feuille LISTE remplie pour l'élève.
          - Boutons d'export : Excel (template original rempli), PDF
            (conversion via LibreOffice → conforme à la mise en page), Word
            (idem).
         ==================================================================== */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[1100px] max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden gap-0 p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b">
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-600" />
              {previewStudent ? (
                <span>Bulletin — {previewStudent.lastName} {previewStudent.firstName}</span>
              ) : (
                <span>Bulletin</span>
              )}
            </DialogTitle>
            {previewStudent && (
              <p className="text-xs text-muted-foreground mt-1">
                Classe : {classes.find((c) => c.id === previewStudent.classId)?.name || '—'}
                {' · '}Année scolaire {schoolYear}
                {(() => {
                  const info = previewStudent.classId ? classInfoMap.get(previewStudent.classId) : undefined;
                  if (info?.level) return ` · Promotion : ${levelLabelClient(info.level)}`;
                  return '';
                })()}
              </p>
            )}
          </DialogHeader>

          {/* Métadonnées du rendu */}
          {previewMeta && (
            <div className="shrink-0 px-6 py-2 bg-muted/40 border-b text-xs flex flex-wrap items-center gap-3 text-muted-foreground">
              <span><strong className="text-foreground">Template :</strong> {previewMeta.templateName}</span>
              <span><strong className="text-foreground">Feuille :</strong> {previewMeta.sheetName}</span>
              <span><strong className="text-foreground">Matières :</strong> {previewMeta.subjectsCount}</span>
              <span><strong className="text-foreground">Notes insérées :</strong> {previewMeta.gradesInserted}</span>
            </div>
          )}

          {/* Corps : HTML du bulletin */}
          <div className="flex-1 overflow-auto min-h-0 bg-slate-100 dark:bg-slate-900/40 print:overflow-visible print:bg-white">
            {previewLoading ? (
              <div className="flex flex-col items-center justify-center h-full p-8 gap-3">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Génération du bulletin à partir du template Excel…
                </p>
                <p className="text-xs text-muted-foreground max-w-md text-center">
                  Le backend charge le template de la promotion, efface les lignes
                  d'élèves existantes dans la feuille LISTE, insère la ligne de
                  l'élève avec son N° ID et ses notes placées selon les en-têtes
                  de cours, puis renvoie le HTML de la feuille remplie.
                </p>
              </div>
            ) : previewError ? (
              <div className="p-6 max-w-2xl mx-auto">
                <Card className="border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20">
                  <CardContent className="p-4 flex items-start gap-3 text-sm">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="text-red-800 dark:text-red-300">
                      <p className="font-semibold">Impossible de générer le bulletin</p>
                      <p className="mt-1 text-sm">{previewError}</p>
                      {previewError.includes('template') && (
                        <p className="mt-2 text-xs">
                          Allez dans <strong>Paramètres → Institution → Modèles de bulletins</strong> pour
                          uploader un template Excel pour cette promotion.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : previewHtml ? (
              /* Le HTML renvoyé par le backend est un fragment de <table>
                 reproduisant fidèlement la feuille LISTE du template. On
                 l'injecte dans un conteneur scrollable. */
              <div
                className="p-4 print:p-0 overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <div className="flex items-center justify-center h-full p-8 text-muted-foreground text-sm">
                Aperçu non disponible.
              </div>
            )}
          </div>

          {/* Footer : export Excel / PDF / Word + Imprimer + Fermer */}
          <DialogFooter className="print:hidden shrink-0 border-t bg-background px-6 py-3 mt-0">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2 w-full">
              <Button
                onClick={() => handleExport('xlsx')}
                disabled={!previewStudent || exporting !== null || !!previewError}
                variant="outline"
                className="w-full sm:w-auto border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                title="Exporter le bulletin rempli au format Excel (conforme au template uploadé)"
              >
                {exporting === 'xlsx' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                Excel
              </Button>
              <Button
                onClick={() => handleExport('pdf')}
                disabled={!previewStudent || exporting !== null || !!previewError}
                variant="outline"
                className="w-full sm:w-auto border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                title="Exporter en PDF via LibreOffice — conforme à la mise en page du template"
              >
                {exporting === 'pdf' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                PDF
              </Button>
              <Button
                onClick={() => handleExport('word')}
                disabled={!previewStudent || exporting !== null || !!previewError}
                variant="outline"
                className="w-full sm:w-auto border-sky-300 text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:border-sky-900/50 dark:text-sky-400 dark:hover:bg-sky-950/30"
                title="Exporter en Word via LibreOffice — conforme à la mise en page du template"
              >
                {exporting === 'word' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileType2 className="w-4 h-4 mr-2" />
                )}
                Word
              </Button>
              <Button
                onClick={handlePrint}
                disabled={!previewStudent || !!previewError}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </Button>
              <Button
                variant="outline"
                onClick={() => setPreviewDialogOpen(false)}
                className="w-full sm:w-auto"
              >
                Fermer
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====================================================================
          Dialog : Liste de proclamation (sous-module conservé)
         ==================================================================== */}
      <Dialog open={procDialogOpen} onOpenChange={setProcDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden gap-0 p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Liste de proclamation
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Classez les élèves par rang selon leurs moyennes — par trimestre, semestre ou année.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Filters */}
            <div className="px-6 py-3 border-b bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Classe</Label>
                  <Select
                    value={procClassId}
                    onValueChange={(v) => {
                      setProcClassId(v);
                      setProcCandidates([]);
                      setProcSelectedIds(new Set());
                      setProcConfirmedStudents([]);
                    }}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les classes</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}{cls.level ? ` — ${cls.level}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs">Période</Label>
                  <Select value={procPeriod} onValueChange={(v) => setProcPeriod(v as Period)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trimester">Trimestre</SelectItem>
                      <SelectItem value="semester">Semestre</SelectItem>
                      <SelectItem value="annual">Annuel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {procPeriod === 'trimester' && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Trimestre</Label>
                    <Select value={procTrimester} onValueChange={setProcTrimester}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TRIMESTERS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {procPeriod === 'semester' && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Semestre</Label>
                    <Select value={procSemester} onValueChange={setProcSemester}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1er Semestre (T1 + T2)</SelectItem>
                        <SelectItem value="2">2ème Semestre (T3)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {procPeriod === 'annual' && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Période couverte</Label>
                    <div className="h-9 flex items-center px-3 rounded-md border border-dashed border-muted-foreground/30 text-xs text-muted-foreground">
                      Année scolaire complète (T1 + T2 + T3)
                    </div>
                  </div>
                )}

                <div className="grid gap-1.5">
                  <Label className="text-xs invisible">Générer</Label>
                  <Button
                    onClick={handleGenerateProclamation}
                    disabled={procLoading}
                    className="h-9 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {procLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trophy className="w-4 h-4 mr-2" />
                    )}
                    Générer la liste
                  </Button>
                </div>
              </div>

              {procClassId && procClassId !== 'all' && (
                <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/10 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Label className="text-xs flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                      <Users className="w-3.5 h-3.5" />
                      Sélection des élèves à proclamer
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleLoadProcCandidates}
                      disabled={procCandidatesLoading}
                    >
                      {procCandidatesLoading ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <Users className="w-3.5 h-3.5 mr-1" />
                      )}
                      {procCandidates.length > 0 ? 'Recharger' : 'Charger les élèves'}
                    </Button>
                  </div>

                  {procCandidates.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-md border border-amber-200/50 dark:border-amber-900/30 bg-background overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
                          <span className="text-xs font-medium text-muted-foreground">Élèves de la classe</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline"
                              onClick={() => setProcSelectedIds(new Set(procCandidates.map((c) => c.id)))}
                            >
                              Tout cocher
                            </button>
                            <span className="text-muted-foreground">|</span>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                              onClick={() => setProcSelectedIds(new Set())}
                            >
                              Décocher
                            </button>
                          </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-border">
                          {procCandidates.map((student) => {
                            const checked = procSelectedIds.has(student.id);
                            const alreadyMoved = procConfirmedStudents.some((s) => s.id === student.id);
                            return (
                              <label
                                key={student.id}
                                className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors ${alreadyMoved ? 'opacity-40' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleProcStudent(student.id)}
                                  className="w-4 h-4 accent-emerald-600"
                                />
                                <span className="flex-1 truncate font-medium">
                                  {student.lastName} {student.firstName}
                                </span>
                                {alreadyMoved && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900">
                                    Ajouté
                                  </Badge>
                                )}
                              </label>
                            );
                          })}
                        </div>
                        <div className="px-3 py-2 border-t bg-muted/40">
                          <Button
                            type="button"
                            size="sm"
                            className="w-full h-8 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                            onClick={handleConfirmProcSelection}
                            disabled={procSelectedIds.size === 0}
                          >
                            <Trophy className="w-3.5 h-3.5 mr-1" />
                            Passer à la proclamation ({procSelectedIds.size})
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-md border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10 overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-emerald-100/40 dark:bg-emerald-950/20">
                          <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                            <Trophy className="w-3.5 h-3.5" />
                            Élèves à proclamer
                          </span>
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900">
                            {procConfirmedStudents.length}
                          </Badge>
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-border">
                          {procConfirmedStudents.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-6 px-3">
                              Cochez des élèves à gauche, puis cliquez « Passer à la proclamation » pour les ajouter ici.
                            </p>
                          ) : (
                            procConfirmedStudents.map((student) => (
                              <div
                                key={student.id}
                                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                              >
                                <span className="flex-1 truncate font-medium">
                                  {student.lastName} {student.firstName}
                                </span>
                                <button
                                  type="button"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded p-1 transition-colors"
                                  onClick={() => removeFromProcConfirmed(student.id)}
                                  title="Retirer de la proclamation"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {procCandidates.length === 0 && !procCandidatesLoading && (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Cliquez sur « Charger les élèves » pour afficher la liste des élèves de la classe à cocher.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Results */}
            <div className="px-6 py-4">
              {procError && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-300 mb-4">
                  {procError}
                </div>
              )}

              {procResult && procResult.entries.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg border p-3 bg-card">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Effectif</p>
                      <p className="text-xl font-bold text-foreground">{procResult.stats.totalStudents}</p>
                    </div>
                    <div className="rounded-lg border p-3 bg-card">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Réussite</p>
                      <p className="text-xl font-bold text-emerald-600">
                        {procResult.stats.passedCount}
                        <span className="text-xs text-muted-foreground ml-1">({procResult.stats.successRate}%)</span>
                      </p>
                    </div>
                    <div className="rounded-lg border p-3 bg-card">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Moy. classe</p>
                      <p className="text-xl font-bold text-foreground">
                        {procResult.stats.classAverage.toFixed(2)}
                        <span className="text-xs text-muted-foreground ml-1">/20</span>
                      </p>
                    </div>
                    <div className="rounded-lg border p-3 bg-card">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Meilleure moy.</p>
                      <p className="text-xl font-bold text-amber-600">
                        {procResult.stats.highestAverage.toFixed(2)}
                        <span className="text-xs text-muted-foreground ml-1">/20</span>
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:block rounded-lg border overflow-hidden">
                    <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-card">
                          <tr className="border-b">
                            <th className="w-16 text-center p-2 font-medium">Rang</th>
                            <th className="text-left p-2 font-medium">Nom</th>
                            <th className="text-left p-2 font-medium">Prénom</th>
                            <th className="text-center p-2 font-medium">Classe</th>
                            <th className="text-center p-2 font-medium">Moyenne</th>
                            <th className="text-center p-2 font-medium">Mention</th>
                          </tr>
                        </thead>
                        <tbody>
                          {procResult.entries.map((e) => (
                            <tr key={e.studentId} className={`border-b ${e.rank <= 3 ? 'font-medium bg-amber-50/30 dark:bg-amber-950/10' : ''}`}>
                              <td className="text-center p-2">
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${getProcRankBadge(e.rank)}`}>
                                  {e.rank}
                                </span>
                              </td>
                              <td className="text-left p-2 font-semibold">{e.lastName}</td>
                              <td className="text-left p-2">{e.firstName}</td>
                              <td className="text-center p-2 text-xs text-muted-foreground">{e.className}</td>
                              <td className="text-center p-2">
                                <span className={`font-bold ${e.average >= 10 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {e.average.toFixed(2)}
                                </span>
                                <span className="text-xs text-muted-foreground">/20</span>
                              </td>
                              <td className="text-center p-2">
                                <Badge
                                  variant="outline"
                                  className={
                                    e.average >= 16 ? 'border-emerald-400 text-emerald-700 dark:text-emerald-400' :
                                    e.average >= 14 ? 'border-teal-400 text-teal-700 dark:text-teal-400' :
                                    e.average >= 12 ? 'border-sky-400 text-sky-700 dark:text-sky-400' :
                                    e.average >= 10 ? 'border-yellow-400 text-yellow-700 dark:text-yellow-400' :
                                    'border-red-400 text-red-700 dark:text-red-400'
                                  }
                                >
                                  {e.mention}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="sm:hidden space-y-2 max-h-[40vh] overflow-y-auto">
                    {procResult.entries.map((e) => (
                      <div key={e.studentId} className="rounded-lg border p-3 bg-card flex items-center gap-3">
                        <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold shrink-0 ${getProcRankBadge(e.rank)}`}>
                          {e.rank}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{e.lastName} {e.firstName}</p>
                          <p className="text-xs text-muted-foreground truncate">{e.className}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-bold text-sm ${e.average >= 10 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {e.average.toFixed(2)}
                            <span className="text-xs text-muted-foreground">/20</span>
                          </p>
                          <Badge variant="outline" className={`text-[9px] h-4 px-1 mt-0.5 ${e.average >= 16 ? 'border-emerald-400 text-emerald-700' : e.average >= 14 ? 'border-teal-400 text-teal-700' : e.average >= 12 ? 'border-sky-400 text-sky-700' : e.average >= 10 ? 'border-yellow-400 text-yellow-700' : 'border-red-400 text-red-700'}`}>
                            {e.mention}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    {procResult.params.periodLabel} — Classe : {procResult.params.classLabel} — Année scolaire {procResult.params.schoolYear}
                    {' — '}Tri par rang croissant (meilleur élève en premier)
                  </p>
                </div>
              ) : !procError && !procLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Sélectionnez vos critères ci-dessus puis cliquez sur « Générer la liste ».</p>
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t bg-background px-6 py-3 mt-0">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2 w-full">
              <Button
                onClick={() => handleExportProclamation('pdf')}
                disabled={!procResult || procResult.entries.length === 0 || procExporting !== null}
                variant="outline"
                className="w-full sm:w-auto border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                {procExporting === 'pdf' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                PDF
              </Button>
              <Button
                onClick={() => handleExportProclamation('excel')}
                disabled={!procResult || procResult.entries.length === 0 || procExporting !== null}
                variant="outline"
                className="w-full sm:w-auto border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              >
                {procExporting === 'excel' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                Excel
              </Button>
              <Button
                onClick={() => handleExportProclamation('word')}
                disabled={!procResult || procResult.entries.length === 0 || procExporting !== null}
                variant="outline"
                className="w-full sm:w-auto border-sky-300 text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:border-sky-900/50 dark:text-sky-400 dark:hover:bg-sky-950/30"
              >
                {procExporting === 'word' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileType2 className="w-4 h-4 mr-2" />}
                Word
              </Button>
              <Button
                variant="outline"
                onClick={() => setProcDialogOpen(false)}
                className="w-full sm:w-auto"
              >
                Fermer
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Petit composant inline : icône "tick" pour la carte élève (template OK)
// ============================================================================

function Check2() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
