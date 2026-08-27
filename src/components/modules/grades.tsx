'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  TrendingUp,
  Users,
  BarChart3,
  CheckCircle2,
  XCircle,
  GraduationCap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Pagination as PaginationNav,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { useAppStore } from '@/lib/store';
import { withSchoolYear, getImageUrl } from '@/lib/utils';
import { useAvatarChangedListener } from '@/hooks/use-avatar-refresh';
import {
  GRADE_TYPES,
  GRADE_TYPE_LABELS,
  TRIMESTERS,
  TRIMESTER_LABELS,
  MAX_GRADE_VALUE,
} from '@/lib/constants';
import type { Grade, Class, Subject, Student } from '@/lib/types';

/** Generate page numbers with ellipsis for pagination (1 … 4 5 6 … 12). */
function generatePageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

// Number of grades shown per page in the table / mobile cards.
const PAGE_SIZE = 10;

export default function GradesModule() {
  const addToast = useAppStore((s) => s.addToast);
  const currentUser = useAppStore((s) => s.currentUser);
  const schoolYear = useAppStore((s) => s.schoolYear);

  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterSubjectId, setFilterSubjectId] = useState<string>('all');
  const [filterTrimester, setFilterTrimester] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination — client-side, applied on top of filteredGrades so the stats
  // (moyenne, taux de réussite, distribution) stay computed on the full
  // filtered set while the table only shows one page at a time.
  const [page, setPage] = useState(1);

  // Add/Edit dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingGradeId, setDeletingGradeId] = useState<string>('');

  // Add form
  const [formStudentId, setFormStudentId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formType, setFormType] = useState<'devoir' | 'examen' | 'controle'>('devoir');
  const [formTrimester, setFormTrimester] = useState<'1er' | '2eme' | '3eme'>('1er');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  // French date display (dd/mm/yyyy) — the native date input shows in the
  // browser locale which may be mm/dd/yyyy on some systems. We use a text
  // input with a French date pattern so the user always sees dd/mm/yyyy.
  // The value is stored as ISO (yyyy-mm-dd) in `formDate`.
  const [formDateDisplay, setFormDateDisplay] = useState(() => {
    const d = new Date(formDate)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  });

  // Convert a French date string (dd/mm/yyyy) to ISO (yyyy-mm-dd).
  // Returns null if the input doesn't match the expected format.
  const frenchDateToISO = (fr: string): string | null => {
    const m = fr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!m) return null
    const [, dd, mm, yyyy] = m
    const day = dd.padStart(2, '0')
    const month = mm.padStart(2, '0')
    return `${yyyy}-${month}-${day}`
  }

  const handleDateChange = (value: string) => {
    setFormDateDisplay(value)
    const iso = frenchDateToISO(value)
    if (iso) setFormDate(iso)
  }
  const [formComment, setFormComment] = useState('');
  const [formMaxValue, setFormMaxValue] = useState('20');
  const [studentSearch, setStudentSearch] = useState('');

  // Class-scoped student list for the Add dialog. Reloaded every time the
  // selected class changes so the dropdown only shows students actually
  // enrolled in that class for the current school year.
  const [formClassId, setFormClassId] = useState('');
  const [formClassStudents, setFormClassStudents] = useState<Student[]>([]);
  const [formClassStudentsLoading, setFormClassStudentsLoading] = useState(false);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch(withSchoolYear('/api/classes', schoolYear));
      const data = await res.json();
      let list: Class[] = data.classes || [];
      // ── Teacher scoping ────────────────────────────────────────
      // A teacher must only see their own classes. The /api/classes
      // response includes a `teachers` array on each class, so we
      // filter client-side to those where the current teacher is
      // assigned. The backend also enforces this on the grades
      // endpoint (defense in depth).
      if (currentUser?.role === 'teacher' && currentUser.teacher?.id) {
        const tid = currentUser.teacher.id;
        list = list.filter(
          (cls) => cls.teachers?.some((ct) => ct.teacher?.id === tid)
        );
      }
      setClasses(list);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les classes');
    }
  }, [addToast, schoolYear, currentUser]);

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await fetch('/api/subjects');
      const data = await res.json();
      setSubjects(data.subjects || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les matières');
    }
  }, [addToast]);

  // Fetch only the students belonging to a specific class (used in the Add
  // Grade dialog). When no class is selected, the list is empty.
  const fetchFormClassStudents = useCallback(async (classId: string) => {
    if (!classId) {
      setFormClassStudents([]);
      return;
    }
    setFormClassStudentsLoading(true);
    try {
      // Large limit so we get the whole class in one page.
      const params = new URLSearchParams();
      params.set('classId', classId);
      params.set('limit', '200');
      params.set('status', 'all');
      const res = await fetch(withSchoolYear(`/api/students?${params.toString()}`, schoolYear));
      const data = await res.json();
      setFormClassStudents(data.students || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les élèves de cette classe');
      setFormClassStudents([]);
    } finally {
      setFormClassStudentsLoading(false);
    }
  }, [addToast, schoolYear]);

  const fetchGrades = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterClassId && filterClassId !== 'all') params.set('classId', filterClassId);
      if (filterSubjectId && filterSubjectId !== 'all') params.set('subjectId', filterSubjectId);
      if (filterTrimester && filterTrimester !== 'all') params.set('trimester', filterTrimester);
      const res = await fetch(withSchoolYear(`/api/grades?${params.toString()}`, schoolYear));
      const data = await res.json();
      setGrades(data.grades || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les notes');
    } finally {
      setLoading(false);
    }
  }, [filterClassId, filterSubjectId, filterTrimester, schoolYear, addToast]);

  useEffect(() => {
    fetchClasses();
    fetchSubjects();
  }, [fetchClasses, fetchSubjects]);

  // ── Teacher auto-select ───────────────────────────────────────
  // When a teacher has exactly one class, pre-select it in the filter
  // bar so they land directly on their class's grades. Teachers with
  // multiple classes keep the full (filtered) selector.
  useEffect(() => {
    if (
      currentUser?.role === 'teacher' &&
      classes.length === 1 &&
      filterClassId === 'all'
    ) {
      setFilterClassId(classes[0].id);
    }
  }, [currentUser, classes, filterClassId]);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  // Re-fetch the grades list whenever an avatar changes elsewhere in the app
  // (e.g. a student's photo is updated in the Students module). Without this,
  // the avatar <img> would still point at the old cached URL and the new photo
  // wouldn't appear here until a manual refresh.
  useAvatarChangedListener(() => { fetchGrades(); }, [fetchGrades]);

  // Reload the student list whenever the selected class changes in the Add
  // dialog. NOTE: minimal deps (formClassId + dialog open state) to avoid an
  // infinite update loop — fetchFormClassStudents updates formClassStudents,
  // which we must NOT list as a dependency here.
  useEffect(() => {
    if (addDialogOpen) {
      fetchFormClassStudents(formClassId);
    }
  }, [formClassId, addDialogOpen, fetchFormClassStudents]);

  // When the class-scoped student list changes, make sure the previously
  // chosen student is still valid. If not, clear the selection. Runs as a
  // separate effect to avoid coupling it to the fetch effect above.
  useEffect(() => {
    if (formStudentId && formClassStudents.length > 0 && !formClassStudents.some((s) => s.id === formStudentId)) {
      setFormStudentId('');
    }
  }, [formClassStudents, formStudentId]);

  // Reset to first page whenever any filter changes, so the user always lands
  // on a valid page after refining their search.
  useEffect(() => {
    setPage(1);
  }, [filterClassId, filterSubjectId, filterTrimester, filterType, searchQuery]);

  // Filter grades client-side for type and search
  const filteredGrades = grades.filter((grade) => {
    if (filterType && filterType !== 'all' && grade.type !== filterType) return false;
    if (searchQuery) {
      const name = grade.student
        ? `${grade.student.firstName} ${grade.student.lastName}`.toLowerCase()
        : '';
      const subject = grade.subject?.name?.toLowerCase() || '';
      const q = searchQuery.toLowerCase();
      if (!name.includes(q) && !subject.includes(q)) return false;
    }
    return true;
  });

  // Pagination derived values
  const totalGrades = filteredGrades.length;
  const totalPages = Math.max(1, Math.ceil(totalGrades / PAGE_SIZE));
  // Clamp the current page if filters shrank the list below the current page.
  const currentPage = Math.min(page, totalPages);
  const paginatedGrades = filteredGrades.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const showingFrom = totalGrades === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * PAGE_SIZE, totalGrades);

  // Stats
  const avgGrade = filteredGrades.length > 0
    ? filteredGrades.reduce((sum, g) => sum + (g.value / g.maxValue) * 20, 0) / filteredGrades.length
    : 0;
  const passRate = filteredGrades.length > 0
    ? (filteredGrades.filter((g) => (g.value / g.maxValue) * 20 >= 10).length / filteredGrades.length) * 100
    : 0;
  const distribution = [0, 0, 0, 0, 0]; // 0-4, 5-9, 10-11, 12-13, 14-20
  filteredGrades.forEach((g) => {
    const scaled = (g.value / g.maxValue) * 20;
    if (scaled < 5) distribution[0]++;
    else if (scaled < 10) distribution[1]++;
    else if (scaled < 12) distribution[2]++;
    else if (scaled < 14) distribution[3]++;
    else distribution[4]++;
  });

  const handleAddGrade = async () => {
    if (!formClassId || !formStudentId || !formSubjectId || !formValue || !formType || !formTrimester || !formDate) {
      addToast('warning', 'Champs requis', 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    const val = parseFloat(formValue);
    const maxVal = parseFloat(formMaxValue) || 20;
    if (isNaN(val) || val < 0 || val > maxVal) {
      addToast('warning', 'Note invalide', `La note doit être entre 0 et ${maxVal}`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: formStudentId,
          subjectId: formSubjectId,
          classId: formClassId,
          value: val,
          maxValue: maxVal,
          type: formType,
          trimester: formTrimester,
          schoolYear,
          date: formDate,
          comment: formComment || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }
      addToast('success', 'Note ajoutée', 'La note a été enregistrée avec succès');
      setAddDialogOpen(false);
      resetForm();
      fetchGrades();
    } catch (error) {
      addToast('error', 'Erreur', error instanceof Error ? error.message : 'Impossible d\'ajouter la note');
    } finally {
      setSaving(false);
    }
  };

  const handleEditGrade = async () => {
    if (!editingGrade || !formValue) return;
    const val = parseFloat(formValue);
    const maxVal = parseFloat(formMaxValue) || 20;
    if (isNaN(val) || val < 0 || val > maxVal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/grades/${editingGrade.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: val,
          maxValue: maxVal,
          type: formType,
          comment: formComment || undefined,
          date: formDate,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }
      addToast('success', 'Note modifiée', 'La note a été mise à jour');
      setEditDialogOpen(false);
      setEditingGrade(null);
      fetchGrades();
    } catch (error) {
      addToast('error', 'Erreur', error instanceof Error ? error.message : 'Impossible de modifier la note');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGrade = async () => {
    if (!deletingGradeId) return;
    try {
      const res = await fetch(`/api/grades/${deletingGradeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur suppression');
      addToast('success', 'Note supprimée', 'La note a été supprimée');
      setDeleteDialogOpen(false);
      setDeletingGradeId('');
      fetchGrades();
    } catch {
      addToast('error', 'Erreur', 'Impossible de supprimer la note');
    }
  };

  const openEditDialog = (grade: Grade) => {
    setEditingGrade(grade);
    setFormStudentId(grade.studentId);
    setFormSubjectId(grade.subjectId);
    setFormValue(String(grade.value));
    setFormMaxValue(String(grade.maxValue));
    setFormType(grade.type);
    setFormTrimester(grade.trimester);
    setFormDate(grade.date);
    // Update the French date display when editing an existing grade
    setFormDateDisplay(new Date(grade.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    setFormComment(grade.comment || '');
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormClassId('');
    setFormStudentId('');
    setFormSubjectId('');
    setFormValue('');
    setFormMaxValue('20');
    setFormType('devoir');
    setFormTrimester('1er');
    const todayISO = new Date().toISOString().split('T')[0];
    setFormDate(todayISO);
    setFormDateDisplay(new Date(todayISO).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    setFormComment('');
    setStudentSearch('');
    setFormClassStudents([]);
  };

  // Students shown in the Add-dialog dropdown: scoped to the selected class,
  // optionally filtered by the search box.
  const filteredStudents = formClassStudents.filter((s) => {
    if (!studentSearch) return true;
    const name = `${s.firstName} ${s.lastName}`.toLowerCase();
    return name.includes(studentSearch.toLowerCase());
  });

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'teacher' || currentUser?.role === 'super_admin';
  const isTeacher = currentUser?.role === 'teacher';
  const currentTeacherId = currentUser?.teacher?.id || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Notes</h2>
          <p className="text-sm text-muted-foreground mt-1">Gestion des évaluations et des résultats</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              resetForm();
              // Teachers with a single class: pre-fill the class so they
              // can jump straight to picking a student.
              if (isTeacher && classes.length === 1) {
                setFormClassId(classes[0].id);
              }
              setAddDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une note
          </Button>
        )}
      </div>

      {/* Teacher scope banner */}
      {isTeacher && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 p-3">
          <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-emerald-900 dark:text-emerald-100">
              Vue enseignant — {classes.length} classe{classes.length > 1 ? 's' : ''} assignée{classes.length > 1 ? 's' : ''}
              {currentTeacherId && currentUser?.teacher?.subject ? ` · ${currentUser.teacher.subject}` : ''}
            </p>
            <p className="text-emerald-700 dark:text-emerald-300 mt-0.5">
              Vous ne voyez et ne pouvez modifier que les notes de{' '}
              {classes.length > 1 ? 'vos classes' : 'votre classe'}{' '}
              pour l'année scolaire {schoolYear || '2024-2025'}.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Moyenne générale</p>
              <p className="text-2xl font-bold text-foreground">{avgGrade.toFixed(1)}/20</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Taux de réussite</p>
              <p className="text-2xl font-bold text-foreground">{passRate.toFixed(0)}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total notes</p>
              <p className="text-2xl font-bold text-foreground">{filteredGrades.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Distribution des notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: '0 - 4', count: distribution[0], color: 'bg-red-500' },
            { label: '5 - 9', count: distribution[1], color: 'bg-orange-500' },
            { label: '10 - 11', count: distribution[2], color: 'bg-yellow-500' },
            { label: '12 - 13', count: distribution[3], color: 'bg-emerald-400' },
            { label: '14 - 20', count: distribution[4], color: 'bg-emerald-600' },
          ].map((range) => (
            <div key={range.label} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-14 text-right">{range.label}</span>
              <div className="flex-1">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${range.color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${filteredGrades.length > 0 ? (range.count / filteredGrades.length) * 100 : 0}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
              <span className="text-xs text-muted-foreground w-8">{range.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Select value={filterClassId} onValueChange={setFilterClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSubjectId} onValueChange={setFilterSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Matière" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les matières</SelectItem>
                {subjects.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTrimester} onValueChange={setFilterTrimester}>
              <SelectTrigger>
                <SelectValue placeholder="Trimestre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les trimestres</SelectItem>
                {TRIMESTERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {GRADE_TYPES.map((gt) => (
                  <SelectItem key={gt.value} value={gt.value}>{gt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grades Table - Desktop */}
      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : filteredGrades.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">Aucune note trouvée</p>
            <p className="text-sm text-muted-foreground mt-1">Modifiez les filtres ou ajoutez une nouvelle note</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden lg:block overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Matière</TableHead>
                    <TableHead className="text-center">Note</TableHead>
                    <TableHead className="text-center">/20</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Trimestre</TableHead>
                    <TableHead>Date</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {paginatedGrades.map((grade) => {
                      const scaledValue = (grade.value / grade.maxValue) * 20;
                      const isPassing = scaledValue >= 10;
                      return (
                        <motion.tr
                          key={grade.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="border-b transition-colors hover:bg-muted/50"
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={getImageUrl(grade.student?.image, grade.student?.updatedAt)} alt={grade.student ? `${grade.student.firstName} ${grade.student.lastName}` : ''} />
                                <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-semibold">
                                  {grade.student ? `${grade.student.firstName[0]}${grade.student.lastName[0]}` : '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span>{grade.student ? `${grade.student.firstName} ${grade.student.lastName}` : '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{grade.subject?.name || '—'}</TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center justify-center w-12 h-8 rounded-md font-bold text-sm ${
                              isPassing ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {grade.value}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">{grade.maxValue}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{GRADE_TYPE_LABELS[grade.type] || grade.type}</Badge>
                          </TableCell>
                          <TableCell>{TRIMESTER_LABELS[grade.trimester] || grade.trimester}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{grade.date}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(grade)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => { setDeletingGradeId(grade.id); setDeleteDialogOpen(true); }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {paginatedGrades.map((grade) => {
              const scaledValue = (grade.value / grade.maxValue) * 20;
              const isPassing = scaledValue >= 10;
              return (
                <motion.div
                  key={grade.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={getImageUrl(grade.student?.image, grade.student?.updatedAt)} alt={grade.student ? `${grade.student.firstName} ${grade.student.lastName}` : ''} />
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-semibold">
                              {grade.student ? `${grade.student.firstName[0]}${grade.student.lastName[0]}` : '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground">
                              {grade.student ? `${grade.student.firstName} ${grade.student.lastName}` : '—'}
                            </p>
                            <p className="text-sm text-muted-foreground">{grade.subject?.name || '—'}</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center justify-center w-14 h-10 rounded-lg font-bold text-lg ${
                          isPassing ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {grade.value}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="outline">{GRADE_TYPE_LABELS[grade.type] || grade.type}</Badge>
                        <Badge variant="outline">{TRIMESTER_LABELS[grade.trimester] || grade.trimester}</Badge>
                        <span className="text-xs text-muted-foreground">{grade.date}</span>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(grade)}>
                            <Pencil className="w-3.5 h-3.5 mr-1" /> Modifier
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => { setDeletingGradeId(grade.id); setDeleteDialogOpen(true); }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Card>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Affichage de {showingFrom} à {showingTo} sur {totalGrades} notes
                </p>
                <PaginationNav>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {generatePageNumbers(currentPage, totalPages).map((p, i) =>
                      p === 'ellipsis' ? (
                        <PaginationItem key={`ellipsis-${i}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            isActive={p === currentPage}
                            onClick={() => setPage(p as number)}
                            className="cursor-pointer"
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </PaginationNav>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Add Grade Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ajouter une note</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Classe — filtrée par l'année scolaire courante. Le choix de la
                classe recharge la liste des élèves ci-dessous. */}
            <div className="grid gap-2">
              <Label>Classe *</Label>
              <Select
                value={formClassId}
                onValueChange={(v) => {
                  setFormClassId(v);
                  // La liste des élèves est rechargée automatiquement par le
                  // useEffect quand formClassId change. On reset aussi l'élève
                  // sélectionné car il n'appartient peut-être plus à la nouvelle
                  // classe.
                  setFormStudentId('');
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

            {/* Élève — ne s'active qu'après le choix d'une classe ; la liste
                est filtrée pour ne contenir que les élèves de cette classe. */}
            <div className="grid gap-2">
              <Label>
                Élève *
                {!formClassId && <span className="text-xs text-muted-foreground ml-1">(sélectionnez d'abord une classe)</span>}
              </Label>
              <div className="space-y-2">
                <Input
                  placeholder="Rechercher un élève..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  disabled={!formClassId || formClassStudentsLoading}
                />
                <Select
                  value={formStudentId}
                  onValueChange={setFormStudentId}
                  disabled={!formClassId || formClassStudentsLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !formClassId
                          ? "Sélectionner une classe d'abord"
                          : formClassStudentsLoading
                          ? 'Chargement des élèves...'
                          : formClassStudents.length === 0
                          ? 'Aucun élève dans cette classe'
                          : 'Sélectionner un élève'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {formClassStudents.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        {formClassId ? 'Aucun élève dans cette classe' : '—'}
                      </SelectItem>
                    ) : (
                      filteredStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.firstName} {student.lastName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {formClassId && !formClassStudentsLoading && (
                <p className="text-xs text-muted-foreground">
                  {formClassStudents.length} élève{formClassStudents.length > 1 ? 's' : ''} dans cette classe
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Matière *</Label>
              <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une matière" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Note *</Label>
                <Input
                  type="number"
                  min="0"
                  max={formMaxValue}
                  step="0.5"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label>/ Maximum</Label>
                <Input
                  type="number"
                  min="1"
                  value={formMaxValue}
                  onChange={(e) => setFormMaxValue(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type *</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as typeof formType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_TYPES.map((gt) => (
                      <SelectItem key={gt.value} value={gt.value}>{gt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Trimestre *</Label>
                <Select value={formTrimester} onValueChange={(v) => setFormTrimester(v as typeof formTrimester)}>
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
            <div className="grid gap-2">
              <Label>Date *</Label>
              <Input
                type="text"
                value={formDateDisplay}
                onChange={(e) => handleDateChange(e.target.value)}
                placeholder="jj/mm/aaaa (ex: 25/08/2025)"
              />
            </div>
            <div className="grid gap-2">
              <Label>Commentaire</Label>
              <Input
                value={formComment}
                onChange={(e) => setFormComment(e.target.value)}
                placeholder="Commentaire optionnel"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAddGrade} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Grade Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier la note</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Note *</Label>
                <Input
                  type="number"
                  min="0"
                  max={formMaxValue}
                  step="0.5"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>/ Maximum</Label>
                <Input
                  type="number"
                  min="1"
                  value={formMaxValue}
                  onChange={(e) => setFormMaxValue(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as typeof formType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_TYPES.map((gt) => (
                      <SelectItem key={gt.value} value={gt.value}>{gt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Date</Label>
                <Input
                  type="text"
                  value={formDateDisplay}
                  onChange={(e) => handleDateChange(e.target.value)}
                  placeholder="jj/mm/aaaa (ex: 25/08/2025)"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Commentaire</Label>
              <Input
                value={formComment}
                onChange={(e) => setFormComment(e.target.value)}
                placeholder="Commentaire optionnel"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleEditGrade} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette note ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La note sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGrade} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
