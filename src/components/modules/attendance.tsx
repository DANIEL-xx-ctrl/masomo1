'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ClipboardCheck,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Save,
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowLeft,
  RefreshCw,
  FileDown,
  FileSpreadsheet,
  Printer,
  CalendarIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppStore } from '@/lib/store';
import { withSchoolYear } from '@/lib/utils';
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_COLORS,
  SCHOOL_YEARS,
} from '@/lib/constants';
import type { Attendance, AttendanceStatus, Class, Student } from '@/lib/types';

interface StudentAttendance {
  student: Student;
  status: AttendanceStatus;
  comment: string;
  attendanceId?: string;
}

interface AttendanceListGroup {
  date: string;
  className: string;
  classId: string;
  records: Attendance[];
  present: number;
  absent: number;
  late: number;
  excused: number;
}

type ViewMode = 'list' | 'create' | 'edit';

// Helper to group attendance records
function groupAttendanceRecords(records: Attendance[]): AttendanceListGroup[] {
  const groupMap: Record<string, AttendanceListGroup> = {};
  for (const record of records) {
    const student = record.student as Record<string, unknown>;
    const currentClass = student?.currentClass as { id?: string; name?: string } | undefined;
    const classId = currentClass?.id || (student?.classId as string) || 'unknown';
    const className = currentClass?.name || ((student?.class as Record<string, unknown>)?.name as string) || 'Classe inconnue';
    const key = `${record.date}_${classId}`;

    if (!groupMap[key]) {
      groupMap[key] = {
        date: record.date,
        className,
        classId: classId as string,
        records: [],
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      };
    }

    groupMap[key].records.push(record);
    if (record.status === 'present') groupMap[key].present++;
    else if (record.status === 'absent') groupMap[key].absent++;
    else if (record.status === 'late') groupMap[key].late++;
    else if (record.status === 'excused') groupMap[key].excused++;
  }

  // Sort by date descending (most recent first)
  return Object.values(groupMap).sort((a, b) => b.date.localeCompare(a.date));
}

export default function AttendanceModule() {
  const addToast = useAppStore((s) => s.addToast);
  const globalSchoolYear = useAppStore((s) => s.schoolYear);
  const currentUser = useAppStore((s) => s.currentUser);

  // Role-based access control.
  // Only admins, super-admins and teachers can create / edit / delete
  // attendance lists. Students, parents and staff get a READ-ONLY view: they
  // can browse and export existing lists but cannot modify them.
  const role = currentUser?.role;
  const canManage = role === 'admin' || role === 'super_admin' || role === 'teacher';
  const isReadOnly = !canManage;

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // List view filter state
  const [listSchoolYear, setListSchoolYear] = useState<string>(globalSchoolYear);
  const [listClassFilter, setListClassFilter] = useState<string>('all');
  const [listDateFilter, setListDateFilter] = useState<string>('');

  // Form state (for create/edit)
  const [formSchoolYear, setFormSchoolYear] = useState<string>(globalSchoolYear);
  const [formClassId, setFormClassId] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Data state
  const [classes, setClasses] = useState<Class[]>([]);
  const [studentsAttendance, setStudentsAttendance] = useState<StudentAttendance[]>([]);
  const [attendanceGroups, setAttendanceGroups] = useState<AttendanceListGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');
  const [searchList, setSearchList] = useState('');
  const [editDate, setEditDate] = useState<string>('');

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; date: string; className: string; studentIds: string[] }>({
    open: false,
    date: '',
    className: '',
    studentIds: [],
  });
  const [deleting, setDeleting] = useState(false);

  // Use refs to avoid stale closures
  const listSchoolYearRef = useRef(listSchoolYear);
  const listClassFilterRef = useRef(listClassFilter);
  const listDateFilterRef = useRef(listDateFilter);
  listSchoolYearRef.current = listSchoolYear;
  listClassFilterRef.current = listClassFilter;
  listDateFilterRef.current = listDateFilter;

  // Fetch classes when school year changes
  const activeSchoolYear = viewMode === 'list' ? listSchoolYear : formSchoolYear;
  useEffect(() => {
    async function fetchClasses() {
      try {
        const res = await fetch(withSchoolYear('/api/classes', activeSchoolYear));
        const data = await res.json();
        setClasses(data.classes || []);
      } catch {
        addToast('error', 'Erreur', 'Impossible de charger les classes');
      }
    }
    fetchClasses();
  }, [activeSchoolYear, addToast]);

  // Direct fetch function that doesn't depend on state closures
  const fetchAndSetAttendanceGroups = useCallback(async (schoolYear?: string, classFilter?: string, dateFilter?: string) => {
    const sy = schoolYear || listSchoolYearRef.current;
    const cf = classFilter || listClassFilterRef.current;
    const df = dateFilter !== undefined ? dateFilter : listDateFilterRef.current;

    setListLoading(true);
    try {
      const params = new URLSearchParams();
      if (cf && cf !== 'all') params.set('classId', cf);
      if (df) params.set('date', df);
      const baseUrl = `/api/attendance${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(withSchoolYear(baseUrl, sy));
      const data = await res.json();
      const records: Attendance[] = data.attendance || [];
      const groups = groupAttendanceRecords(records);
      setAttendanceGroups(groups);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les listes de présence');
    } finally {
      setListLoading(false);
    }
  }, [addToast]);

  // Auto-fetch when list view is active
  useEffect(() => {
    if (viewMode === 'list') {
      fetchAndSetAttendanceGroups();
    }
  }, [viewMode, listSchoolYear, listClassFilter, listDateFilter, fetchAndSetAttendanceGroups]);

  // Load students for create/edit form
  const loadStudents = useCallback(async (classId: string, date: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        withSchoolYear(
          `/api/students?forSelection=true&limit=500&classId=${classId}`,
          formSchoolYear
        )
      );
      const data = await res.json();
      const students: Student[] = data.students || [];

      if (students.length === 0) {
        setStudentsAttendance([]);
        setLoading(false);
        return;
      }

      // Initialize with 'present' default
      const initialList = students.map((student) => ({
        student,
        status: 'present' as AttendanceStatus,
        comment: '',
      }));
      setStudentsAttendance(initialList);

      // Fetch existing attendance for this class + date
      try {
        const attRes = await fetch(
          withSchoolYear(
            `/api/attendance?classId=${classId}&date=${date}`,
            formSchoolYear
          )
        );
        const attData = await attRes.json();
        const existing: Attendance[] = attData.attendance || [];

        if (existing.length > 0) {
          setStudentsAttendance((prev) =>
            prev.map((sa) => {
              const record = existing.find((a) => a.studentId === sa.student.id);
              if (record) {
                return {
                  ...sa,
                  status: record.status as AttendanceStatus,
                  comment: record.comment || '',
                  attendanceId: record.id,
                };
              }
              return sa;
            })
          );
        }
      } catch {
        // Silently fail - existing attendance is optional
      }
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les élèves');
    } finally {
      setLoading(false);
    }
  }, [formSchoolYear, addToast]);

  // Update a student's attendance status
  const updateStatus = (studentId: string, status: AttendanceStatus) => {
    setStudentsAttendance((prev) =>
      prev.map((sa) =>
        sa.student.id === studentId ? { ...sa, status } : sa
      )
    );
  };

  // Update a student's comment
  const updateComment = (studentId: string, comment: string) => {
    setStudentsAttendance((prev) =>
      prev.map((sa) =>
        sa.student.id === studentId ? { ...sa, comment } : sa
      )
    );
  };

  // Save all attendance records (batch) - ROBUST version
  const handleSave = async () => {
    if (studentsAttendance.length === 0) return;
    setSaving(true);
    try {
      const records = studentsAttendance.map((sa) => ({
        studentId: sa.student.id,
        date: formDate,
        status: sa.status,
        comment: sa.comment || undefined,
      }));

      console.log('[Attendance] Saving records:', records.length, 'date:', formDate);

      const res = await fetch(withSchoolYear('/api/attendance', formSchoolYear), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '', 'x-institution-id': currentUser?.institutionId || '', 'x-user-role': currentUser?.role || '' },
        body: JSON.stringify({ records }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erreur serveur');
      }

      const savedDate = formDate;
      const savedYear = formSchoolYear;

      console.log('[Attendance] Save successful, fetching updated list for year:', savedYear);

      addToast('success', 'Présences enregistrées', `Appel fait pour le ${new Date(savedDate).toLocaleDateString('fr-FR')}`);

      // Reset form state
      setStudentsAttendance([]);
      setEditDate('');
      setFormClassId('');

      // Switch to list view
      setViewMode('list');
      setListSchoolYear(savedYear);
      setListClassFilter('all');
      setListDateFilter('');

      // DIRECTLY fetch the updated data (don't rely on useEffect timing)
      await fetchAndSetAttendanceGroups(savedYear, 'all', '');

      console.log('[Attendance] List refreshed successfully');
    } catch (error) {
      console.error('[Attendance] Save error:', error);
      addToast('error', 'Erreur', "Impossible d'enregistrer les présences");
    } finally {
      setSaving(false);
    }
  };

  // Mark all as present
  const markAllPresent = () => {
    setStudentsAttendance((prev) =>
      prev.map((sa) => ({ ...sa, status: 'present' as AttendanceStatus }))
    );
  };

  // Mark all as absent
  const markAllAbsent = () => {
    setStudentsAttendance((prev) =>
      prev.map((sa) => ({ ...sa, status: 'absent' as AttendanceStatus }))
    );
  };

  // Delete attendance list
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const studentIds = deleteDialog.studentIds.join(',');
      const res = await fetch(
        withSchoolYear(
          `/api/attendance?date=${deleteDialog.date}&studentIds=${studentIds}`,
          listSchoolYear
        ),
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error();
      addToast('success', 'Supprimé', 'Liste de présence supprimée avec succès');
      setDeleteDialog({ open: false, date: '', className: '', studentIds: [] });
      fetchAndSetAttendanceGroups();
    } catch {
      addToast('error', 'Erreur', 'Impossible de supprimer la liste de présence');
    } finally {
      setDeleting(false);
    }
  };

  // Edit attendance list
  const handleEdit = (group: AttendanceListGroup) => {
    setFormSchoolYear(listSchoolYear);
    setFormClassId(group.classId);
    setFormDate(group.date);
    setEditDate(group.date);
    setViewMode('edit');
    loadStudents(group.classId, group.date);
  };

  // Start creating new list
  const handleCreateNew = () => {
    setFormSchoolYear(listSchoolYear);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormClassId('');
    setStudentsAttendance([]);
    setEditDate('');
    setViewMode('create');
  };

  // Export handlers
  const [exporting, setExporting] = useState<string | null>(null)

  const getExportParams = () => {
    const params = new URLSearchParams()
    params.set('schoolYear', listSchoolYear)
    if (listClassFilter && listClassFilter !== 'all') params.set('classId', listClassFilter)
    if (listDateFilter) params.set('date', listDateFilter)
    return params
  }

  const handleExportPDF = async () => {
    setExporting('pdf')
    try {
      const params = getExportParams()
      const res = await fetch(`/api/attendance/export/pdf?${params.toString()}`)
      if (!res.ok) {
        // Surface the server's error message so the user knows WHY it failed
        // (e.g. "Aucune présence à exporter…" vs a real 500).
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || `Erreur ${res.status} lors de l'export PDF`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `presences-${listSchoolYear}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      addToast('success', 'Export PDF', 'Le fichier PDF a été téléchargé avec succès')
    } catch (err) {
      addToast(
        'error',
        'Export PDF impossible',
        err instanceof Error ? err.message : 'Erreur inconnue'
      )
    } finally {
      setExporting(null)
    }
  }

  const handleExportExcel = async () => {
    setExporting('excel')
    try {
      const params = getExportParams()
      const res = await fetch(`/api/attendance/export/excel?${params.toString()}`)
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || `Erreur ${res.status} lors de l'export Excel`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `presences-${listSchoolYear}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      addToast('success', 'Export Excel', 'Le fichier Excel a été téléchargé avec succès')
    } catch (err) {
      addToast(
        'error',
        'Export Excel impossible',
        err instanceof Error ? err.message : 'Erreur inconnue'
      )
    } finally {
      setExporting(null)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Load students when creating/editing
  const handleLoadStudents = () => {
    if (!formClassId || !formDate) {
      addToast('warning', 'Champs requis', 'Veuillez sélectionner une classe et une date');
      return;
    }
    loadStudents(formClassId, formDate);
  };

  // Stats
  const presentCount = studentsAttendance.filter((sa) => sa.status === 'present').length;
  const absentCount = studentsAttendance.filter((sa) => sa.status === 'absent').length;
  const lateCount = studentsAttendance.filter((sa) => sa.status === 'late').length;
  const excusedCount = studentsAttendance.filter((sa) => sa.status === 'excused').length;

  // Filter students by search
  const filteredStudents = studentsAttendance.filter((sa) => {
    if (!searchStudent) return true;
    const q = searchStudent.toLowerCase();
    return (
      sa.student.firstName.toLowerCase().includes(q) ||
      sa.student.lastName.toLowerCase().includes(q)
    );
  });

  // Quick status filter (set by clicking badges)
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | ''>('');

  // Combined search + status filter for groups
  const filteredGroups = attendanceGroups
    .map((g) => {
      const q = searchList.toLowerCase();
      const hasSearch = q.length > 0;
      const hasStatusFilter = statusFilter !== '';

      // If no filters, return all
      if (!hasSearch && !hasStatusFilter) return g;

      // Check if group header matches search
      const headerMatch = hasSearch && (
        g.className.toLowerCase().includes(q) ||
        g.date.includes(q) ||
        new Date(g.date).toLocaleDateString('fr-FR').toLowerCase().includes(q)
      );

      // Filter records within the group
      const matchedRecords = g.records.filter((record, idx) => {
        // Status filter check
        if (hasStatusFilter && record.status !== statusFilter) return false;

        // If no text search, status filter is enough
        if (!hasSearch) return true;

        const lastName = (record.student?.lastName || '').toLowerCase();
        const firstName = (record.student?.firstName || '').toLowerCase();
        const studentName = `${lastName} ${firstName}`;
        const initials = `${lastName.charAt(0)}${firstName.charAt(0)}`;
        const statusLabel = (ATTENDANCE_STATUS_LABELS[record.status as AttendanceStatus] || record.status).toLowerCase();
        const comment = (record.comment || '').toLowerCase();
        const orderNum = String(idx + 1);
        return (
          studentName.includes(q) ||
          lastName.startsWith(q) ||
          firstName.startsWith(q) ||
          initials.includes(q) ||
          statusLabel.includes(q) ||
          comment.includes(q) ||
          orderNum === q
        );
      });

      // If header matches (search only), show all records that pass status filter
      if (headerMatch) {
        if (hasStatusFilter) {
          const statusFiltered = g.records.filter((r) => r.status === statusFilter);
          return statusFiltered.length > 0 ? { ...g, records: statusFiltered } : null;
        }
        return g;
      }

      if (matchedRecords.length > 0) {
        return { ...g, records: matchedRecords };
      }
      return null;
    })
    .filter((g): g is AttendanceListGroup => g !== null);

  // Handle status badge click
  const handleStatusFilterClick = (status: AttendanceStatus) => {
    if (statusFilter === status) {
      setStatusFilter(''); // Toggle off
    } else {
      setStatusFilter(status);
      setSearchList(''); // Clear text search when using status filter
    }
  };

  // Selected class name
  const selectedClassName = classes.find((c) => c.id === formClassId)?.name || '';

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'absent':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'late':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'excused':
        return <AlertCircle className="w-4 h-4 text-sky-600" />;
      default:
        return null;
    }
  };

  // =============================================
  // RENDER: List View (default)
  // =============================================
  const renderListView = () => (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Année scolaire</Label>
              <Select value={listSchoolYear} onValueChange={setListSchoolYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_YEARS.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 pr-5">
              <Label className="text-sm font-medium">Classe</Label>
              <Select value={listClassFilter} onValueChange={setListClassFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les classes</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} — {cls.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 border-l border-border/50 pl-5">
              <Label className="text-sm font-medium">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`h-10 w-full justify-start text-left font-normal overflow-hidden ${!listDateFilter ? 'text-muted-foreground' : ''}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {listDateFilter
                        ? format(new Date(listDateFilter + 'T00:00:00'), 'dd MMM yyyy', { locale: fr })
                        : 'Choisir une date'}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex items-center justify-between px-3 pb-2 pt-3">
                    <span className="text-sm font-medium">
                      {listDateFilter
                        ? format(new Date(listDateFilter + 'T00:00:00'), 'dd MMMM yyyy', { locale: fr })
                        : 'Aucune date sélectionnée'}
                    </span>
                    {listDateFilter && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setListDateFilter('')}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Effacer
                      </Button>
                    )}
                  </div>
                  <Calendar
                    mode="single"
                    selected={listDateFilter ? new Date(listDateFilter + 'T00:00:00') : undefined}
                    onSelect={(date) => setListDateFilter(date ? format(date, 'yyyy-MM-dd') : '')}
                    locale={fr}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Rechercher</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher élève, statut, commentaire..."
                  value={searchList}
                  onChange={(e) => { setSearchList(e.target.value); if (statusFilter) setStatusFilter(''); }}
                  className="h-10 pl-9 pr-9"
                />
                {(searchList || statusFilter) && (
                  <button
                    type="button"
                    onClick={() => { setSearchList(''); setStatusFilter(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
              {statusFilter && (
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                    statusFilter === 'present' ? 'bg-emerald-100 text-emerald-700' :
                    statusFilter === 'absent' ? 'bg-red-100 text-red-700' :
                    statusFilter === 'late' ? 'bg-amber-100 text-amber-700' :
                    'bg-sky-100 text-sky-700'
                  }`}>
                    {getStatusIcon(statusFilter)}
                    {ATTENDANCE_STATUS_LABELS[statusFilter]}
                  </span>
                  <span className="text-xs text-muted-foreground">• cliquez pour désactiver</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium invisible">Action</Label>
              {statusFilter || searchList ? (
                <Button
                  variant="destructive"
                  onClick={() => { setStatusFilter(''); setSearchList(''); }}
                  className="w-full"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Réinitialiser
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => fetchAndSetAttendanceGroups()}
                  disabled={listLoading}
                  className="w-full"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${listLoading ? 'animate-spin' : ''}`} />
                  Actualiser
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance lists */}
      {listLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground text-lg font-medium">Aucune liste de présence</p>
            <p className="text-sm text-muted-foreground mt-1">
              {isReadOnly
                ? 'Aucune liste de présence n’a été enregistrée pour les critères sélectionnés.'
                : 'Créez votre première liste de présence en cliquant sur le bouton «\u00a0Nouvelle liste\u00a0»'}
            </p>
            {canManage && (
              <Button
                className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleCreateNew}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle liste
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => (
            <motion.div
              key={`${group.date}_${group.classId}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Left: Date + Class info */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                        <CalendarDays className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {new Date(group.date).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">{group.className}</p>
                      </div>
                    </div>

                    {/* Center: Stats badges - clickable to filter by status */}
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="secondary"
                        className={`cursor-pointer transition-all select-none ${
                          statusFilter === 'present'
                            ? 'bg-emerald-500 text-white ring-2 ring-emerald-400 dark:bg-emerald-600 dark:text-white'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
                        }`}
                        onClick={() => handleStatusFilterClick('present')}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {group.present} Présent{group.present > 1 ? 's' : ''}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`cursor-pointer transition-all select-none ${
                          statusFilter === 'absent'
                            ? 'bg-red-500 text-white ring-2 ring-red-400 dark:bg-red-600 dark:text-white'
                            : 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60'
                        }`}
                        onClick={() => handleStatusFilterClick('absent')}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        {group.absent} Absent{group.absent > 1 ? 's' : ''}
                      </Badge>
                      {group.late > 0 && (
                        <Badge
                          variant="secondary"
                          className={`cursor-pointer transition-all select-none ${
                            statusFilter === 'late'
                              ? 'bg-amber-500 text-white ring-2 ring-amber-400 dark:bg-amber-600 dark:text-white'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60'
                          }`}
                          onClick={() => handleStatusFilterClick('late')}
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          {group.late} Retard{group.late > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {group.excused > 0 && (
                        <Badge
                          variant="secondary"
                          className={`cursor-pointer transition-all select-none ${
                            statusFilter === 'excused'
                              ? 'bg-sky-500 text-white ring-2 ring-sky-400 dark:bg-sky-600 dark:text-white'
                              : 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-900/60'
                          }`}
                          onClick={() => handleStatusFilterClick('excused')}
                        >
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {group.excused} Excusé{group.excused > 1 ? 's' : ''}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-muted-foreground">
                        <Users className="w-3 h-3 mr-1" />
                        {group.records.length} élève{group.records.length > 1 ? 's' : ''}
                      </Badge>
                    </div>

                    {/* Right: Action buttons — hidden for read-only roles (student/parent/staff) */}
                    {canManage && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(group)}
                          className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/50"
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Modifier
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setDeleteDialog({
                              open: true,
                              date: group.date,
                              className: group.className,
                              studentIds: group.records.map((r) => r.studentId),
                            })
                          }
                          className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/50"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Supprimer
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Student list table */}
                  <div className="mt-3 pt-3 border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Élève</TableHead>
                          <TableHead className="text-center">Statut</TableHead>
                          <TableHead>Commentaire</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.records.map((record, idx) => (
                          <TableRow key={record.id}>
                            <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                            <TableCell className="text-sm font-medium">
                              {record.student?.lastName} {record.student?.firstName}
                            </TableCell>
                            <TableCell className="text-center">
                              <button
                                type="button"
                                onClick={() => handleStatusFilterClick(record.status as AttendanceStatus)}
                                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 ${
                                  statusFilter === record.status
                                    ? 'ring-2 ring-offset-1'
                                    : ''
                                } ${
                                  ATTENDANCE_STATUS_COLORS[record.status as AttendanceStatus] || ''
                                }`}
                              >
                                {getStatusIcon(record.status)}
                                {ATTENDANCE_STATUS_LABELS[record.status as AttendanceStatus] || record.status}
                              </button>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {record.comment || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  // =============================================
  // RENDER: Create/Edit Form
  // =============================================
  const renderFormView = () => (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setViewMode('list');
            setStudentsAttendance([]);
            setEditDate('');
          }}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {viewMode === 'create' ? 'Nouvelle liste de présence' : 'Modifier la liste de présence'}
          </h3>
          {viewMode === 'edit' && (
            <p className="text-sm text-muted-foreground">
              {new Date(formDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — {selectedClassName}
            </p>
          )}
        </div>
      </div>

      {/* Selection form */}
      <Card className="border-2 border-emerald-200 dark:border-emerald-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-600" />
            {viewMode === 'create' ? 'Sélectionner la classe et la date' : 'Paramètres de la liste'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* School Year */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Année scolaire *</Label>
              <Select value={formSchoolYear} onValueChange={setFormSchoolYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_YEARS.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Class */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Classe *</Label>
              <Select
                value={formClassId}
                onValueChange={setFormClassId}
                disabled={viewMode === 'edit'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {classes.length === 0 ? (
                    <SelectItem value="none" disabled>Aucune classe pour cette année</SelectItem>
                  ) : (
                    classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} — {cls.level}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={viewMode === 'edit'}
                    className={`h-10 w-full justify-start text-left font-normal overflow-hidden ${!formDate ? 'text-muted-foreground' : ''}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {formDate
                        ? format(new Date(formDate + 'T00:00:00'), 'dd MMM yyyy', { locale: fr })
                        : 'Choisir une date'}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formDate ? new Date(formDate + 'T00:00:00') : undefined}
                    onSelect={(date) => setFormDate(date ? format(date, 'yyyy-MM-dd') : '')}
                    locale={fr}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Submit button */}
            <div className="space-y-2">
              <Label className="text-sm font-medium invisible">Action</Label>
              <Button
                onClick={handleLoadStudents}
                disabled={loading || !formClassId || !formDate}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Users className="w-4 h-4 mr-2" />
                )}
                Charger la liste
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance list (shown after loading students) */}
      {studentsAttendance.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* Class info header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {selectedClassName || 'Classe'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(formDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — {formSchoolYear}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un élève..."
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  className="h-9 pl-9 w-[200px]"
                />
              </div>
              <Button variant="outline" size="sm" onClick={markAllPresent}>
                <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
                Tous présents
              </Button>
              <Button variant="outline" size="sm" onClick={markAllAbsent}>
                <XCircle className="w-4 h-4 mr-1 text-red-600" />
                Tous absents
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || studentsAttendance.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {viewMode === 'edit' ? 'Mettre à jour' : 'Enregistrer'}
              </Button>
            </div>
          </div>

          {/* Stats summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{presentCount}</p>
                  <p className="text-xs text-muted-foreground">Présents</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/50 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{absentCount}</p>
                  <p className="text-xs text-muted-foreground">Absents</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{lateCount}</p>
                  <p className="text-xs text-muted-foreground">En retard</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-sky-500">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-sky-600">{excusedCount}</p>
                  <p className="text-xs text-muted-foreground">Excusés</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Student list */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>Nom complet</TableHead>
                      <TableHead className="text-center w-[200px]">Statut</TableHead>
                      <TableHead>Commentaire</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((sa, index) => (
                      <TableRow key={sa.student.id} className="hover:bg-muted/30">
                        <TableCell className="text-center text-muted-foreground text-sm">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-xs font-bold text-emerald-700">
                              {sa.student.firstName[0]}{sa.student.lastName[0]}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{sa.student.lastName} {sa.student.firstName}</p>
                              <p className="text-xs text-muted-foreground">
                                {sa.student.currentClass?.name || sa.student.class?.name || ''}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1.5">
                            {ATTENDANCE_STATUSES.map((statusDef) => (
                              <button
                                key={statusDef.value}
                                onClick={() => updateStatus(sa.student.id, statusDef.value)}
                                className={`
                                  px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all text-xs font-medium
                                  ${
                                    sa.status === statusDef.value
                                      ? `${statusDef.color} ring-2 ring-offset-1 ring-current shadow-sm`
                                      : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                                  }
                                `}
                                title={statusDef.label}
                              >
                                {getStatusIcon(statusDef.value)}
                                <span className="hidden sm:inline">{statusDef.label}</span>
                              </button>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Commentaire..."
                            value={sa.comment}
                            onChange={(e) => updateComment(sa.student.id, e.target.value)}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Footer with totals */}
              <div className="border-t px-4 py-3 bg-muted/30 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {filteredStudents.length} élève{filteredStudents.length > 1 ? 's' : ''} affiché{filteredStudents.length > 1 ? 's' : ''}
                  {searchStudent && studentsAttendance.length !== filteredStudents.length && (
                    <span> sur {studentsAttendance.length}</span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {presentCount}
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="w-3.5 h-3.5" /> {absentCount}
                  </span>
                  <span className="flex items-center gap-1 text-amber-600">
                    <Clock className="w-3.5 h-3.5" /> {lateCount}
                  </span>
                  <span className="flex items-center gap-1 text-sky-600">
                    <AlertCircle className="w-3.5 h-3.5" /> {excusedCount}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty state for create mode when no students loaded */}
      {studentsAttendance.length === 0 && !loading && viewMode === 'create' && (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground text-lg font-medium">Sélectionnez une classe et une date</p>
            <p className="text-sm text-muted-foreground mt-1">
              Choisissez une année scolaire, une classe et une date puis cliquez sur &quot;Charger la liste&quot;
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Présences</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isReadOnly
              ? 'Consultez les listes d\u2019appel par classe'
              : 'Créer, modifier et gérer les listes d\u2019appel par classe'}
          </p>
          {isReadOnly && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Mode consultation — la modification et la suppression sont réservées aux enseignants et administrateurs.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {viewMode === 'list' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={exporting !== null || attendanceGroups.length === 0}
                className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/50"
              >
                {exporting === 'pdf' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={exporting !== null || attendanceGroups.length === 0}
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/50"
              >
                {exporting === 'excel' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={attendanceGroups.length === 0}
                className="text-sky-600 border-sky-200 hover:bg-sky-50 dark:border-sky-800 dark:hover:bg-sky-950/50"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </Button>
              {canManage && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleCreateNew}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle liste
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* View mode rendering */}
      {viewMode === 'list' ? renderListView() : renderFormView()}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Supprimer la liste de présence
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la liste de présence du{' '}
              <strong>{deleteDialog.date && new Date(deleteDialog.date).toLocaleDateString('fr-FR')}</strong>
              {' '}pour la classe <strong>{deleteDialog.className}</strong> ?
              {' '}Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, date: '', className: '', studentIds: [] })}
              disabled={deleting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
