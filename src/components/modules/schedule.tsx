'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Plus,
  Clock,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BookOpen,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/lib/store';
import { withSchoolYear } from '@/lib/utils';
import { DAYS_OF_WEEK, DAY_LABELS, TIME_SLOTS } from '@/lib/constants';
import type { Schedule, Class, Teacher } from '@/lib/types';

// Subject color palette (emerald/teal-based)
const SUBJECT_COLORS = [
  'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
  'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
  'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  'bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/30 dark:text-lime-300 dark:border-lime-800',
  'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
  'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800',
  'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
];

function getSubjectColor(subject: string): string {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

// Time slots for display (hourly)
const DISPLAY_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
];

export default function ScheduleModule() {
  const addToast = useAppStore((s) => s.addToast);
  const currentUser = useAppStore((s) => s.currentUser);
  const schoolYear = useAppStore((s) => s.schoolYear);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [mobileDay, setMobileDay] = useState(1);

  // Add form state
  const [formClassId, setFormClassId] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formDay, setFormDay] = useState('1');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('09:00');
  const [formRoom, setFormRoom] = useState('');

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch(withSchoolYear('/api/classes', schoolYear));
      const data = await res.json();
      setClasses(data.classes || []);
      if (data.classes?.length > 0 && !selectedClassId) {
        setSelectedClassId(data.classes[0].id);
      }
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les classes');
    }
  }, [addToast, selectedClassId, schoolYear]);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch(withSchoolYear('/api/teachers', schoolYear));
      const data = await res.json();
      setTeachers(data.teachers || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les enseignants');
    }
  }, [addToast, schoolYear]);

  const fetchSchedules = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const res = await fetch(withSchoolYear(`/api/schedules?classId=${selectedClassId}`, schoolYear));
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger l\'emploi du temps');
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, schoolYear, addToast]);

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, [fetchClasses, fetchTeachers]);

  useEffect(() => {
    if (selectedClassId) fetchSchedules();
  }, [selectedClassId, fetchSchedules]);

  const handleAddSchedule = async () => {
    if (!formClassId || !formSubject || !formDay || !formStartTime || !formEndTime) {
      addToast('warning', 'Champs requis', 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (formStartTime >= formEndTime) {
      addToast('warning', 'Horaires invalides', 'L\'heure de fin doit être après l\'heure de début');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role || '',
        },
        body: JSON.stringify({
          classId: formClassId,
          subject: formSubject,
          teacherId: formTeacherId || undefined,
          dayOfWeek: parseInt(formDay),
          startTime: formStartTime,
          endTime: formEndTime,
          room: formRoom || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }
      addToast('success', 'Créneau ajouté', 'Le créneau a été ajouté à l\'emploi du temps');
      setAddDialogOpen(false);
      resetForm();
      fetchSchedules();
    } catch (error) {
      addToast('error', 'Erreur', error instanceof Error ? error.message : 'Impossible d\'ajouter le créneau');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSchedule = async () => {
    if (!formClassId || !formSubject || !formDay || !formStartTime || !formEndTime) {
      addToast('warning', 'Champs requis', 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (formStartTime >= formEndTime) {
      addToast('warning', 'Horaires invalides', 'L\'heure de fin doit être après l\'heure de début');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/schedules/${editingScheduleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role || '',
        },
        body: JSON.stringify({
          classId: formClassId,
          subject: formSubject,
          teacherId: formTeacherId || undefined,
          dayOfWeek: parseInt(formDay),
          startTime: formStartTime,
          endTime: formEndTime,
          room: formRoom || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }
      addToast('success', 'Créneau modifié', 'Le créneau a été modifié avec succès');
      setEditDialogOpen(false);
      setEditingScheduleId('');
      resetForm();
      fetchSchedules();
    } catch (error) {
      addToast('error', 'Erreur', error instanceof Error ? error.message : 'Impossible de modifier le créneau');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-role': currentUser?.role || '' },
      });
      if (!res.ok) throw new Error('Erreur suppression');
      addToast('success', 'Créneau supprimé', 'Le créneau a été retiré de l\'emploi du temps');
      fetchSchedules();
    } catch {
      addToast('error', 'Erreur', 'Impossible de supprimer le créneau');
    }
  };

  const openEditDialog = (schedule: Schedule) => {
    setEditingScheduleId(schedule.id);
    setFormClassId(schedule.classId);
    setFormSubject(schedule.subject);
    setFormTeacherId(schedule.teacherId || '');
    setFormDay(String(schedule.dayOfWeek));
    setFormStartTime(schedule.startTime);
    setFormEndTime(schedule.endTime);
    setFormRoom(schedule.room || '');
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormClassId(selectedClassId);
    setFormSubject('');
    setFormTeacherId('');
    setFormDay('1');
    setFormStartTime('08:00');
    setFormEndTime('09:00');
    setFormRoom('');
  };

  // Find if a schedule occupies a given day+time slot
  const getScheduleForCell = (day: number, time: string): Schedule | undefined => {
    return schedules.find((s) => {
      if (s.dayOfWeek !== day) return false;
      return s.startTime <= time && s.endTime > time;
    });
  };

  // Check if a schedule STARTS exactly at this time slot
  const isCellStart = (day: number, time: string): boolean => {
    return schedules.some((s) => s.dayOfWeek === day && s.startTime === time);
  };

  // Calculate how many hourly rows a schedule spans
  const getSpanRows = (schedule: Schedule): number => {
    const start = parseInt(schedule.startTime.split(':')[0]) * 60 + parseInt(schedule.startTime.split(':')[1]);
    const end = parseInt(schedule.endTime.split(':')[0]) * 60 + parseInt(schedule.endTime.split(':')[1]);
    return Math.max(1, Math.round((end - start) / 60));
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Mobile view: get schedules for a specific day
  const getMobileDaySchedules = (day: number): Schedule[] => {
    return schedules
      .filter((s) => s.dayOfWeek === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  // Build all grid cells for CSS Grid layout
  const buildGridCells = () => {
    const cells: React.ReactNode[] = [];

    // Header row: "Heure" + 5 day labels
    cells.push(
      <div
        key="header-time"
        className="p-3 text-sm font-semibold text-muted-foreground bg-muted/50 border-b border-r flex items-center"
        style={{ gridRow: 1, gridColumn: 1 }}
      >
        Heure
      </div>
    );

    DAYS_OF_WEEK.forEach((day, idx) => {
      cells.push(
        <div
          key={`header-${day.value}`}
          className="p-3 text-center text-sm font-semibold text-muted-foreground bg-muted/50 border-b border-r flex items-center justify-center"
          style={{ gridRow: 1, gridColumn: idx + 2 }}
        >
          {day.label}
        </div>
      );
    });

    // Body: time labels + day cells
    DISPLAY_SLOTS.forEach((time, timeIndex) => {
      const rowNum = timeIndex + 2;

      // Time label cell
      cells.push(
        <div
          key={`time-${time}`}
          className="p-2 text-xs font-medium text-muted-foreground bg-muted/30 border-r border-b whitespace-nowrap flex items-center"
          style={{ gridRow: rowNum, gridColumn: 1 }}
        >
          <Clock className="w-3 h-3 inline mr-1" />
          {time}
        </div>
      );

      // Day cells for this time slot
      DAYS_OF_WEEK.forEach((day) => {
        const colNum = day.value + 1;
        const schedule = getScheduleForCell(day.value, time);
        const isStart = isCellStart(day.value, time);

        // If this cell is covered by a spanning schedule from above, skip it
        if (schedule && !isStart) return;

        if (schedule && isStart) {
          const spanRows = getSpanRows(schedule);
          const colorClass = getSubjectColor(schedule.subject);
          cells.push(
            <div
              key={`cell-${day.value}-${time}`}
              className="p-1 border-r border-b"
              style={{
                gridRow: `${rowNum} / span ${spanRows}`,
                gridColumn: colNum,
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-lg p-2 border h-full overflow-hidden relative group ${colorClass}`}
              >
                <div className="font-semibold text-xs truncate">{schedule.subject}</div>
                {schedule.teacher && (
                  <div className="text-[10px] mt-0.5 opacity-80 flex items-center gap-1">
                    <User className="w-2.5 h-2.5" />
                    {schedule.teacher.firstName} {schedule.teacher.lastName}
                  </div>
                )}
                {schedule.room && (
                  <div className="text-[10px] opacity-80 flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5" />
                    {schedule.room}
                  </div>
                )}
                <div className="text-[10px] opacity-70 mt-0.5">
                  {schedule.startTime} - {schedule.endTime}
                </div>
                {/* Edit/Delete buttons - visible on hover for admin */}
                {isAdmin && (
                  <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditDialog(schedule); }}
                      className="p-1 rounded bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 shadow-sm"
                      title="Modifier"
                    >
                      <Pencil className="w-3 h-3 text-foreground" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(schedule.id); }}
                      className="p-1 rounded bg-white/80 dark:bg-gray-800/80 hover:bg-red-100 dark:hover:bg-red-900/50 shadow-sm"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          );
        } else {
          // Empty cell with + button
          cells.push(
            <div
              key={`cell-${day.value}-${time}`}
              className="p-1 border-r border-b"
              style={{ gridRow: rowNum, gridColumn: colNum }}
            >
              {isAdmin && (
                <button
                  onClick={() => {
                    setFormDay(String(day.value));
                    setFormStartTime(time);
                    setFormClassId(selectedClassId);
                    setAddDialogOpen(true);
                  }}
                  className="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded min-h-[44px]"
                >
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          );
        }
      });
    });

    return cells;
  };

  // Shared form fields for Add/Edit dialogs
  const scheduleFormFields = (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="schedule-class">Classe *</Label>
        <Select value={formClassId} onValueChange={setFormClassId}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner une classe" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="schedule-subject">Matière *</Label>
        <Input
          id="schedule-subject"
          value={formSubject}
          onChange={(e) => setFormSubject(e.target.value)}
          placeholder="Ex: Mathématiques"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="schedule-teacher">Enseignant</Label>
        <Select value={formTeacherId} onValueChange={setFormTeacherId}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un enseignant" />
          </SelectTrigger>
          <SelectContent>
            {teachers.map((teacher) => (
              <SelectItem key={teacher.id} value={teacher.id}>
                {teacher.firstName} {teacher.lastName} ({teacher.subject})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="schedule-day">Jour *</Label>
        <Select value={formDay} onValueChange={setFormDay}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un jour" />
          </SelectTrigger>
          <SelectContent>
            {DAYS_OF_WEEK.map((day) => (
              <SelectItem key={day.value} value={String(day.value)}>
                {day.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="schedule-start">Heure début *</Label>
          {/* Free time input — the user can type any time (e.g. 08:30, 14:15),
              not just select from a fixed dropdown. The native time input
              provides a time picker on most browsers and also accepts manual
              keyboard entry. */}
          <Input
            id="schedule-start"
            type="time"
            value={formStartTime}
            onChange={(e) => setFormStartTime(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="schedule-end">Heure fin *</Label>
          <Input
            id="schedule-end"
            type="time"
            value={formEndTime}
            onChange={(e) => setFormEndTime(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="schedule-room">Salle</Label>
        <Input
          id="schedule-room"
          value={formRoom}
          onChange={(e) => setFormRoom(e.target.value)}
          placeholder="Ex: Salle 201"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Emploi du temps</h2>
          <p className="text-sm text-muted-foreground mt-1">Planification hebdomadaire des cours</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sélectionner une classe" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button
              onClick={() => { resetForm(); setAddDialogOpen(true); }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Day Tabs */}
      <div className="block md:hidden">
        <Tabs value={String(mobileDay)} onValueChange={(v) => setMobileDay(parseInt(v))}>
          <TabsList className="w-full">
            {DAYS_OF_WEEK.map((day) => (
              <TabsTrigger key={day.value} value={String(day.value)} className="flex-1 text-xs">
                {day.short}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Mobile Navigation */}
      <div className="flex md:hidden items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setMobileDay(Math.max(1, mobileDay - 1))} disabled={mobileDay <= 1}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-semibold text-foreground">{DAY_LABELS[mobileDay]}</span>
        <Button variant="outline" size="sm" onClick={() => setMobileDay(Math.min(5, mobileDay + 1))} disabled={mobileDay >= 5}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Weekly Grid - CSS Grid Layout */}
          <Card className="hidden md:block overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div
                  className="min-w-[900px]"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px repeat(5, minmax(140px, 1fr))',
                    gridTemplateRows: 'auto repeat(13, 64px)',
                  }}
                >
                  {buildGridCells()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mobile Day View */}
          <div className="md:hidden space-y-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={mobileDay}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {getMobileDaySchedules(mobileDay).length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <CalendarDays className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-muted-foreground">Aucun cours prévu ce jour</p>
                    </CardContent>
                  </Card>
                ) : (
                  getMobileDaySchedules(mobileDay).map((schedule) => {
                    const colorClass = getSubjectColor(schedule.subject);
                    return (
                      <motion.div
                        key={schedule.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Card className="overflow-hidden">
                          <div className={`h-1 ${colorClass.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('dark:bg-')).join(' ')}`} />
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold text-foreground">{schedule.subject}</h4>
                                {schedule.teacher && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                    <User className="w-3.5 h-3.5" />
                                    {schedule.teacher.firstName} {schedule.teacher.lastName}
                                  </p>
                                )}
                              </div>
                              <Badge variant="outline" className={colorClass}>
                                {schedule.startTime} - {schedule.endTime}
                              </Badge>
                            </div>
                            {schedule.room && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-2">
                                <MapPin className="w-3.5 h-3.5" />
                                Salle {schedule.room}
                              </p>
                            )}
                            {/* Edit/Delete buttons for mobile */}
                            {isAdmin && (
                              <div className="flex gap-2 mt-3 pt-2 border-t">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditDialog(schedule)}
                                  className="flex-1"
                                >
                                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                  Modifier
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteSchedule(schedule.id)}
                                  className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                  Supprimer
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Empty State - no class selected */}
          {!selectedClassId && !loading && (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">Sélectionnez une classe pour voir l&apos;emploi du temps</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Add Schedule Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ajouter un créneau</DialogTitle>
          </DialogHeader>
          {scheduleFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddSchedule} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier le créneau</DialogTitle>
          </DialogHeader>
          {scheduleFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditingScheduleId(''); }}>
              Annuler
            </Button>
            <Button onClick={handleEditSchedule} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
