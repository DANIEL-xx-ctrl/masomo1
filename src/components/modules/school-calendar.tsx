'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar as CalendarIcon,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  BookOpen,
  Users,
  Clock,
  AlertCircle,
  Star,
  X,
  Globe,
  GraduationCap,
  Check,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip as ShadcnTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
import { useAppStore } from '@/lib/store'
import { withSchoolYear } from '@/lib/utils'
import { Megaphone } from 'lucide-react'

// ---------- Types ----------

interface EventClassInfo {
  id: string
  classId: string
  class: { id: string; name: string }
}

interface SchoolEvent {
  id: string
  title: string
  description: string | null
  date: string
  endDate: string | null
  type: string
  schoolYear: string
  isGlobal: boolean
  classes: EventClassInfo[]
  createdAt: string
  updatedAt: string
}

// ---------- Constants ----------

const EVENT_TYPES = [
  { value: 'holiday', label: 'Congé', color: '#ef4444', bg: 'bg-red-100 dark:bg-red-950/50', text: 'text-red-700 dark:text-red-400', border: 'border-red-300' },
  { value: 'exam', label: 'Examen', color: '#f59e0b', bg: 'bg-amber-100 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-300' },
  { value: 'meeting', label: 'Réunion', color: '#3b82f6', bg: 'bg-blue-100 dark:bg-blue-950/50', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-300' },
  { value: 'celebration', label: 'Festivité', color: '#8b5cf6', bg: 'bg-purple-100 dark:bg-purple-950/50', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-300' },
  { value: 'deadline', label: 'Échéance', color: '#ec4899', bg: 'bg-pink-100 dark:bg-pink-950/50', text: 'text-pink-700 dark:text-pink-400', border: 'border-pink-300' },
  { value: 'announcement', label: 'Annonce', color: '#10b981', bg: 'bg-teal-100 dark:bg-teal-950/50', text: 'text-teal-700 dark:text-teal-400', border: 'border-teal-300' },
  { value: 'other', label: 'Autre', color: '#6b7280', bg: 'bg-gray-100 dark:bg-gray-950/50', text: 'text-gray-700 dark:text-gray-400', border: 'border-gray-300' },
] as const

const ALL_MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

// School year month definitions for quick navigation (Sept → June)
const SCHOOL_YEAR_MONTHS = [
  { short: 'Sep', monthIndex: 8, offset: 0 },   // Septembre of start year
  { short: 'Oct', monthIndex: 9, offset: 0 },   // Octobre
  { short: 'Nov', monthIndex: 10, offset: 0 },  // Novembre
  { short: 'Déc', monthIndex: 11, offset: 0 },  // Décembre
  { short: 'Jan', monthIndex: 0, offset: 1 },   // Janvier of end year
  { short: 'Fév', monthIndex: 1, offset: 1 },   // Février
  { short: 'Mar', monthIndex: 2, offset: 1 },   // Mars
  { short: 'Avr', monthIndex: 3, offset: 1 },   // Avril
  { short: 'Mai', monthIndex: 4, offset: 1 },   // Mai
  { short: 'Juin', monthIndex: 5, offset: 1 },  // Juin
] as const

// School year months for the agenda view
const SCHOOL_YEAR_MONTHS_FR = [
  'Septembre', 'Octobre', 'Novembre', 'Décembre',
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
]

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// ---------- Helpers ----------

function getTypeConfig(type: string) {
  return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[5]
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'holiday': return <PartyPopper className="w-4 h-4" />
    case 'exam': return <BookOpen className="w-4 h-4" />
    case 'meeting': return <Users className="w-4 h-4" />
    case 'celebration': return <Star className="w-4 h-4" />
    case 'deadline': return <AlertCircle className="w-4 h-4" />
    case 'announcement': return <Megaphone className="w-4 h-4" />
    default: return <Clock className="w-4 h-4" />
  }
}

function formatDateFR(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return dateStr
  }
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay()
  // Convert Sunday=0 to Monday-based week (Monday=0)
  return day === 0 ? 6 : day - 1
}

function isToday(year: number, month: number, day: number): boolean {
  const today = new Date()
  return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
}

function dateToString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ---------- Main Component ----------

export default function SchoolCalendar() {
  const schoolYear = useAppStore((s) => s.schoolYear) || '2024-2025'
  const addToast = useAppStore((s) => s.addToast)
  const currentUser = useAppStore((s) => s.currentUser)

  const [events, setEvents] = useState<SchoolEvent[]>([])
  const [announcements, setAnnouncements] = useState<SchoolEvent[]>([])
  const [loading, setLoading] = useState(true)
  // Calendar view state — always initialize to current system month
  const schoolYearStart = parseInt(schoolYear.split('-')[0])
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth()) // 0-11 (0=Jan)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [editingEvent, setEditingEvent] = useState<SchoolEvent | null>(null)
  const [deleteEvent, setDeleteEvent] = useState<SchoolEvent | null>(null)
  const [activeTab, setActiveTab] = useState<'calendar' | 'agenda'>('calendar')

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formType, setFormType] = useState('other')
  const [formIsGlobal, setFormIsGlobal] = useState(true)
  const [formClassIds, setFormClassIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Available classes
  const [availableClasses, setAvailableClasses] = useState<Array<{ id: string; name: string }>>([])

  // Combine events + announcements into a unified list
  const allEvents = [...events, ...announcements]

  const fetchEvents = useCallback(async () => {
    try {
      // Fetch events, announcements and classes in parallel
      const [eventsRes, annRes, classesRes] = await Promise.all([
        fetch(withSchoolYear('/api/events', schoolYear)),
        fetch(withSchoolYear('/api/announcements', schoolYear)),
        fetch(withSchoolYear('/api/classes', schoolYear)),
      ])
      if (eventsRes.ok) {
        const json = await eventsRes.json()
        setEvents(json.events || [])
      }
      if (annRes.ok) {
        const annJson = await annRes.json()
        // Convert announcements to SchoolEvent format
        const annEvents: SchoolEvent[] = (annJson.announcements || [])
          .filter((a: { date: string }) => a.date) // Only announcements with a date
          .map((a: { id: string; title: string; content: string; type: string; date: string; schoolYear: string; createdAt: string; updatedAt: string }) => ({
            id: `ann-${a.id}`,
            title: a.title,
            description: a.content,
            date: a.date,
            endDate: null,
            type: 'announcement',
            schoolYear: a.schoolYear,
            isGlobal: true,
            classes: [],
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          }))
        setAnnouncements(annEvents)
      }
      if (classesRes.ok) {
        const classesJson = await classesRes.json()
        setAvailableClasses((classesJson.classes || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
      }
    } catch (err) {
      console.error('Failed to fetch events:', err)
    } finally {
      setLoading(false)
    }
  }, [schoolYear])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // When school year changes, navigate to current system month if it falls within the new school year, otherwise September
  // Skip on first mount — initial state already sets current month
  const isFirstMount = useRef(true)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    const syStart = parseInt(schoolYear.split('-')[0])
    const now = new Date()
    const m = now.getMonth()
    const y = now.getFullYear()
    // If current system date falls within the selected school year, show current month
    if ((y === syStart && m >= 8) || (y === syStart + 1 && m <= 5)) {
      setCalYear(y)
      setCalMonth(m)
    } else {
      // Otherwise show September of the school year start
      setCalYear(syStart)
      setCalMonth(8)
    }
  }, [schoolYear])

  // Calendar navigation helpers
  const goToPrevMonth = useCallback(() => {
    setCalMonth(prev => {
      if (prev === 0) { setCalYear(y => y - 1); return 11 }
      return prev - 1
    })
  }, [])

  const goToNextMonth = useCallback(() => {
    setCalMonth(prev => {
      if (prev === 11) { setCalYear(y => y + 1); return 0 }
      return prev + 1
    })
  }, [])

  // Jump to a specific school year month
  const goToSchoolYearMonth = useCallback((syMonth: typeof SCHOOL_YEAR_MONTHS[number]) => {
    setCalYear(schoolYearStart + syMonth.offset)
    setCalMonth(syMonth.monthIndex)
  }, [schoolYearStart])

  // Jump to today
  const goToToday = useCallback(() => {
    setCalYear(new Date().getFullYear())
    setCalMonth(new Date().getMonth())
  }, [])

  // Check if current calendar view is within the school year
  const isCalInSchoolYear = (calMonth >= 8 && calYear === schoolYearStart) || (calMonth <= 5 && calYear === schoolYearStart + 1)

  // Find the matching school year month index for the current calMonth/calYear
  const activeSchoolYearMonthIdx = SCHOOL_YEAR_MONTHS.findIndex(
    m => m.monthIndex === calMonth && calYear === schoolYearStart + m.offset
  )

  // Get events for a specific date
  function getEventsForDate(dateStr: string): SchoolEvent[] {
    return allEvents.filter(e => {
      if (e.date === dateStr) return true
      if (e.endDate && e.date <= dateStr && e.endDate >= dateStr) return true
      return false
    })
  }

  // Get events for current calendar month view
  function getMonthEvents(): SchoolEvent[] {
    const daysInMonth = getDaysInMonth(calYear, calMonth)
    const monthEvents: SchoolEvent[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = dateToString(calYear, calMonth, d)
      monthEvents.push(...getEventsForDate(ds))
    }
    // Deduplicate
    const seen = new Set<string>()
    return monthEvents.filter(e => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
  }

  // Get upcoming events
  function getUpcomingEvents(): SchoolEvent[] {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return allEvents
      .filter(e => new Date(e.date + 'T00:00:00') >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 20)
  }

  // Open create dialog
  function handleCreate(date?: string) {
    setEditingEvent(null)
    setFormTitle('')
    setFormDescription('')
    setFormDate(date || '')
    setFormEndDate('')
    setFormType('other')
    setFormIsGlobal(true)
    setFormClassIds([])
    setShowEventDialog(true)
  }

  // Open edit dialog
  function handleEdit(event: SchoolEvent) {
    setEditingEvent(event)
    setFormTitle(event.title)
    setFormDescription(event.description || '')
    setFormDate(event.date)
    setFormEndDate(event.endDate || '')
    setFormType(event.type)
    setFormIsGlobal(event.isGlobal)
    setFormClassIds(event.classes.map(ec => ec.classId))
    setShowEventDialog(true)
  }

  // Save event (create or update)
  async function handleSave() {
    if (!formTitle.trim() || !formDate) {
      addToast('error', 'Champs requis', 'Le titre et la date sont obligatoires')
      return
    }

    if (!formIsGlobal && formClassIds.length === 0) {
      addToast('error', 'Classe requise', 'Sélectionnez au moins une classe pour un événement non-global')
      return
    }

    setSaving(true)
    try {
      const url = editingEvent ? '/api/events' : '/api/events'
      const method = editingEvent ? 'PUT' : 'POST'
      const body = editingEvent
        ? {
            id: editingEvent.id,
            title: formTitle.trim(),
            description: formDescription.trim(),
            date: formDate,
            endDate: formEndDate || null,
            type: formType,
            isGlobal: formIsGlobal,
            classIds: formIsGlobal ? [] : formClassIds,
          }
        : {
            title: formTitle.trim(),
            description: formDescription.trim(),
            date: formDate,
            endDate: formEndDate || null,
            type: formType,
            schoolYear,
            isGlobal: formIsGlobal,
            classIds: formIsGlobal ? [] : formClassIds,
          }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '', 'x-institution-id': currentUser?.institutionId || '', 'x-user-role': currentUser?.role || '' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        addToast('success', editingEvent ? 'Événement modifié' : 'Événement créé', formTitle)
        setShowEventDialog(false)
        fetchEvents()
      } else {
        const json = await res.json()
        addToast('error', 'Erreur', json.error || 'Impossible de sauvegarder')
      }
    } catch {
      addToast('error', 'Erreur', 'Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  // Delete event
  async function handleDeleteConfirm() {
    if (!deleteEvent) return
    try {
      const res = await fetch(`/api/events?id=${deleteEvent.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': currentUser?.id || '', 'x-institution-id': currentUser?.institutionId || '', 'x-user-role': currentUser?.role || '' },
      })
      if (res.ok) {
        addToast('success', 'Événement supprimé', deleteEvent.title)
        setDeleteEvent(null)
        fetchEvents()
      } else {
        addToast('error', 'Erreur', 'Impossible de supprimer')
      }
    } catch {
      addToast('error', 'Erreur', 'Erreur réseau')
    }
  }

  // Chart data: events by type — include ALL types for a proper line
  const chartData = EVENT_TYPES.map(t => ({
    name: t.label,
    value: allEvents.filter(e => e.type === t.value).length,
    color: t.color,
  }))
  const hasAnyEvents = chartData.some(d => d.value > 0)

  // Calendar grid data
  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDay = getFirstDayOfMonth(calYear, calMonth)
  const calendarCells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) calendarCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d)
  // Fill remaining cells to complete the last week
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)

  const monthEvents = getMonthEvents()
  const upcomingEvents = getUpcomingEvents()
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-96 bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* ===== Header ===== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Calendrier scolaire</h2>
            <p className="text-sm text-muted-foreground">Année {schoolYear}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                activeTab === 'calendar'
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Calendrier
            </button>
            <button
              onClick={() => setActiveTab('agenda')}
              className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                activeTab === 'agenda'
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Agenda
            </button>
          </div>
          {isAdmin && (
            <Button onClick={() => handleCreate()} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouveau</span>
            </Button>
          )}
        </div>
      </div>

      {/* ===== Legend ===== */}
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPES.map(t => (
          <div key={t.value} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="text-muted-foreground">{t.label}</span>
          </div>
        ))}
      </div>

      {/* ===== Calendar View ===== */}
      <AnimatePresence mode="wait">
        {activeTab === 'calendar' && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Month Navigation */}
            <Card>
              <CardContent className="p-4">
                {/* School year month quick-nav chips */}
                <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
                  {SCHOOL_YEAR_MONTHS.map((syMonth, idx) => {
                    const isActive = activeSchoolYearMonthIdx === idx
                    const monthEvts = (() => {
                      const mYear = schoolYearStart + syMonth.offset
                      const days = getDaysInMonth(mYear, syMonth.monthIndex)
                      let count = 0
                      for (let d = 1; d <= days; d++) {
                        const ds = dateToString(mYear, syMonth.monthIndex, d)
                        if (getEventsForDate(ds).length > 0) { count++; break }
                      }
                      return count > 0
                    })()
                    return (
                      <button
                        key={idx}
                        onClick={() => goToSchoolYearMonth(syMonth)}
                        className={`relative px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 shadow-sm'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {syMonth.short}
                        {monthEvts && !isActive && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        )}
                      </button>
                    )
                  })}
                  <div className="w-px h-5 bg-border mx-1" />
                  <button
                    onClick={goToToday}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all whitespace-nowrap"
                  >
                    Aujourd&apos;hui
                  </button>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToPrevMonth}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">
                      {ALL_MONTHS_FR[calMonth]} {calYear}
                    </h3>
                    {!isCalInSchoolYear && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-amber-600 border-amber-300">
                        Hors année scolaire
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToNextMonth}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAYS_FR.map(day => (
                    <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <TooltipProvider delayDuration={200}>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarCells.map((day, idx) => {
                      if (day === null) {
                        return <div key={`empty-${idx}`} className="min-h-[80px] sm:min-h-[90px]" />
                      }
                      const dateStr = dateToString(calYear, calMonth, day)
                      const dayEvents = getEventsForDate(dateStr)
                      const today = isToday(calYear, calMonth, day)
                      const isSelected = selectedDate === dateStr

                      return (
                        <div
                          key={dateStr}
                          onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                          className={`min-h-[80px] sm:min-h-[90px] rounded-lg flex flex-col p-1 transition-all cursor-pointer
                            ${today ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}
                            ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/80'}
                          `}
                        >
                          <span className={`text-xs font-medium text-center ${today ? 'text-emerald-600 font-bold' : 'text-muted-foreground'}`}>
                            {day}
                          </span>
                          {dayEvents.length > 0 && (
                            <div className="flex-1 flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                              {dayEvents.slice(0, 2).map((event, i) => {
                                const cfg = getTypeConfig(event.type)
                                return (
                                  <ShadcnTooltip key={event.id}>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`text-[9px] sm:text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium ${cfg.bg} ${cfg.text}`}
                                      >
                                        {event.title}
                                        {!event.isGlobal && event.classes.length > 0 && (
                                          <GraduationCap className="w-2 h-2 ml-0.5 inline shrink-0 opacity-70" />
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[250px]">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                                          <span className="font-semibold">{event.title}</span>
                                        </div>
                                        <div className="text-xs opacity-90">
                                          {formatDateShort(event.date)}{event.endDate && event.endDate !== event.date ? ` → ${formatDateShort(event.endDate)}` : ''}
                                        </div>
                                        <div className="flex items-center gap-1 flex-wrap">
                                          <Badge variant="outline" className="text-[9px] h-4 px-1">
                                            {cfg.label}
                                          </Badge>
                                          {event.isGlobal ? (
                                            <Badge variant="outline" className="text-[9px] h-4 px-1 text-teal-600 border-teal-300">
                                              <Globe className="w-2.5 h-2.5 mr-0.5" />Tout
                                            </Badge>
                                          ) : event.classes.length > 0 && (
                                            event.classes.slice(0, 2).map(ec => (
                                              <Badge key={ec.classId} variant="outline" className="text-[9px] h-4 px-1 text-purple-600 border-purple-300">
                                                {ec.class.name}
                                              </Badge>
                                            ))
                                          )}
                                          {!event.isGlobal && event.classes.length > 2 && (
                                            <span className="text-[8px] text-muted-foreground">+{event.classes.length - 2}</span>
                                          )}
                                        </div>
                                        {event.description && (
                                          <p className="text-xs opacity-80 line-clamp-2">{event.description}</p>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </ShadcnTooltip>
                                )
                              })}
                              {dayEvents.length > 2 && (
                                <span className="text-[8px] text-muted-foreground text-center">
                                  +{dayEvents.length - 2} autre{dayEvents.length - 2 > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </TooltipProvider>

                {/* Selected Date Events */}
                <AnimatePresence>
                  {selectedDate && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-4 overflow-hidden"
                    >
                      <Separator className="mb-3" />
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">{formatDateFR(selectedDate)}</h4>
                        {isAdmin && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => handleCreate(selectedDate)}>
                            <Plus className="w-3 h-3" /> Ajouter
                          </Button>
                        )}
                      </div>
                      {getEventsForDate(selectedDate).length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">Aucun événement ce jour</p>
                      ) : (
                        <div className="space-y-2">
                          {getEventsForDate(selectedDate).map(event => {
                            const cfg = getTypeConfig(event.type)
                            return (
                              <div
                                key={event.id}
                                className={`flex items-start gap-2 p-2 rounded-lg border ${cfg.bg} ${cfg.border}`}
                              >
                                <div className={`mt-0.5 ${cfg.text}`}>{getTypeIcon(event.type)}</div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium ${cfg.text}`}>{event.title}</p>
                                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                    {event.isGlobal ? (
                                      <Badge variant="outline" className="text-[9px] h-4 px-1 text-teal-600 border-teal-300">
                                        <Globe className="w-2.5 h-2.5 mr-0.5" />Tout l&apos;établissement
                                      </Badge>
                                    ) : event.classes.length > 0 && (
                                      event.classes.map(ec => (
                                        <Badge key={ec.classId} variant="outline" className="text-[9px] h-4 px-1 text-purple-600 border-purple-300">
                                          {ec.class.name}
                                        </Badge>
                                      ))
                                    )}
                                  </div>
                                  {event.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
                                  )}
                                  {event.endDate && event.endDate !== event.date && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      Jusqu&apos;au {formatDateShort(event.endDate)}
                                    </p>
                                  )}
                                </div>
                                {isAdmin && event.type !== 'announcement' && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEdit(event)}>
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => setDeleteEvent(event)}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Month Events Summary */}
            {monthEvents.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Événements en {ALL_MONTHS_FR[calMonth]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="max-h-64">
                    <div className="space-y-2">
                      {monthEvents
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map(event => {
                          const cfg = getTypeConfig(event.type)
                          return (
                            <div
                              key={event.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.text}`}>
                                {getTypeIcon(event.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{event.title}</p>
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="text-xs text-muted-foreground">{formatDateShort(event.date)}{event.endDate && event.endDate !== event.date ? ` → ${formatDateShort(event.endDate)}` : ''}</span>
                                  {event.isGlobal ? (
                                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 text-teal-600 border-teal-300">
                                      <Globe className="w-2 h-2 mr-0.5" />Tout
                                    </Badge>
                                  ) : event.classes.length > 0 && (
                                    event.classes.slice(0, 2).map(ec => (
                                      <Badge key={ec.classId} variant="outline" className="text-[8px] h-3.5 px-1 text-purple-600 border-purple-300">
                                        {ec.class.name}
                                      </Badge>
                                    ))
                                  )}
                                </div>
                              </div>
                              <Badge variant="outline" className={`text-xs ${cfg.text} border-current/20`}>
                                {cfg.label}
                              </Badge>
                                {isAdmin && event.type !== 'announcement' && (
                                  <div className="flex items-center gap-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(event)}>
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => setDeleteEvent(event)}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                )}
                            </div>
                          )
                        })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
            {/* Chart: Events by Type — Line Chart */}
            {hasAnyEvents && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-teal-600" />
                    Répartition des événements par type
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          className="text-muted-foreground"
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={50}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                          allowDecimals={false}
                          domain={[0, 'auto']}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload as { name: string; value: number; color: string }
                              return (
                                <div className="rounded-lg border bg-card p-3 shadow-xl text-sm">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                                    <p className="font-medium">{d.name}</p>
                                  </div>
                                  <p className="text-emerald-600 mt-1">
                                    {d.value} événement{d.value > 1 ? 's' : ''}
                                  </p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#14b8a6"
                          strokeWidth={3}
                          dot={{ r: 6, stroke: '#14b8a6', strokeWidth: 2, fill: '#fff' }}
                          activeDot={{ r: 8, strokeWidth: 2, fill: '#14b8a6', stroke: '#fff' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* ===== Agenda View ===== */}
        {activeTab === 'agenda' && (
          <motion.div
            key="agenda"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Full Year Agenda */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-emerald-600" />
                  Agenda scolaire — {schoolYear}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-6">
                    {SCHOOL_YEAR_MONTHS_FR.map((monthName, mi) => {
                      const y = mi < 4 ? schoolYearStart : schoolYearStart + 1
                      const m = mi < 4 ? mi + 8 : mi - 4
                      const monthEvts = allEvents
                        .filter(e => {
                          const eDate = new Date(e.date + 'T00:00:00')
                          return eDate.getFullYear() === y && eDate.getMonth() === m
                        })
                        .sort((a, b) => a.date.localeCompare(b.date))

                      return (
                        <div key={`sy-${mi}`}>
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <h4 className="text-sm font-bold text-foreground truncate">{monthName} {y}</h4>
                            <Separator className="flex-1 min-w-[20px]" />
                            <span className="text-xs text-muted-foreground shrink-0">{monthEvts.length} événement{monthEvts.length !== 1 ? 's' : ''}</span>
                          </div>
                          {monthEvts.length === 0 ? (
                            <p className="text-xs text-muted-foreground pl-4 pb-2">Aucun événement prévu</p>
                          ) : (
                            <div className="space-y-2 pl-2">
                              {monthEvts.map(event => {
                                const cfg = getTypeConfig(event.type)
                                return (
                                  <div
                                    key={event.id}
                                    className={`flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 p-3 rounded-lg border ${cfg.bg} ${cfg.border} transition-colors hover:shadow-sm`}
                                  >
                                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${cfg.text} font-bold text-base sm:text-lg`}>
                                        {new Date(event.date + 'T00:00:00').getDate()}
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className={`text-sm font-semibold ${cfg.text} break-words`}>{event.title}</p>
                                        <Badge variant="outline" className={`text-[10px] ${cfg.text} border-current/20 shrink-0`}>
                                          {cfg.label}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                        {event.isGlobal ? (
                                          <Badge variant="outline" className="text-[9px] h-4 px-1 text-teal-600 border-teal-300 shrink-0">
                                            <Globe className="w-2.5 h-2.5 mr-0.5" />Tout l&apos;établissement
                                          </Badge>
                                        ) : event.classes.length > 0 && (
                                          event.classes.map(ec => (
                                            <Badge key={ec.classId} variant="outline" className="text-[9px] h-4 px-1 text-purple-600 border-purple-300 shrink-0 truncate max-w-[120px]">
                                              {ec.class.name}
                                            </Badge>
                                          ))
                                        )}
                                      </div>
                                      {event.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 break-words">{event.description}</p>
                                      )}
                                      {event.endDate && event.endDate !== event.date && (
                                        <p className="text-xs text-muted-foreground mt-0.5 shrink-0">
                                          Jusqu&apos;au {formatDateFR(event.endDate)}
                                        </p>
                                      )}
                                    </div>
                                    {isAdmin && event.type !== 'announcement' && (
                                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(event)}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => setDeleteEvent(event)}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {/* Events outside the school year months (e.g., July/August or other years) */}
                    {(() => {
                      const outsideEvents = allEvents.filter(e => {
                        const eDate = new Date(e.date + 'T00:00:00')
                        const eYear = eDate.getFullYear()
                        const eMonth = eDate.getMonth()
                        const inSchoolYear = (eYear === schoolYearStart && eMonth >= 8) ||
                          (eYear === schoolYearStart + 1 && eMonth <= 5)
                        return !inSchoolYear
                      }).sort((a, b) => a.date.localeCompare(b.date))

                      if (outsideEvents.length === 0) return null

                      const grouped = new Map<string, SchoolEvent[]>()
                      outsideEvents.forEach(e => {
                        const eDate = new Date(e.date + 'T00:00:00')
                        const key = `${eDate.getFullYear()}-${String(eDate.getMonth()).padStart(2, '0')}`
                        if (!grouped.has(key)) grouped.set(key, [])
                        grouped.get(key)!.push(e)
                      })

                      return Array.from(grouped.entries()).sort().map(([key, evts]) => {
                        const [yr, mo] = key.split('-').map(Number)
                        return (
                          <div key={`outside-${key}`}>
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <h4 className="text-sm font-bold text-foreground truncate">{ALL_MONTHS_FR[mo]} {yr}</h4>
                              <Separator className="flex-1 min-w-[20px]" />
                              <span className="text-xs text-amber-600 shrink-0">Hors année scolaire</span>
                              <span className="text-xs text-muted-foreground shrink-0">{evts.length} événement{evts.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="space-y-2 pl-2">
                              {evts.map(event => {
                                const cfg = getTypeConfig(event.type)
                                return (
                                  <div
                                    key={event.id}
                                    className={`flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 p-3 rounded-lg border ${cfg.bg} ${cfg.border} transition-colors hover:shadow-sm`}
                                  >
                                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${cfg.text} font-bold text-base sm:text-lg`}>
                                        {new Date(event.date + 'T00:00:00').getDate()}
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className={`text-sm font-semibold ${cfg.text} break-words`}>{event.title}</p>
                                        <Badge variant="outline" className={`text-[10px] ${cfg.text} border-current/20 shrink-0`}>
                                          {cfg.label}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                        {event.isGlobal ? (
                                          <Badge variant="outline" className="text-[9px] h-4 px-1 text-teal-600 border-teal-300 shrink-0">
                                            <Globe className="w-2.5 h-2.5 mr-0.5" />Tout l&apos;établissement
                                          </Badge>
                                        ) : event.classes.length > 0 && (
                                          event.classes.map(ec => (
                                            <Badge key={ec.classId} variant="outline" className="text-[9px] h-4 px-1 text-purple-600 border-purple-300 shrink-0 truncate max-w-[120px]">
                                              {ec.class.name}
                                            </Badge>
                                          ))
                                        )}
                                      </div>
                                      {event.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 break-words">{event.description}</p>
                                      )}
                                    </div>
                                    {isAdmin && event.type !== 'announcement' && (
                                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(event)}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => setDeleteEvent(event)}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Upcoming Events */}
            {upcomingEvents.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Prochains événements
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {upcomingEvents.map(event => {
                      const cfg = getTypeConfig(event.type)
                      return (
                        <div key={event.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.text}`}>
                              {getTypeIcon(event.type)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{event.title}</p>
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-xs text-muted-foreground shrink-0">{formatDateShort(event.date)}</span>
                              {event.isGlobal ? (
                                <Badge variant="outline" className="text-[8px] h-3.5 px-1 text-teal-600 border-teal-300 shrink-0">
                                  <Globe className="w-2 h-2 mr-0.5" />Tout
                                </Badge>
                              ) : event.classes.length > 0 && (
                                event.classes.slice(0, 2).map(ec => (
                                  <Badge key={ec.classId} variant="outline" className="text-[8px] h-3.5 px-1 text-purple-600 border-purple-300 shrink-0 truncate max-w-[100px]">
                                    {ec.class.name}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className={`text-xs ${cfg.text} border-current/20 shrink-0 self-start sm:self-auto`}>
                            {cfg.label}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Create/Edit Event Dialog ===== */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Modifier l\'événement' : 'Nouvel événement'}</DialogTitle>
            <DialogDescription>
              {editingEvent ? 'Modifiez les détails de l\'événement' : 'Ajoutez un nouvel événement au calendrier scolaire'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">Titre *</Label>
              <Input
                id="event-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: Vacances de Noël"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-type">Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ===== Scope: Global or Class-specific ===== */}
            <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Portée de l&apos;événement</Label>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => { setFormIsGlobal(true); setFormClassIds([]) }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    formIsGlobal
                      ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400'
                      : 'border-muted bg-background text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  <span className="truncate">Tout l&apos;établissement</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormIsGlobal(false)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    !formIsGlobal
                      ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400'
                      : 'border-muted bg-background text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 shrink-0" />
                  <span className="truncate">Classes spécifiques</span>
                </button>
              </div>

              {/* Class selection (visible when not global) */}
              {!formIsGlobal && (
                <div className="space-y-2 pt-1">
                  <Label className="text-xs text-muted-foreground">
                    Sélectionnez les classes concernées *
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableClasses.map(cls => {
                      const isSelected = formClassIds.includes(cls.id)
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => {
                            setFormClassIds(prev =>
                              isSelected
                                ? prev.filter(id => id !== cls.id)
                                : [...prev, cls.id]
                            )
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 font-medium'
                              : 'border-muted bg-background text-muted-foreground hover:bg-muted/50'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-muted-foreground/40'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="truncate">{cls.name}</span>
                        </button>
                      )
                    })}
                  </div>
                  {formClassIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formClassIds.length} classe{formClassIds.length > 1 ? 's' : ''} sélectionnée{formClassIds.length > 1 ? 's' : ''}
                    </p>
                  )}
                  {formClassIds.length === 0 && (
                    <p className="text-xs text-amber-600">
                      Veuillez sélectionner au moins une classe
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="event-date">Date de début *</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-end-date">Date de fin</Label>
                <Input
                  id="event-end-date"
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  min={formDate}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea
                id="event-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Détails de l'événement (optionnel)"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEventDialog(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || !formTitle.trim() || !formDate || (!formIsGlobal && formClassIds.length === 0)}>
              {saving ? 'Enregistrement...' : editingEvent ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirmation Dialog ===== */}
      <AlertDialog open={!!deleteEvent} onOpenChange={(open) => !open && setDeleteEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l&apos;événement</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l&apos;événement &quot;{deleteEvent?.title}&quot; ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
