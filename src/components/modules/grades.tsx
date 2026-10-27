'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Download,
  FileSpreadsheet,
  FileType2,
  ChevronDown,
  X,
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
  TRIMESTER_PERIODS,
  gradeTypeToTrimester,
  getGradeMaxForType,
  MAX_GRADE_VALUE,
} from '@/lib/constants';
import type { Grade, Class, Subject, Student, GradeType, Trimester } from '@/lib/types';
import { promotionToDegree } from '@/lib/constants';

/** Extended Subject type with primary school fields (title, subtitle, degree, level, maxima).
 *  La hiérarchie est stockée explicitement en DB :
 *    title    — TITRE  (ex: "DOMAINE DES LANGUES")
 *    subtitle — SOUS-TITRE (ex: "Français")
 *    name     — MATIÈRE (ex: "Vocabulaire") */
interface SubjectWithDegree extends Subject {
  title?: string | null;
  subtitle?: string | null;
  domain?: string | null;
  degree?: string | null;
  level?: string | null;
  maxTJ?: number | null;
  maxEX?: number | null;
  maxTRIM?: number | null;
  maxAnnuel?: number | null;
}

/** Ordre canonique des TITRES pour l'affichage hiérarchique. */
const TITLE_ORDER = [
  'DOMAINE DES LANGUES',
  'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',
  "DOMAINE DE L'UNIVERS SOCIAL ET ENVIRONNEMENT",
  'DOMAINE DES ARTS',
  'DOMAINE DU DÉVELOPPEMENT PERSONNEL',
  'Autres',
]

/** Construit la hiérarchie titre → sous-titre → matières à partir d'une liste
 *  de subjects, en utilisant les champs `title` et `subtitle` stockés en DB.
 *  Si title/subtitle sont null, on regroupe sous "Autres". */
function buildSubjectHierarchy<T extends SubjectWithDegree>(subjects: T[]) {
  const hier = new Map<string, Map<string, T[]>>()
  for (const s of subjects) {
    const title = s.title || 'Autres'
    const subtitle = s.subtitle || 'Autres'
    if (!hier.has(title)) hier.set(title, new Map())
    const sm = hier.get(title)!
    if (!sm.has(subtitle)) sm.set(subtitle, [])
    sm.get(subtitle)!.push(s)
  }
  // Sort titles by canonical order, subtitles alphabetically
  const sortedTitles = Array.from(hier.keys()).sort((a, b) => {
    const ia = TITLE_ORDER.indexOf(a)
    const ib = TITLE_ORDER.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
  return sortedTitles.map((title) => ({
    title,
    subtitles: Array.from(hier.get(title)!.keys()).sort().map((subtitle) => ({
      subtitle,
      subjects: hier.get(title)!.get(subtitle)!.sort((a, b) => a.name.localeCompare(b.name)),
    })),
  }))
}

/** Map a class to a primary degree (elementaire/moyen/terminal).
 *  Priority:
 *    1. The class's `promotion` field (e.g., "primaire-elementaire")
 *    2. Fallback: heuristic detection from the `level` string (legacy classes)
 *  Returns null if neither matches a primary school degree. */
function classLevelToDegree(level: string, promotion?: string | null): string | null {
  // 1. Prefer the explicit `promotion` field set on the class
  if (promotion) {
    const degree = promotionToDegree(promotion);
    if (degree) return degree;
  }
  // 2. Fallback: heuristic detection from the level string
  if (!level) return null;
  const l = level.toLowerCase().trim();
  // Élémentaire: 1ère, 2ème année
  if (
    l.includes('1ère') || l.includes('1ere') || l.includes('1re') ||
    l.includes('2ème') || l.includes('2eme') ||
    l === '1' || l === '2' ||
    l.startsWith('1a') || l.startsWith('1b') || l.startsWith('2a') || l.startsWith('2b') ||
    l === 'elementaire'
  ) {
    return 'elementaire';
  }
  // Moyen: 3ème, 4ème année
  if (
    l.includes('3ème') || l.includes('3eme') ||
    l.includes('4ème') || l.includes('4eme') ||
    l === '3' || l === '4' ||
    l.startsWith('3a') || l.startsWith('3b') || l.startsWith('4a') || l.startsWith('4b') ||
    l === 'moyen'
  ) {
    return 'moyen';
  }
  // Terminal: 5ème, 6ème année
  if (
    l.includes('5ème') || l.includes('5eme') ||
    l.includes('6ème') || l.includes('6eme') ||
    l === '5' || l === '6' ||
    l.startsWith('5a') || l.startsWith('5b') || l.startsWith('6a') || l.startsWith('6b') ||
    l === 'terminal'
  ) {
    return 'terminal';
  }
  return null;
}

/** Degree labels in French */
const DEGREE_LABELS: Record<string, string> = {
  elementaire: 'Degré Élémentaire (1ère & 2ème)',
  moyen: 'Degré Moyen (3ème & 4ème)',
  terminal: 'Degré Terminal (5ème & 6ème)',
};

/** Format an ISO date string (e.g. "2024-12-15") as a French date string. */
function formatDateFR(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

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
  const [subjects, setSubjects] = useState<SubjectWithDegree[]>([]);
  const [institutionType, setInstitutionType] = useState<string>('secondaire');
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterSubjectId, setFilterSubjectId] = useState<string>('all');
  // Filtres hiérarchiques en cascade : Titre → Sous-titre → Matière
  const [filterSubjectTitle, setFilterSubjectTitle] = useState<string>('all');
  const [filterSubjectSubtitle, setFilterSubjectSubtitle] = useState<string>('all');
  const [filterDegree, setFilterDegree] = useState<string>('all');
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
  const [formSubjectName, setFormSubjectName] = useState('');
  // Sélection hiérarchique en cascade : titre → sous-titre → matière
  const [formSubjectTitle, setFormSubjectTitle] = useState<string>('');
  const [formSubjectSubtitle, setFormSubjectSubtitle] = useState<string>('');
  const [formValue, setFormValue] = useState('');
  const [formType, setFormType] = useState<GradeType>('p1');
  const [formTrimester, setFormTrimester] = useState<Trimester>('1er');
  // Type d'évaluation précis (p1, p2, p3, p4, p5, p6, examen_t1, examen_t2, examen_t3).
  // Quand l'utilisateur sélectionne une période dans le dropdown d'un trimestre,
  // on met à jour formGradeType ET formTrimester ET formType en conséquence.
  const [formGradeType, setFormGradeType] = useState<GradeType>('p1');
  // Flag pour éviter de reset la note quand on charge une note existante dans
  // le dialogue d'édition. Sans ça, l'effet qui surveille formGradeType efface
  // la note dès qu'on appelle setFormGradeType(grade.type) dans openEditDialog.
  const skipValueResetRef = useRef(false);
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

  // Promotion (degré) sélectionnée dans le dialogue "Ajouter note".
  // Pour les institutions primaires, l'utilisateur doit d'abord sélectionner
  // une promotion pour voir les matières correspondantes. Par défaut, on
  // reprend la promotion déjà filtrée dans la barre de filtre principale.
  const [formDegree, setFormDegree] = useState<string>('all');

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
      setInstitutionType(data.institutionType || 'secondaire');
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

  // ── Auto-sélection de la promotion au chargement (institution primaire) ──
  // Quand on détecte que l'institution est de type "primaire" et qu'aucune
  // promotion n'est encore sélectionnée (filterDegree === 'all'), on
  // pré-sélectionne automatiquement la première promotion qui a des classes.
  // Cela fait que la page Notes s'ouvre directement avec les cours de la
  // promotion correspondante, sans que l'utilisateur ait à cliquer.
  useEffect(() => {
    if (
      institutionType === 'primaire' &&
      filterDegree === 'all' &&
      classes.length > 0
    ) {
      // Trouver la première promotion qui a au moins une classe
      const firstDegreeWithClasses = ['elementaire', 'moyen', 'terminal'].find(
        (deg) => classes.some((cls) => classLevelToDegree(cls.level, cls.promotion) === deg)
      );
      if (firstDegreeWithClasses) {
        setFilterDegree(firstDegreeWithClasses);
      }
    }
  }, [institutionType, filterDegree, classes]);

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

  // ── Primary school: filter classes and subjects by degree (promotion) ──
  // For primary institutions, classes are grouped by degree (élémentaire/moyen/terminal).
  // When the user selects a degree (promotion), only classes and subjects of that
  // degree are shown. This makes the subject dropdown much shorter and more relevant.
  const isPrimaire = institutionType === 'primaire';

  // Classes filtered by the selected degree (for primary only)
  const visibleClasses = isPrimaire && filterDegree !== 'all'
    ? classes.filter((cls) => classLevelToDegree(cls.level, cls.promotion) === filterDegree)
    : classes;

  // Subjects filtered by the selected degree (for primary only).
  // For non-primary institutions, show all subjects.
  const visibleSubjects = isPrimaire && filterDegree !== 'all'
    ? subjects.filter((s) => s.degree === filterDegree || (!s.degree && filterDegree === 'elementaire'))
    : subjects;

  // Subjects further filtered by the selected Title (cascade niveau 1).
  // Si filterSubjectTitle === 'all', on garde tout.
  const subjectsFilteredByTitle = filterSubjectTitle !== 'all'
    ? visibleSubjects.filter((s) => (s.title || 'Autres') === filterSubjectTitle)
    : visibleSubjects;

  // Subjects further filtered by the selected Subtitle (cascade niveau 2).
  // Si filterSubjectSubtitle === 'all', on garde ceux du titre sélectionné.
  const subjectsFilteredBySubtitle = filterSubjectSubtitle !== 'all'
    ? subjectsFilteredByTitle.filter((s) => (s.subtitle || 'Autres') === filterSubjectSubtitle)
    : subjectsFilteredByTitle;

  // When the degree changes, reset the class and subject filters so they
  // don't reference classes/subjects that are no longer visible.
  useEffect(() => {
    if (!isPrimaire) return;
    if (filterClassId !== 'all' && !visibleClasses.some((c) => c.id === filterClassId)) {
      setFilterClassId('all');
    }
    if (filterSubjectId !== 'all' && !visibleSubjects.some((s) => s.id === filterSubjectId)) {
      setFilterSubjectId('all');
    }
  }, [filterDegree, isPrimaire, visibleClasses, visibleSubjects, filterClassId, filterSubjectId]);

  // When the selected Title changes, reset the Subtitle and Matière filters
  // so they don't reference subtitles/subjects that are no longer visible.
  useEffect(() => {
    if (filterSubjectSubtitle !== 'all') {
      const availableSubtitles = subjectsFilteredByTitle.map((s) => s.subtitle || 'Autres');
      if (!availableSubtitles.includes(filterSubjectSubtitle)) {
        setFilterSubjectSubtitle('all');
      }
    }
    if (filterSubjectId !== 'all' && !subjectsFilteredByTitle.some((s) => s.id === filterSubjectId)) {
      setFilterSubjectId('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSubjectTitle]);

  // When the selected Subtitle changes, reset the Matière filter
  useEffect(() => {
    if (filterSubjectId !== 'all' && !subjectsFilteredBySubtitle.some((s) => s.id === filterSubjectId)) {
      setFilterSubjectId('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSubjectSubtitle]);

  // Filter grades client-side for type and search
  // Le filtre type doit matcher plusieurs variantes car les notes en base
  // peuvent avoir des types différents selon l'époque du seed:
  //   "p1" / "1ère période" / "période" / "devoir"  → 1ère période T1
  //   "p2" / "2ème période"                          → 2ème période T1
  //   "examen_t1" / "examen"                         → examen T1
  //   etc.
  const TYPE_ALIASES: Record<string, string[]> = {
    'p1': ['p1', '1ère période', '1ere période', 'période', 'periode', 'devoir'],
    'p2': ['p2', '2ème période', '2eme période'],
    'examen_t1': ['examen_t1', 'examen'],
    'p3': ['p3', '3ème période', '3eme période'],
    'p4': ['p4', '4ème période', '4eme période'],
    'examen_t2': ['examen_t2'],
    'p5': ['p5', '5ème période', '5eme période'],
    'p6': ['p6', '6ème période', '6eme période'],
    'examen_t3': ['examen_t3'],
    'controle': ['controle', 'contrôle'],
  }
  function matchesType(gradeType: string, filterType: string): boolean {
    if (gradeType?.toLowerCase() === filterType.toLowerCase()) return true
    const aliases = TYPE_ALIASES[filterType]
    if (aliases) {
      const gtLower = gradeType?.toLowerCase().trim()
      return aliases.some(a => a.toLowerCase() === gtLower)
    }
    return false
  }

  const filteredGrades = grades.filter((grade) => {
    if (filterType && filterType !== 'all' && !matchesType(grade.type || '', filterType)) return false;
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
    // The subject is now a free-text field (formSubjectName). We resolve it
    // to an existing subject by name (case-insensitive) if possible, otherwise
    // the backend will create a new subject from the typed name.
    const trimmedSubjectName = formSubjectName.trim();
    const matchedSubject = trimmedSubjectName
      ? subjects.find((s) => s.name === trimmedSubjectName)
      : undefined;
    const resolvedSubjectId = matchedSubject?.id || '';
    const resolvedSubjectName = !matchedSubject && trimmedSubjectName ? trimmedSubjectName : null;

    if (!formClassId || !formStudentId || (!resolvedSubjectId && !resolvedSubjectName) || !formValue || !formType || !formTrimester || !formDate) {
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
          subjectId: resolvedSubjectId || undefined,
          subjectName: resolvedSubjectName || undefined,
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
      // Recharger la liste des notes pour afficher immédiatement la note ajoutée
      await fetchGrades();
      // Force un rechargement complet de la page pour rafraîchir aussi les
      // statistiques du dashboard et les filtres.
      setTimeout(() => window.location.reload(), 500);
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

    // Résoudre la matière modifiée (comme pour l'ajout)
    const trimmedSubjectName = formSubjectName.trim();
    const matchedSubject = trimmedSubjectName
      ? subjects.find((s) => s.name === trimmedSubjectName)
      : undefined;
    const resolvedSubjectId = matchedSubject?.id || formSubjectId || '';
    const resolvedSubjectName = !matchedSubject && !formSubjectId && trimmedSubjectName ? trimmedSubjectName : null;

    setSaving(true);
    try {
      const res = await fetch(`/api/grades/${editingGrade.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: val,
          maxValue: maxVal,
          type: formType,
          trimester: formTrimester,
          subjectId: resolvedSubjectId || undefined,
          subjectName: resolvedSubjectName || undefined,
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
      // Reload the page to refresh the dashboard stats immediately
      setTimeout(() => window.location.reload(), 800);
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
      // Reload the page to refresh the dashboard stats immediately
      setTimeout(() => window.location.reload(), 800);
    } catch {
      addToast('error', 'Erreur', 'Impossible de supprimer la note');
    }
  };

  const openEditDialog = (grade: Grade) => {
    // Activer le flag pour empêcher l'effet de reset la note quand on charge
    // une note existante. Sans ça, setFormGradeType déclenche l'effet qui
    // efface formValue avant qu'on ait pu la setter.
    skipValueResetRef.current = true;
    setEditingGrade(grade);
    setFormStudentId(grade.studentId);
    setFormSubjectId(grade.subjectId);
    setFormSubjectName(grade.subject?.name || '');
    // Pré-remplir la sélection hiérarchique avec les valeurs du subject
    setFormSubjectTitle((grade.subject as any)?.title || '');
    setFormSubjectSubtitle((grade.subject as any)?.subtitle || '');
    setFormValue(String(grade.value));
    setFormMaxValue(String(grade.maxValue));
    setFormType(grade.type);
    setFormGradeType(grade.type);
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
    setFormSubjectName('');
    setFormSubjectTitle('');
    setFormSubjectSubtitle('');
    setFormValue('');
    setFormMaxValue('20');
    setFormType('p1');
    setFormGradeType('p1');
    setFormTrimester('1er');
    const todayISO = new Date().toISOString().split('T')[0];
    setFormDate(todayISO);
    setFormDateDisplay(new Date(todayISO).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    setFormComment('');
    setStudentSearch('');
    setFormClassStudents([]);
    // Pour le primaire : reprendre la promotion filtrée dans la barre de filtre
    setFormDegree(filterDegree);
  };

  // Students shown in the Add-dialog dropdown: scoped to the selected class,
  // optionally filtered by the search box.
  const filteredStudents = formClassStudents.filter((s) => {
    if (!studentSearch) return true;
    const name = `${s.firstName} ${s.lastName}`.toLowerCase();
    return name.includes(studentSearch.toLowerCase());
  });

  // ── Add dialog: subjects filtered by the dialog-local promotion (formDegree) ──
  // For primary institutions, the user must select a promotion in the dialog to
  // see the relevant subjects (those matching the degree). For non-primary, all
  // subjects are shown.
  const formVisibleSubjects = isPrimaire && formDegree !== 'all'
    ? subjects.filter((s) => s.degree === formDegree || (!s.degree && formDegree === 'elementaire'))
    : subjects;

  // Classes shown in the Add dialog, also filtered by formDegree for primary.
  const formVisibleClasses = isPrimaire && formDegree !== 'all'
    ? classes.filter((cls) => classLevelToDegree(cls.level, cls.promotion) === formDegree)
    : classes;

  // ── Sujet actuellement sélectionné dans le dialogue Add ──
  // On le cherche par formSubjectId (si sélection via liste cliquable) ou
  // par formSubjectName (si l'utilisateur a tapé le nom manuellement).
  const selectedFormSubject = formSubjectId
    ? subjects.find((s) => s.id === formSubjectId)
    : subjects.find((s) => s.name === formSubjectName);

  // ── Max automatique selon le type d'évaluation (formGradeType) ──
  // - p1-p6 / devoir   → max = maxTJ du sujet
  // - examen_t1-t3     → max = maxEX du sujet
  // Si le sujet n'a pas de maxima défini, on retombe sur 20 par défaut.
  const computedMax = getGradeMaxForType(formGradeType, selectedFormSubject);

  // ── Effet : quand formGradeType change, on synchronise formType, formTrimester
  //    et formMaxValue. On reset aussi la note saisie car le max peut changer. ──
  //    SAUF si on est en train de charger une note existante (skipValueResetRef)
  //    ou si l'utilisateur a juste changé la matière (dans ce cas on garde la note).
  useEffect(() => {
    setFormType(formGradeType);
    const trimester = gradeTypeToTrimester(formGradeType);
    if (trimester) {
      setFormTrimester(trimester);
    }
    setFormMaxValue(String(computedMax));
    // Reset la note saisie car le max a changé — mais seulement si ce n'est pas
    // un chargement de note existante et que la note actuelle dépasse le nouveau max.
    if (!skipValueResetRef.current) {
      const currentVal = parseFloat(formValue);
      const newMax = computedMax;
      // Ne reset que si la note actuelle est invalide par rapport au nouveau max
      if (formValue && (!isNaN(currentVal)) && currentVal > newMax) {
        setFormValue('');
      }
    } else {
      // On était en train de charger une note existante — désactiver le flag
      // pour les prochains changements manuels.
      skipValueResetRef.current = false;
    }
  }, [formGradeType, computedMax]);

  // ── Effet : quand le sujet change, on recalcule le max selon le type actuel ──
  useEffect(() => {
    setFormMaxValue(String(computedMax));
  }, [selectedFormSubject?.id, computedMax]);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'teacher' || currentUser?.role === 'super_admin';
  const isTeacher = currentUser?.role === 'teacher';
  const currentTeacherId = currentUser?.teacher?.id || null;

  // ---- Export grades to PDF / Excel / Word ----
  // Builds a GET URL with the current filters + the caller's identity, then
  // triggers a browser download. The backend routes already implement
  // teacher scoping (admin sees all, teacher sees only their classes).
  const exportGrades = useCallback(
    async (format: 'pdf' | 'excel' | 'word') => {
      try {
        const params = new URLSearchParams();
        if (filterClassId && filterClassId !== 'all') params.set('classId', filterClassId);
        if (filterSubjectId && filterSubjectId !== 'all') params.set('subjectId', filterSubjectId);
        if (filterTrimester && filterTrimester !== 'all') params.set('trimester', filterTrimester);
        // Send the type filter + search query too, so the export honors the
        // EXACT same filter set the user sees in the UI (not just the
        // server-side filters). This way "Exporter" exports the filtered
        // search results, not the full list.
        if (filterType && filterType !== 'all') params.set('type', filterType);
        if (searchQuery.trim()) params.set('search', searchQuery.trim());
        if (schoolYear) params.set('schoolYear', schoolYear);
        if (currentUser?.id) params.set('userId', currentUser.id);
        if (currentUser?.role) params.set('role', currentUser.role);
        const url = `/api/grades/export/${format}?${params.toString()}`;
        // Trigger download via a hidden anchor (so the browser shows the
        // native "download" UX and keeps SPA navigation intact).
        const a = document.createElement('a');
        a.href = url;
        a.download = `notes.${format === 'excel' ? 'xlsx' : format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        addToast('success', 'Export lancé', `Export ${format.toUpperCase()} en cours…`);
      } catch (err) {
        addToast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur inconnue');
      }
    },
    [filterClassId, filterSubjectId, filterTrimester, filterType, searchQuery, schoolYear, currentUser, addToast]
  );

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
        {/* Export dropdown — PDF / Excel / Word. Visible to admin, teacher, super_admin. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              disabled={loading || grades.length === 0}
              title="Exporter les notes affichées"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Exporter</span>
              <span className="sm:hidden">Export</span>
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Exporter les notes</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => exportGrades('pdf')}
            >
              <FileType2 className="w-4 h-4 mr-2 text-red-600" />
              <span>Exporter en PDF</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => exportGrades('excel')}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
              <span>Exporter en Excel</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => exportGrades('word')}
            >
              <FileText className="w-4 h-4 mr-2 text-blue-600" />
              <span>Exporter en Word</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
          {/* Primary school: promotion (degree) selector first */}
          {isPrimaire && (
            <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
              <label className="text-xs font-semibold text-amber-800 dark:text-amber-400 block mb-1.5">
                🎓 Promotion (degré) — École Primaire
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={filterDegree === 'all' ? 'default' : 'outline'}
                  className={filterDegree === 'all' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
                  onClick={() => setFilterDegree('all')}
                >
                  Toutes les promotions
                </Button>
                {Object.entries(DEGREE_LABELS).map(([degId, degLabel]) => {
                  const count = classes.filter((cls) => classLevelToDegree(cls.level, cls.promotion) === degId).length;
                  return (
                    <Button
                      key={degId}
                      size="sm"
                      variant={filterDegree === degId ? 'default' : 'outline'}
                      className={filterDegree === degId ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
                      onClick={() => setFilterDegree(degId)}
                    >
                      {degLabel}
                      {count > 0 && (
                        <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                          {count} classe{count > 1 ? 's' : ''}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
              {filterDegree !== 'all' && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5">
                  ✓ Matières et classes filtrées pour : {DEGREE_LABELS[filterDegree]}
                </p>
              )}
            </div>
          )}

          {/* ── Barre de filtres ──
              Sur desktop : 2 lignes
                Ligne 1 : Classe | Titre | Sous-titre | Matière
                Ligne 2 : Trimestre | Type | Recherche
              Sur mobile : empilés en 1 colonne */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Classe */}
            <Select value={filterClassId} onValueChange={setFilterClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {visibleClasses.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 2. Titre (cascade niveau 1) */}
            <Select value={filterSubjectTitle} onValueChange={setFilterSubjectTitle}>
              <SelectTrigger>
                <SelectValue placeholder="Titre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les titres</SelectItem>
                {(() => {
                  // Liste unique des titres, triés par ordre canonique
                  const titles = Array.from(new Set(visibleSubjects.map((s) => s.title || 'Autres')))
                  const sorted = titles.sort((a, b) => {
                    const ia = TITLE_ORDER.indexOf(a)
                    const ib = TITLE_ORDER.indexOf(b)
                    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
                  })
                  return sorted.map((t) => {
                    const count = visibleSubjects.filter((s) => (s.title || 'Autres') === t).length
                    return (
                      <SelectItem key={t} value={t}>
                        {t} <span className="text-[10px] text-muted-foreground">({count})</span>
                      </SelectItem>
                    )
                  })
                })()}
              </SelectContent>
            </Select>

            {/* 3. Sous-titre (cascade niveau 2 — filtré par titre) */}
            <Select value={filterSubjectSubtitle} onValueChange={setFilterSubjectSubtitle}>
              <SelectTrigger>
                <SelectValue placeholder="Sous-titre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les sous-titres</SelectItem>
                {(() => {
                  // Sous-titres filtrés par le titre sélectionné
                  const subs = filterSubjectTitle !== 'all' ? subjectsFilteredByTitle : visibleSubjects
                  const subtitles = Array.from(new Set(subs.map((s) => s.subtitle || 'Autres'))).sort()
                  return subtitles.map((st) => {
                    const count = subs.filter((s) => (s.subtitle || 'Autres') === st).length
                    return (
                      <SelectItem key={st} value={st}>
                        {st} <span className="text-[10px] text-muted-foreground">({count})</span>
                      </SelectItem>
                    )
                  })
                })()}
              </SelectContent>
            </Select>

            {/* 4. Matière (cascade niveau 3 — filtrée par titre + sous-titre) */}
            <Select value={filterSubjectId} onValueChange={setFilterSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Matière" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  Toutes les matières ({subjectsFilteredBySubtitle.length})
                </SelectItem>
                {subjectsFilteredBySubtitle.length === 0 && (
                  <SelectItem value="_none" disabled>
                    Aucune matière{isPrimaire && filterDegree !== 'all' ? ' pour cette promotion' : ''}
                  </SelectItem>
                )}
                {subjectsFilteredBySubtitle.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Deuxième ligne de filtres : Trimestre | Type | Recherche */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
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
                {/* Périodes et examens groupés par trimestre */}
                {TRIMESTERS.map((t) => (
                  <div key={t.value}>
                    <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground bg-muted/40 sticky top-0">
                      {t.label}
                    </div>
                    {TRIMESTER_PERIODS[t.value].map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}{p.isExamen ? ' 📝' : ' ✓'}
                      </SelectItem>
                    ))}
                  </div>
                ))}
                {/* Types legacy */}
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground bg-muted/40 sticky top-0">
                    Autres
                  </div>
                  <SelectItem value="devoir">Devoir (legacy)</SelectItem>
                  <SelectItem value="controle">Contrôle</SelectItem>
                </div>
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

          {/* Récapitulatif des filtres matière actifs */}
          {(filterSubjectTitle !== 'all' || filterSubjectSubtitle !== 'all' || filterSubjectId !== 'all') && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold text-muted-foreground">Filtre matière :</span>
              {filterSubjectTitle !== 'all' && (
                <button
                  type="button"
                  onClick={() => { setFilterSubjectTitle('all'); setFilterSubjectSubtitle('all'); setFilterSubjectId('all'); }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {filterSubjectTitle}
                  <X className="w-3 h-3" />
                </button>
              )}
              {filterSubjectSubtitle !== 'all' && (
                <>
                  <span className="text-muted-foreground/60">›</span>
                  <button
                    type="button"
                    onClick={() => { setFilterSubjectSubtitle('all'); setFilterSubjectId('all'); }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors"
                  >
                    {filterSubjectSubtitle}
                    <X className="w-3 h-3" />
                  </button>
                </>
              )}
              {filterSubjectId !== 'all' && (() => {
                const selected = subjects.find((s) => s.id === filterSubjectId)
                return (
                  <>
                    <span className="text-muted-foreground/60">›</span>
                    <button
                      type="button"
                      onClick={() => setFilterSubjectId('all')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
                    >
                      {selected?.name || '—'}
                      <X className="w-3 h-3" />
                    </button>
                  </>
                )
              })()}
            </div>
          )}
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
                            <Badge
                              variant="outline"
                              className={
                                grade.type.startsWith('examen')
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 border-purple-200 dark:border-purple-900'
                                  : grade.type.startsWith('p')
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border-blue-200 dark:border-blue-900'
                                  : grade.type === 'devoir'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border-blue-200 dark:border-blue-900'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-400'
                              }
                            >
                              {GRADE_TYPE_LABELS[grade.type] || grade.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                grade.trimester === '1er'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                  : grade.trimester === '2eme'
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                              }
                            >
                              {TRIMESTER_LABELS[grade.trimester] || grade.trimester}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDateFR(grade.date)}</TableCell>
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
                        <span className="text-xs text-muted-foreground">{formatDateFR(grade.date)}</span>
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
            {/* Promotion (degré) — visible seulement pour les institutions primaires.
                L'utilisateur doit d'abord sélectionner une promotion pour voir
                les classes et matières correspondantes. */}
            {isPrimaire && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
                <label className="text-xs font-semibold text-amber-800 dark:text-amber-400 block mb-1.5">
                  🎓 Promotion (degré) — Étape 1
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(DEGREE_LABELS).map(([degId, degLabel]) => {
                    const count = classes.filter((cls) => classLevelToDegree(cls.level, cls.promotion) === degId).length;
                    const subCount = subjects.filter((s) => s.degree === degId).length;
                    return (
                      <Button
                        key={degId}
                        size="sm"
                        type="button"
                        variant={formDegree === degId ? 'default' : 'outline'}
                        className={formDegree === degId ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
                        onClick={() => {
                          setFormDegree(degId);
                          // Reset la classe et matière si elles ne correspondent plus
                          setFormClassId('');
                          setFormStudentId('');
                          setFormSubjectId('');
                          setFormSubjectName('');
                        }}
                      >
                        {degLabel}
                        {(count > 0 || subCount > 0) && (
                          <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                            {subCount} matière{subCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
                {formDegree === 'all' && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5">
                    ⚠ Sélectionnez d'abord une promotion pour voir les classes et matières correspondantes
                  </p>
                )}
              </div>
            )}

            {/* Classe — filtrée par la promotion sélectionnée (primaire) ou par l'année scolaire. */}
            <div className="grid gap-2">
              <Label>
                Classe *
                {isPrimaire && formDegree !== 'all' && (
                  <span className="text-xs text-amber-600 ml-1">({formVisibleClasses.length} classe{formVisibleClasses.length > 1 ? 's' : ''} pour cette promotion)</span>
                )}
              </Label>
              <Select
                value={formClassId}
                disabled={isPrimaire && formDegree === 'all'}
                onValueChange={(v) => {
                  setFormClassId(v);
                  setFormStudentId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    isPrimaire && formDegree === 'all'
                      ? "Sélectionnez une promotion d'abord"
                      : "Sélectionner une classe"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {formVisibleClasses.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      {isPrimaire && formDegree !== 'all'
                        ? 'Aucune classe pour cette promotion'
                        : `Aucune classe pour ${schoolYear}`}
                    </SelectItem>
                  ) : (
                    formVisibleClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                        {cls.level ? ` — ${cls.level}` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {formVisibleClasses.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formVisibleClasses.length} classe{formVisibleClasses.length > 1 ? 's' : ''} disponible{formVisibleClasses.length > 1 ? 's' : ''} pour l'année {schoolYear}
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
            {/* Matière — sélection hiérarchique en cascade :
                TITRE → SOUS-TITRE → MATIÈRE.
                Les 3 niveaux sont lus directement depuis les champs `title`,
                `subtitle`, `name` des subjects (stockés en DB). Plus de mappage
                côté frontend.
                Pour le primaire, on filtre d'abord par promotion (degré). */}
            <div className="grid gap-2">
              <Label htmlFor="form-subject">
                Matière *
                {isPrimaire && formDegree !== 'all' && (
                  <span className="text-xs text-amber-600 ml-1">({formVisibleSubjects.length} matière{formVisibleSubjects.length > 1 ? 's' : ''} pour cette promotion)</span>
                )}
              </Label>

              {isPrimaire && formDegree === 'all' ? (
                <div className="p-3 rounded-md bg-muted/40 text-xs text-muted-foreground text-center">
                  ⚠ Sélectionnez d'abord une promotion ci-dessus pour voir les matières correspondantes
                </div>
              ) : formVisibleSubjects.length === 0 ? (
                <div className="p-3 rounded-md bg-muted/40 text-xs text-muted-foreground text-center">
                  Aucune matière trouvée. {isPrimaire ? 'Ajoutez des matières dans Paramètres → Institution.' : ''}
                </div>
              ) : (
                (() => {
                  // Construire la hiérarchie à partir des subjects filtrés
                  const hierarchy = buildSubjectHierarchy(formVisibleSubjects);

                  // Subjects filtrés par titre + sous-titre sélectionnés
                  const filteredByTitle = formSubjectTitle
                    ? hierarchy.find((h) => h.title === formSubjectTitle)
                    : null;
                  const filteredBySubtitle = filteredByTitle && formSubjectSubtitle
                    ? filteredByTitle.subtitles.find((s) => s.subtitle === formSubjectSubtitle)
                    : null;
                  const finalSubjects = filteredBySubtitle
                    ? filteredBySubtitle.subjects
                    : filteredByTitle
                      ? filteredByTitle.subtitles.flatMap((s) => s.subjects)
                      : formVisibleSubjects;

                  return (
                    <>
                      {/* Cascade : 3 Selects côte à côte sur desktop, empilés sur mobile */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* 1. TITRE */}
                        <Select
                          value={formSubjectTitle || '_all'}
                          onValueChange={(v) => {
                            const newTitle = v === '_all' ? '' : v;
                            setFormSubjectTitle(newTitle);
                            // Reset sous-titre et matière quand le titre change
                            setFormSubjectSubtitle('');
                            setFormSubjectName('');
                            setFormSubjectId('');
                          }}
                        >
                          <SelectTrigger className="text-xs sm:text-sm min-h-[2.5rem] h-auto [&_[data-slot=select-value]]:whitespace-normal [&_[data-slot=select-value]]:break-words [&_[data-slot=select-value]]:line-clamp-none">
                            <SelectValue placeholder="Titre…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_all">Tous les titres</SelectItem>
                            {hierarchy.map((h) => (
                              <SelectItem key={h.title} value={h.title}>
                                {h.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* 2. SOUS-TITRE — filtré par titre sélectionné */}
                        <Select
                          value={formSubjectSubtitle || '_all'}
                          onValueChange={(v) => {
                            const newSubtitle = v === '_all' ? '' : v;
                            setFormSubjectSubtitle(newSubtitle);
                            // Reset matière quand le sous-titre change
                            setFormSubjectName('');
                            setFormSubjectId('');
                          }}
                          disabled={!formSubjectTitle}
                        >
                          <SelectTrigger className="text-xs sm:text-sm min-h-[2.5rem] h-auto [&_[data-slot=select-value]]:whitespace-normal [&_[data-slot=select-value]]:break-words [&_[data-slot=select-value]]:line-clamp-none">
                            <SelectValue placeholder={formSubjectTitle ? 'Sous-titre…' : 'Choisir un titre d\'abord'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_all">Tous les sous-titres</SelectItem>
                            {(filteredByTitle?.subtitles || []).map((s) => (
                              <SelectItem key={s.subtitle} value={s.subtitle}>
                                {s.subtitle}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* 3. MATIÈRE — filtrée par titre + sous-titre sélectionnés */}
                        <Select
                          value={formSubjectId || '_none'}
                          onValueChange={(v) => {
                            if (v === '_none') return;
                            const selected = finalSubjects.find((s) => s.id === v);
                            if (selected) {
                              setFormSubjectId(selected.id);
                              setFormSubjectName(selected.name);
                              // S'assurer que title/subtitle sont cohérents
                              if (!formSubjectTitle && selected.title) setFormSubjectTitle(selected.title);
                              if (!formSubjectSubtitle && selected.subtitle) setFormSubjectSubtitle(selected.subtitle);
                            }
                          }}
                          disabled={finalSubjects.length === 0}
                        >
                          <SelectTrigger className="text-xs sm:text-sm min-h-[2.5rem] h-auto [&_[data-slot=select-value]]:whitespace-normal [&_[data-slot=select-value]]:break-words [&_[data-slot=select-value]]:line-clamp-none">
                            <SelectValue placeholder={finalSubjects.length === 0 ? 'Aucune matière' : 'Matière…'} />
                          </SelectTrigger>
                          <SelectContent>
                            {finalSubjects.length === 0 ? (
                              <SelectItem value="_none" disabled>Aucune matière</SelectItem>
                            ) : (
                              finalSubjects.map((sub) => (
                                <SelectItem key={sub.id} value={sub.id}>
                                  {sub.name}
                                  {sub.maxTJ != null && (
                                    <span className="ml-2 text-[10px] text-muted-foreground">TJ {sub.maxTJ}</span>
                                  )}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Récapitulatif de la sélection en cours */}
                      {formSubjectId && formSubjectName && (
                        <div className="text-[10px] sm:text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                          <span className="font-semibold text-foreground">Sélection :</span>
                          {formSubjectTitle && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary break-words whitespace-normal min-w-0 max-w-full">{formSubjectTitle}</span>}
                          {formSubjectSubtitle && <span className="text-muted-foreground/60">›</span>}
                          {formSubjectSubtitle && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 break-words whitespace-normal min-w-0 max-w-full">{formSubjectSubtitle}</span>}
                          <span className="text-muted-foreground/60">›</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold break-words whitespace-normal min-w-0 max-w-full">{formSubjectName}</span>
                        </div>
                      )}

                      {/* Champ texte libre (fallback) pour autocomplétion
                          ou saisie d'une matière non listée */}
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Rechercher / saisir une matière manuellement
                        </summary>
                        <Input
                          id="form-subject"
                          value={formSubjectName}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFormSubjectName(v);
                            // Try to match against a known subject
                            const matched = formVisibleSubjects.find((s) => s.name === v);
                            if (matched) {
                              setFormSubjectId(matched.id);
                              setFormSubjectTitle(matched.title || '');
                              setFormSubjectSubtitle(matched.subtitle || '');
                            } else {
                              setFormSubjectId('');
                            }
                          }}
                          placeholder="Rechercher ou taper une matière..."
                          list="subjects-list-dialog"
                          className="mt-2"
                        />
                        <datalist id="subjects-list-dialog">
                          {formVisibleSubjects.map((sub) => (
                            <option key={sub.id} value={sub.name} />
                          ))}
                        </datalist>
                      </details>
                    </>
                  );
                })()
              )}
            </div>
            {/* ── Trimestres avec dropdowns de périodes ──
                Chaque trimestre est un dropdown contenant ses périodes :
                - 1er Trimestre : 1ère Période, 2ème Période, Examen T1
                - 2ème Trimestre : 3ème Période, 4ème Période, Examen T2
                - 3ème Trimestre : 5ème Période, 6ème Période, Examen T3
                Quand on sélectionne une période dans un dropdown, le max
                correspondant s'affiche et la zone de saisie devient active. */}
            <div className="grid gap-2">
              <Label className="flex flex-col gap-0.5">
                <span>Trimestre &amp; Période *</span>
                {selectedFormSubject && (
                  <span className="text-xs text-muted-foreground font-normal block">
                    (max période : {selectedFormSubject.maxTJ ?? '—'} · max examen : {selectedFormSubject.maxEX ?? '—'})
                  </span>
                )}
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TRIMESTERS.map((t) => {
                  const periods = TRIMESTER_PERIODS[t.value];
                  const isActiveTrimester = formTrimester === t.value;
                  return (
                    <div key={t.value} className="flex flex-col gap-1">
                      <span className={`text-xs font-medium ${isActiveTrimester ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {t.label}
                      </span>
                      <Select
                        value={isActiveTrimester ? formGradeType : '_none'}
                        onValueChange={(v) => {
                          if (v !== '_none') {
                            setFormGradeType(v as GradeType);
                          }
                        }}
                      >
                        <SelectTrigger className={isActiveTrimester ? 'border-emerald-400 dark:border-emerald-700' : ''}>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none" disabled>— Sélectionner —</SelectItem>
                          {periods.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                              {p.isExamen ? ' 📝' : ' ✓'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
              {formGradeType && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  ✓ Sélectionné : <strong>{GRADE_TYPE_LABELS[formGradeType]}</strong>
                  {gradeTypeToTrimester(formGradeType) && ` · ${TRIMESTER_LABELS[gradeTypeToTrimester(formGradeType)!]}`}
                </p>
              )}
            </div>

            {/* ── Zone de saisie de la note ──
                Le max est automatiquement calculé selon le type d'évaluation :
                - Périodes (p1-p6) → max = maxTJ du sujet
                - Examens         → max = maxEX du sujet */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>
                  {formGradeType.startsWith('examen') ? 'Note d\'examen *' : `Note ${GRADE_TYPE_LABELS[formGradeType] || ''} *`}
                </Label>
                <Input
                  type="number"
                  min="0"
                  max={formMaxValue}
                  step="0.5"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder={`0 à ${formMaxValue}`}
                />
              </div>
              <div className="grid gap-2">
                <Label>
                  / Maximum
                  <span className="text-xs text-muted-foreground ml-1 font-normal">
                    ({formGradeType.startsWith('examen') ? 'examen' : 'période'})
                  </span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={formMaxValue}
                  onChange={(e) => setFormMaxValue(e.target.value)}
                  className="bg-muted/40"
                />
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
            <Button
              onClick={handleAddGrade}
              disabled={saving || (isPrimaire && formDegree === 'all')}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isPrimaire && formDegree === 'all' ? 'Sélectionnez une promotion' : 'Ajouter'}
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
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* ── Matière (modifiable) — sélection hiérarchique en cascade
                    TITRE → SOUS-TITRE → MATIÈRE ── */}
            <div className="grid gap-2">
              <Label htmlFor="edit-subject">Matière *</Label>
              {(() => {
                // Pour l'édition, on utilise formVisibleSubjects si primaire+degree,
                // sinon tous les subjects.
                const editVisibleSubjects = isPrimaire && formDegree !== 'all'
                  ? formVisibleSubjects
                  : subjects;

                if (editVisibleSubjects.length === 0) {
                  return (
                    <div className="p-3 rounded-md bg-muted/40 text-xs text-muted-foreground text-center">
                      Aucune matière disponible.
                    </div>
                  );
                }

                const hierarchy = buildSubjectHierarchy(editVisibleSubjects);

                const filteredByTitle = formSubjectTitle
                  ? hierarchy.find((h) => h.title === formSubjectTitle)
                  : null;
                const filteredBySubtitle = filteredByTitle && formSubjectSubtitle
                  ? filteredByTitle.subtitles.find((s) => s.subtitle === formSubjectSubtitle)
                  : null;
                const finalSubjects = filteredBySubtitle
                  ? filteredBySubtitle.subjects
                  : filteredByTitle
                    ? filteredByTitle.subtitles.flatMap((s) => s.subjects)
                    : editVisibleSubjects;

                return (
                  <>
                    {/* Cascade : 3 Selects côte à côte sur desktop, empilés sur mobile */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* 1. TITRE */}
                      <Select
                        value={formSubjectTitle || '_all'}
                        onValueChange={(v) => {
                          const newTitle = v === '_all' ? '' : v;
                          setFormSubjectTitle(newTitle);
                          setFormSubjectSubtitle('');
                          setFormSubjectName('');
                          setFormSubjectId('');
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Titre…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all">Tous les titres</SelectItem>
                          {hierarchy.map((h) => (
                            <SelectItem key={h.title} value={h.title}>
                              {h.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* 2. SOUS-TITRE */}
                      <Select
                        value={formSubjectSubtitle || '_all'}
                        onValueChange={(v) => {
                          const newSubtitle = v === '_all' ? '' : v;
                          setFormSubjectSubtitle(newSubtitle);
                          setFormSubjectName('');
                          setFormSubjectId('');
                        }}
                        disabled={!formSubjectTitle}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={formSubjectTitle ? 'Sous-titre…' : 'Choisir un titre d\'abord'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all">Tous les sous-titres</SelectItem>
                          {(filteredByTitle?.subtitles || []).map((s) => (
                            <SelectItem key={s.subtitle} value={s.subtitle}>
                              {s.subtitle}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* 3. MATIÈRE */}
                      <Select
                        value={formSubjectId || '_none'}
                        onValueChange={(v) => {
                          if (v === '_none') return;
                          const selected = finalSubjects.find((s) => s.id === v);
                          if (selected) {
                            setFormSubjectId(selected.id);
                            setFormSubjectName(selected.name);
                            if (!formSubjectTitle && selected.title) setFormSubjectTitle(selected.title);
                            if (!formSubjectSubtitle && selected.subtitle) setFormSubjectSubtitle(selected.subtitle);
                          }
                        }}
                        disabled={finalSubjects.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={finalSubjects.length === 0 ? 'Aucune matière' : 'Matière…'} />
                        </SelectTrigger>
                        <SelectContent>
                          {finalSubjects.length === 0 ? (
                            <SelectItem value="_none" disabled>Aucune matière</SelectItem>
                          ) : (
                            finalSubjects.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id}>
                                {sub.name}
                                {sub.maxTJ != null && (
                                  <span className="ml-2 text-[10px] text-muted-foreground">TJ {sub.maxTJ}</span>
                                )}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Récapitulatif de la sélection en cours */}
                    {formSubjectId && formSubjectName && (
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                        <span className="font-semibold text-foreground">Sélection :</span>
                        {formSubjectTitle && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">{formSubjectTitle}</span>}
                        {formSubjectSubtitle && <span className="text-muted-foreground/60">›</span>}
                        {formSubjectSubtitle && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">{formSubjectSubtitle}</span>}
                        <span className="text-muted-foreground/60">›</span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold">{formSubjectName}</span>
                      </div>
                    )}

                    {/* Champ texte libre (fallback) */}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Rechercher / saisir une matière manuellement
                      </summary>
                      <Input
                        id="edit-subject"
                        value={formSubjectName}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFormSubjectName(v);
                          const matched = editVisibleSubjects.find((s) => s.name === v);
                          if (matched) {
                            setFormSubjectId(matched.id);
                            setFormSubjectTitle(matched.title || '');
                            setFormSubjectSubtitle(matched.subtitle || '');
                          } else {
                            setFormSubjectId('');
                          }
                        }}
                        placeholder="Rechercher ou taper une matière..."
                        list="subjects-list-edit"
                        className="mt-2"
                      />
                      <datalist id="subjects-list-edit">
                        {editVisibleSubjects.map((sub) => (
                          <option key={sub.id} value={sub.name} />
                        ))}
                      </datalist>
                    </details>
                  </>
                );
              })()}
            </div>

            {/* ── Trimestres avec dropdowns de périodes (édition) ── */}
            <div className="grid gap-2">
              <Label className="flex flex-col gap-0.5">
                <span>Trimestre &amp; Période</span>
                {selectedFormSubject && (
                  <span className="text-xs text-muted-foreground font-normal block">
                    (max période : {selectedFormSubject.maxTJ ?? '—'} · max examen : {selectedFormSubject.maxEX ?? '—'})
                  </span>
                )}
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TRIMESTERS.map((t) => {
                  const periods = TRIMESTER_PERIODS[t.value];
                  const isActiveTrimester = formTrimester === t.value;
                  return (
                    <div key={t.value} className="flex flex-col gap-1">
                      <span className={`text-xs font-medium ${isActiveTrimester ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {t.label}
                      </span>
                      <Select
                        value={isActiveTrimester ? formGradeType : '_none'}
                        onValueChange={(v) => {
                          if (v !== '_none') {
                            setFormGradeType(v as GradeType);
                          }
                        }}
                      >
                        <SelectTrigger className={isActiveTrimester ? 'border-emerald-400 dark:border-emerald-700' : ''}>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none" disabled>— Sélectionner —</SelectItem>
                          {periods.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                              {p.isExamen ? ' 📝' : ' ✓'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
              {formGradeType && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  ✓ Sélectionné : <strong>{GRADE_TYPE_LABELS[formGradeType]}</strong>
                  {gradeTypeToTrimester(formGradeType) && ` · ${TRIMESTER_LABELS[gradeTypeToTrimester(formGradeType)!]}`}
                </p>
              )}
            </div>

            {/* Note + Max */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>
                  {formGradeType.startsWith('examen') ? 'Note d\'examen *' : `Note ${GRADE_TYPE_LABELS[formGradeType] || ''} *`}
                </Label>
                <Input
                  type="number"
                  min="0"
                  max={formMaxValue}
                  step="0.5"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder={`0 à ${formMaxValue}`}
                />
              </div>
              <div className="grid gap-2">
                <Label>
                  / Maximum
                  <span className="text-xs text-muted-foreground ml-1 font-normal">
                    ({formGradeType.startsWith('examen') ? 'examen' : 'période'})
                  </span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={formMaxValue}
                  onChange={(e) => setFormMaxValue(e.target.value)}
                  className="bg-muted/40"
                />
              </div>
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
