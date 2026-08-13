'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  Plus,
  Printer,
  Eye,
  Loader2,
  Award,
  TrendingUp,
  Users,
  Star,
  ChevronDown,
  ChevronUp,
  FileDown,
  FileSpreadsheet,
  Trophy,
  FileType2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAppStore } from '@/lib/store';
import { withSchoolYear } from '@/lib/utils';
import {
  TRIMESTERS,
  TRIMESTER_LABELS,
  GRADE_TYPE_LABELS,
} from '@/lib/constants';
import type { Bulletin, Class, Student, Grade, Subject } from '@/lib/types';

export default function BulletinsModule() {
  const addToast = useAppStore((s) => s.addToast);
  const schoolYear = useAppStore((s) => s.schoolYear);

  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterTrimester, setFilterTrimester] = useState<string>('all');

  // Generate dialog
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStudentId, setGenStudentId] = useState('');
  const [genClassId, setGenClassId] = useState('');
  const [genTrimester, setGenTrimester] = useState<'1er' | '2eme' | '3eme'>('1er');
  // Students belonging to the selected class (in the generate dialog).
  // Reloaded every time the class changes, so the user only sees students
  // actually enrolled in that class for the current school year.
  const [genClassStudents, setGenClassStudents] = useState<Student[]>([]);
  const [genClassStudentsLoading, setGenClassStudentsLoading] = useState(false);

  // Detail view
  const [detailBulletin, setDetailBulletin] = useState<Bulletin | null>(null);
  const [detailGrades, setDetailGrades] = useState<Grade[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Individual bulletin export (PDF / Excel)
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // ===== Proclamation list =====
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

  const [procDialogOpen, setProcDialogOpen] = useState(false);
  const [procPeriod, setProcPeriod] = useState<Period>('trimester');
  const [procClassId, setProcClassId] = useState<string>('all');
  const [procTrimester, setProcTrimester] = useState<string>('1er');
  const [procSemester, setProcSemester] = useState<string>('1');
  const [procLoading, setProcLoading] = useState(false);
  const [procResult, setProcResult] = useState<ProcResult | null>(null);
  const [procError, setProcError] = useState<string>('');
  const [procExporting, setProcExporting] = useState<'pdf' | 'excel' | 'word' | null>(null);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch(withSchoolYear('/api/classes', schoolYear));
      const data = await res.json();
      setClasses(data.classes || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les classes');
    }
  }, [addToast, schoolYear]);

  // Fetch only the students belonging to a specific class (used in the
  // generate-bulletin dialog). When no class is selected, the list is empty.
  const fetchClassStudents = useCallback(async (classId: string) => {
    if (!classId) {
      setGenClassStudents([]);
      return;
    }
    setGenClassStudentsLoading(true);
    try {
      // Ask for a large limit so we get the whole class in one page.
      const params = new URLSearchParams();
      params.set('classId', classId);
      params.set('limit', '200');
      params.set('status', 'all');
      const res = await fetch(withSchoolYear(`/api/students?${params.toString()}`, schoolYear));
      const data = await res.json();
      setGenClassStudents(data.students || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les élèves de cette classe');
      setGenClassStudents([]);
    } finally {
      setGenClassStudentsLoading(false);
    }
  }, [addToast, schoolYear]);

  // Reload the student list whenever the selected class changes in the dialog.
  // NOTE: we intentionally keep the dependency array minimal (genClassId +
  // dialog open state) to avoid an infinite update loop — fetchClassStudents
  // updates genClassStudents, which we must NOT list as a dependency here.
  useEffect(() => {
    if (generateDialogOpen) {
      fetchClassStudents(genClassId);
    }
  }, [genClassId, generateDialogOpen, fetchClassStudents]);

  // When the class-scoped student list changes, make sure the previously
  // chosen student is still valid. If not, clear the selection. This runs as
  // a separate effect to avoid coupling it to the fetch effect above.
  useEffect(() => {
    if (genStudentId && genClassStudents.length > 0 && !genClassStudents.some((s) => s.id === genStudentId)) {
      setGenStudentId('');
    }
  }, [genClassStudents, genStudentId]);

  const fetchBulletins = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterClassId && filterClassId !== 'all') params.set('classId', filterClassId);
      if (filterTrimester && filterTrimester !== 'all') params.set('trimester', filterTrimester);
      const res = await fetch(withSchoolYear(`/api/bulletins?${params.toString()}`, schoolYear));
      const data = await res.json();
      setBulletins(data.bulletins || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les bulletins');
    } finally {
      setLoading(false);
    }
  }, [filterClassId, filterTrimester, schoolYear, addToast]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchBulletins();
  }, [fetchBulletins]);

  const handleGenerate = async () => {
    if (!genClassId) {
      addToast('warning', 'Classe requise', 'Veuillez sélectionner une classe');
      return;
    }
    if (!genStudentId || !genTrimester) {
      addToast('warning', 'Champs requis', 'Veuillez sélectionner un élève et un trimestre');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/bulletins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: genStudentId,
          classId: genClassId || undefined,
          trimester: genTrimester,
          schoolYear,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }
      addToast('success', 'Bulletin généré', 'Le bulletin a été généré avec succès');
      setGenerateDialogOpen(false);
      fetchBulletins();
    } catch (error) {
      addToast('error', 'Erreur', error instanceof Error ? error.message : 'Impossible de générer le bulletin');
    } finally {
      setGenerating(false);
    }
  };

  const openDetail = async (bulletin: Bulletin) => {
    setDetailBulletin(bulletin);
    setDetailDialogOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(withSchoolYear(`/api/grades?studentId=${bulletin.studentId}&trimester=${bulletin.trimester}`, schoolYear));
      const data = await res.json();
      setDetailGrades(data.grades || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les détails du bulletin');
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Build the export URL for a given format (pdf | excel), carrying the
  // current schoolYear so the backend queries the right grades.
  const buildExportUrl = (format: 'pdf' | 'excel') => {
    const params = new URLSearchParams();
    params.set('bulletinId', detailBulletin!.id);
    params.set('schoolYear', detailBulletin!.schoolYear || schoolYear);
    return withSchoolYear(`/api/bulletins/export/${format}?${params.toString()}`, schoolYear);
  };

  // Trigger a browser download for a binary blob returned by the export API.
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
    // Try to read the filename from Content-Disposition, otherwise fallback.
    const cd = res.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename="?([^";]+)"?/);
    a.download = match ? match[1] : fallbackName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  };

  const handleExportPdf = async () => {
    if (!detailBulletin) return;
    setExportingPdf(true);
    try {
      await triggerDownload(
        buildExportUrl('pdf'),
        `bulletin_${detailBulletin.student?.lastName || 'eleve'}_${detailBulletin.trimester}.pdf`
      );
      addToast('success', 'Export PDF', 'Le bulletin a été exporté en PDF');
    } catch (error) {
      addToast('error', 'Erreur', error instanceof Error ? error.message : 'Export PDF impossible');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (!detailBulletin) return;
    setExportingExcel(true);
    try {
      await triggerDownload(
        buildExportUrl('excel'),
        `bulletin_${detailBulletin.student?.lastName || 'eleve'}_${detailBulletin.trimester}.xlsx`
      );
      addToast('success', 'Export Excel', 'Le bulletin a été exporté en Excel');
    } catch (error) {
      addToast('error', 'Erreur', error instanceof Error ? error.message : 'Export Excel impossible');
    } finally {
      setExportingExcel(false);
    }
  };

  // ===== Proclamation list handlers =====

  const buildProcUrl = (endpoint: 'list' | 'pdf' | 'excel' | 'word') => {
    const params = new URLSearchParams();
    params.set('schoolYear', schoolYear);
    params.set('period', procPeriod);
    if (procClassId && procClassId !== 'all') params.set('classId', procClassId);
    if (procPeriod === 'trimester') params.set('trimester', procTrimester);
    if (procPeriod === 'semester') params.set('semester', procSemester);
    const base =
      endpoint === 'list'
        ? '/api/bulletins/proclamation'
        : `/api/bulletins/proclamation/export/${endpoint}`;
    return `${base}?${params.toString()}`;
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
        setProcError('Aucune note trouvée pour ces critères. Vérifiez que des bulletins/notes existent pour la période et la classe sélectionnées.');
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
      await triggerDownload(
        buildProcUrl(format),
        `proclamation_${procPeriod}_${schoolYear}.${format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : 'pdf'}`
      );
      addToast('success', `Export ${format.toUpperCase()}`, 'La proclamation a été exportée');
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
    setProcDialogOpen(true);
  };

  const getProcRankBadge = (rank: number) => {
    if (rank === 1) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    if (rank === 2) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    if (rank === 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    return 'bg-muted text-muted-foreground';
  };

  const getAppreciationColor = (appreciation: string | null) => {
    if (!appreciation) return 'text-muted-foreground';
    if (appreciation.includes('Très bien')) return 'text-emerald-700';
    if (appreciation.includes('Bien')) return 'text-emerald-600';
    if (appreciation.includes('Assez bien')) return 'text-teal-600';
    if (appreciation.includes('Passable')) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAverageColor = (avg: number | null) => {
    if (avg === null) return 'bg-gray-100 text-gray-600 dark:bg-muted dark:text-muted-foreground';
    if (avg >= 16) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (avg >= 14) return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400';
    if (avg >= 12) return 'bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400';
    if (avg >= 10) return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400';
    return 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400';
  };

  // Group grades by subject for detail view
  const gradesBySubject = detailGrades.reduce<Record<string, Grade[]>>((acc, grade) => {
    const key = grade.subjectId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(grade);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bulletins scolaires</h2>
          <p className="text-sm text-muted-foreground mt-1">Génération et consultation des bulletins de notes</p>
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
          <Button
            onClick={() => {
              setGenClassId('');
              setGenStudentId('');
              setGenClassStudents([]);
              setGenTrimester('1er');
              setGenerateDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Générer un bulletin
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={filterClassId} onValueChange={setFilterClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrer par classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTrimester} onValueChange={setFilterTrimester}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrer par trimestre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les trimestres</SelectItem>
                {TRIMESTERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulletins List */}
      {loading ? (
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
      ) : bulletins.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">Aucun bulletin trouvé</p>
            <p className="text-sm text-muted-foreground mt-1">Générez un bulletin pour commencer</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bulletins.map((bulletin) => (
            <motion.div
              key={bulletin.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(bulletin)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {bulletin.student ? `${bulletin.student.firstName} ${bulletin.student.lastName}` : 'Élève'}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {TRIMESTER_LABELS[bulletin.trimester] || bulletin.trimester}
                      </p>
                    </div>
                    {bulletin.average !== null && (
                      <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg font-bold text-lg ${getAverageColor(bulletin.average)}`}>
                        {bulletin.average.toFixed(1)}
                      </span>
                    )}
                  </div>

                  <Separator className="my-3" />

                  <div className="space-y-2">
                    {bulletin.rank && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Award className="w-3.5 h-3.5" /> Rang
                        </span>
                        <span className="font-semibold">{bulletin.rank}ème</span>
                      </div>
                    )}
                    {bulletin.appreciation && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Star className="w-3.5 h-3.5" /> Appréciation
                        </span>
                        <span className={`font-semibold ${getAppreciationColor(bulletin.appreciation)}`}>
                          {bulletin.appreciation}
                        </span>
                      </div>
                    )}
                    {bulletin.generatedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Généré le {bulletin.generatedAt}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={(e) => { e.stopPropagation(); openDetail(bulletin); }}
                  >
                    <Eye className="w-4 h-4 mr-2" /> Voir le bulletin
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Generate Bulletin Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Générer un bulletin</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Classe — choix en premier, filtrée par année scolaire courante */}
            <div className="grid gap-2">
              <Label>Classe *</Label>
              <Select
                value={genClassId}
                onValueChange={(v) => {
                  setGenClassId(v);
                  // La liste des élèves est rechargée automatiquement par le
                  // useEffect quand genClassId change. On reset aussi l'élève
                  // sélectionné car il n'appartient peut-être plus à la nouvelle
                  // classe.
                  setGenStudentId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {classes.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      Aucune classe pour {schoolYear}
                    </SelectItem>
                  ) : (
                    classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                        {cls.level ? ` — ${cls.level}` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {classes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {classes.length} classe{classes.length > 1 ? 's' : ''} disponible{classes.length > 1 ? 's' : ''} pour l'année {schoolYear}
                </p>
              )}
            </div>

            {/* Élève — ne s'affiche qu'après le choix d'une classe ; la liste
                est filtrée pour ne contenir que les élèves de cette classe. */}
            <div className="grid gap-2">
              <Label>
                Élève *
                {!genClassId && <span className="text-xs text-muted-foreground ml-1">(sélectionnez d'abord une classe)</span>}
              </Label>
              <Select
                value={genStudentId}
                onValueChange={setGenStudentId}
                disabled={!genClassId || genClassStudentsLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !genClassId
                        ? "Sélectionner une classe d'abord"
                        : genClassStudentsLoading
                        ? 'Chargement des élèves...'
                        : genClassStudents.length === 0
                        ? 'Aucun élève dans cette classe'
                        : 'Sélectionner un élève'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {genClassStudents.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      {genClassId ? 'Aucun élève dans cette classe' : '—'}
                    </SelectItem>
                  ) : (
                    genClassStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.firstName} {student.lastName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {genClassId && !genClassStudentsLoading && (
                <p className="text-xs text-muted-foreground">
                  {genClassStudents.length} élève{genClassStudents.length > 1 ? 's' : ''} dans cette classe
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Trimestre *</Label>
              <Select value={genTrimester} onValueChange={(v) => setGenTrimester(v as typeof genTrimester)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIMESTERS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !genClassId || !genStudentId}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Générer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulletin Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[700px] print:max-w-none max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden gap-0 p-0">
          <DialogHeader className="print:hidden shrink-0 px-6 pt-6 pb-3">
            <DialogTitle>Bulletin de notes</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 print:overflow-visible print:max-h-none min-h-0">
          {detailLoading ? (
            <div className="space-y-4 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : detailBulletin ? (
            <div className="space-y-4 print:space-y-2 min-w-0 pb-4" id="bulletin-print">
              {/* Header */}
              <div className="text-center border-b pb-4 print:border-gray-400">
                <h2 className="text-xl font-bold text-foreground">BULLETIN DE NOTES</h2>
                <p className="text-emerald-700 font-semibold mt-1">
                  {TRIMESTER_LABELS[detailBulletin.trimester] || detailBulletin.trimester}
                </p>
                <p className="text-sm text-muted-foreground">Année scolaire {detailBulletin.schoolYear}</p>
              </div>

              {/* Student Info */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nom :</span>{' '}
                  <span className="font-semibold">
                    {detailBulletin.student ? `${detailBulletin.student.lastName}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Prénom :</span>{' '}
                  <span className="font-semibold">
                    {detailBulletin.student ? detailBulletin.student.firstName : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Classe :</span>{' '}
                  <span className="font-semibold">
                    {detailBulletin.student?.class?.name || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date de génération :</span>{' '}
                  <span className="font-semibold">{detailBulletin.generatedAt || '—'}</span>
                </div>
              </div>

              <Separator />

              {/* Grades Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matière</TableHead>
                      <TableHead className="text-center">Coef.</TableHead>
                      <TableHead className="text-center">Note</TableHead>
                      <TableHead className="text-center">/20</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Commentaire</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(gradesBySubject).map(([subjectId, grades]) => {
                      const subject = grades[0]?.subject;
                      const avgSubject = grades.length > 0
                        ? grades.reduce((s, g) => s + (g.value / g.maxValue) * 20, 0) / grades.length
                        : 0;
                      return (
                        <TableRow key={subjectId}>
                          <TableCell className="font-medium">{subject?.name || '—'}</TableCell>
                          <TableCell className="text-center">{subject?.coefficient || 1}</TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${avgSubject >= 10 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {avgSubject.toFixed(1)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">/20</TableCell>
                          <TableCell>
                            {grades.map((g) => GRADE_TYPE_LABELS[g.type]).join(', ')}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {grades.map((g) => g.comment).filter(Boolean).join('; ') || '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <Separator />

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Moyenne</p>
                    <p className={`text-2xl font-bold ${detailBulletin.average !== null && detailBulletin.average >= 10 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {detailBulletin.average?.toFixed(2) || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">/20</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Rang</p>
                    <p className="text-2xl font-bold text-foreground">
                      {detailBulletin.rank ? `${detailBulletin.rank}ème` : '—'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Appréciation</p>
                    <p className={`text-lg font-bold ${getAppreciationColor(detailBulletin.appreciation)}`}>
                      {detailBulletin.appreciation || '—'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Signature area */}
              <div className="grid grid-cols-2 gap-8 mt-8 pt-4 border-t">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-12">Le Directeur</p>
                  <Separator />
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-12">Parent / Tuteur</p>
                  <Separator />
                </div>
              </div>
            </div>
          ) : null}
          </div>

          <DialogFooter className="print:hidden shrink-0 border-t bg-background px-6 py-3 mt-0">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2 w-full">
              <Button
                onClick={handleExportPdf}
                disabled={exportingPdf || !detailBulletin}
                variant="outline"
                className="w-full sm:w-auto border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                title="Exporter ce bulletin au format PDF"
              >
                {exportingPdf ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                PDF
              </Button>
              <Button
                onClick={handleExportExcel}
                disabled={exportingExcel || !detailBulletin}
                variant="outline"
                className="w-full sm:w-auto border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                title="Exporter ce bulletin au format Excel"
              >
                {exportingExcel ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                Excel
              </Button>
              <Button
                onClick={handlePrint}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </Button>
              <Button
                variant="outline"
                onClick={() => setDetailDialogOpen(false)}
                className="w-full sm:w-auto"
              >
                Fermer
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Proclamation List Dialog ===== */}
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

          {/* Filters */}
          <div className="shrink-0 px-6 py-3 border-b bg-muted/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Classe */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Classe</Label>
                <Select value={procClassId} onValueChange={setProcClassId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Toutes les classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les classes</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                        {cls.level ? ` — ${cls.level}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Période */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Période</Label>
                <Select
                  value={procPeriod}
                  onValueChange={(v) => setProcPeriod(v as Period)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trimester">Trimestre</SelectItem>
                    <SelectItem value="semester">Semestre</SelectItem>
                    <SelectItem value="annual">Annuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Trimester (conditional) */}
              {procPeriod === 'trimester' && (
                <div className="grid gap-1.5">
                  <Label className="text-xs">Trimestre</Label>
                  <Select value={procTrimester} onValueChange={setProcTrimester}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIMESTERS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Semester (conditional) */}
              {procPeriod === 'semester' && (
                <div className="grid gap-1.5">
                  <Label className="text-xs">Semestre</Label>
                  <Select value={procSemester} onValueChange={setProcSemester}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1er Semestre (T1 + T2)</SelectItem>
                      <SelectItem value="2">2ème Semestre (T3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Annual hint or spacer */}
              {procPeriod === 'annual' && (
                <div className="grid gap-1.5">
                  <Label className="text-xs">Période couverte</Label>
                  <div className="h-9 flex items-center px-3 rounded-md border border-dashed border-muted-foreground/30 text-xs text-muted-foreground">
                    Année scolaire complète (T1 + T2 + T3)
                  </div>
                </div>
              )}

              {/* Generate button */}
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
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
            {procError && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-300 mb-4">
                {procError}
              </div>
            )}

            {procResult && procResult.entries.length > 0 ? (
              <div className="space-y-4">
                {/* Stats summary */}
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

                {/* Proclamation table — sorted by rank ascending (1 = best) */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead className="w-16 text-center">Rang</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead>Prénom</TableHead>
                          <TableHead className="text-center">Classe</TableHead>
                          <TableHead className="text-center">Moyenne</TableHead>
                          <TableHead className="text-center">Pourcentage</TableHead>
                          <TableHead className="text-center">Mention</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {procResult.entries.map((e) => (
                          <TableRow
                            key={e.studentId}
                            className={e.rank <= 3 ? 'font-medium' : ''}
                          >
                            <TableCell className="text-center">
                              <span
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${getProcRankBadge(e.rank)}`}
                              >
                                {e.rank}
                              </span>
                            </TableCell>
                            <TableCell className="font-semibold">{e.lastName}</TableCell>
                            <TableCell>{e.firstName}</TableCell>
                            <TableCell className="text-center text-sm text-muted-foreground">{e.className}</TableCell>
                            <TableCell className="text-center">
                              <span className={`font-bold ${e.average >= 10 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {e.average.toFixed(2)}
                              </span>
                              <span className="text-xs text-muted-foreground">/20</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full ${e.percentage >= 50 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                    style={{ width: `${Math.min(e.percentage, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground w-12 text-right">
                                  {e.percentage.toFixed(1)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className={
                                  e.average >= 16
                                    ? 'border-emerald-400 text-emerald-700 dark:text-emerald-400'
                                    : e.average >= 14
                                    ? 'border-teal-400 text-teal-700 dark:text-teal-400'
                                    : e.average >= 12
                                    ? 'border-sky-400 text-sky-700 dark:text-sky-400'
                                    : e.average >= 10
                                    ? 'border-yellow-400 text-yellow-700 dark:text-yellow-400'
                                    : 'border-red-400 text-red-700 dark:text-red-400'
                                }
                              >
                                {e.mention}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Context line */}
                <p className="text-xs text-muted-foreground text-center">
                  {procResult.params.periodLabel} — Classe : {procResult.params.classLabel} — Année scolaire {procResult.params.schoolYear}
                  {' — '}
                  Tri par rang croissant (meilleur élève en premier)
                </p>
              </div>
            ) : !procError && !procLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Sélectionnez vos critères ci-dessus puis cliquez sur « Générer la liste ».</p>
              </div>
            ) : null}
          </div>

          {/* Footer with export buttons */}
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-3 mt-0">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2 w-full">
              <Button
                onClick={() => handleExportProclamation('pdf')}
                disabled={!procResult || procResult.entries.length === 0 || procExporting !== null}
                variant="outline"
                className="w-full sm:w-auto border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                title="Exporter la proclamation en PDF"
              >
                {procExporting === 'pdf' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                PDF
              </Button>
              <Button
                onClick={() => handleExportProclamation('excel')}
                disabled={!procResult || procResult.entries.length === 0 || procExporting !== null}
                variant="outline"
                className="w-full sm:w-auto border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                title="Exporter la proclamation en Excel"
              >
                {procExporting === 'excel' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                Excel
              </Button>
              <Button
                onClick={() => handleExportProclamation('word')}
                disabled={!procResult || procResult.entries.length === 0 || procExporting !== null}
                variant="outline"
                className="w-full sm:w-auto border-sky-300 text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:border-sky-900/50 dark:text-sky-400 dark:hover:bg-sky-950/30"
                title="Exporter la proclamation en Word"
              >
                {procExporting === 'word' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileType2 className="w-4 h-4 mr-2" />
                )}
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
