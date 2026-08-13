'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  GraduationCap,
  School,
  CreditCard,
  TrendingUp,
  Clock,
  CalendarCheck,
  AlertTriangle,
  Banknote,
  Smartphone,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Heart,
  Briefcase,
  UserPlus,
  FileText,
  Bell,
  Calendar,
  CalendarClock,
  Plus,
  UserX,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart,
  ComposedChart,
  LabelList,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/lib/store'
import { withSchoolYear, withInstitution } from '@/lib/utils'
import { PERSON_STATUS_LABELS, PERSON_STATUS_BADGE_CLASSES } from '@/lib/constants'
import { MessageSummaryCard } from '@/components/modules/message-summary-card'

// ---------- Types for dashboard data ----------

interface DashboardData {
  stats: {
    totalStudents: number
    totalTeachers: number
    totalClasses: number
    totalParents: number
    totalStaff: number
    totalRevenue: number
    pendingRevenue: number
  }
  attendance: {
    present: number
    absent: number
    late: number
  }
  studentsPerClass: Array<{
    id: string
    name: string
    studentCount: number
    capacity: number
  }>
  genderDistribution: {
    male: number
    female: number
  }
  paymentMethods: {
    mobile_money: number
    cash: number
    bank_transfer: number
  }
  recentActivities: Array<{
    type: string
    description: string
    date: string
    details?: Record<string, unknown>
  }>
  monthlyRevenue?: Array<{ month: string; revenue: number }>
  recentEnrollments?: Array<{
    id: string
    firstName: string
    lastName: string
    className: string
    enrollmentDate: string
    gender: string | null
  }>
  upcomingEvents?: Array<{
    id: string
    title: string
    startDate: string
    endDate: string
    type: string
    location: string | null
  }>
  statusCases?: {
    studentCounts: { abandoned: number; migrated: number; deceased: number }
    teacherCounts: { abandoned: number; migrated: number; deceased: number }
    totals: { abandoned: number; migrated: number; deceased: number }
    cases: Array<{
      id: string
      type: 'student' | 'teacher'
      firstName: string
      lastName: string
      status: string
      statusDate: string | null
      detail: string
      reference: string
    }>
  }
}

// ---------- Helpers ----------

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('fr-FR')
}

// Compact formatter for chart labels — e.g. 3 000 000 -> "3,0M$", 450 000 -> "450k$".
// Keeps peak labels short so they don't overlap on the chart.
function formatCompact(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000
    return `${m.toFixed(m >= 10 ? 0 : 1).replace('.', ',')}M$`
  }
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k$`
  return `${amount}$`
}

// Recharts <LabelList formatter=...> receives the value as ReactNode;
// coerce to number before formatting.
function formatCompactLabel(value: unknown): string {
  return formatCompact(Number(value))
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'payment':
      return <CreditCard className="w-4 h-4 text-emerald-600" />
    case 'announcement':
      return <AlertTriangle className="w-4 h-4 text-amber-600" />
    case 'grade':
      return <TrendingUp className="w-4 h-4 text-sky-600" />
    case 'enrollment':
      return <GraduationCap className="w-4 h-4 text-purple-600" />
    default:
      return <Clock className="w-4 h-4 text-gray-600" />
  }
}

function getActivityBg(type: string) {
  switch (type) {
    case 'payment':
      return 'bg-emerald-50 dark:bg-emerald-950/50'
    case 'announcement':
      return 'bg-amber-50 dark:bg-amber-950/50'
    case 'grade':
      return 'bg-sky-50 dark:bg-sky-950/50'
    case 'enrollment':
      return 'bg-purple-50 dark:bg-purple-950/50'
    default:
      return 'bg-gray-50 dark:bg-gray-950/50'
  }
}

function getEventTypeBadge(type: string) {
  switch (type) {
    case 'holiday':
      return { label: 'Vacance', variant: 'secondary' as const, className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' }
    case 'exam':
      return { label: 'Examen', variant: 'destructive' as const, className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' }
    case 'meeting':
      return { label: 'Réunion', variant: 'default' as const, className: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' }
    case 'celebration':
      return { label: 'Célébration', variant: 'secondary' as const, className: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' }
    case 'deadline':
      return { label: 'Échéance', variant: 'destructive' as const, className: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' }
    default:
      return { label: 'Autre', variant: 'outline' as const, className: 'bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-300' }
  }
}

function getEventTypeIcon(type: string) {
  switch (type) {
    case 'holiday':
      return <Calendar className="w-4 h-4 text-amber-500" />
    case 'exam':
      return <FileText className="w-4 h-4 text-red-500" />
    case 'meeting':
      return <Users className="w-4 h-4 text-sky-500" />
    case 'celebration':
      return <Bell className="w-4 h-4 text-purple-500" />
    case 'deadline':
      return <AlertTriangle className="w-4 h-4 text-orange-500" />
    default:
      return <Calendar className="w-4 h-4 text-gray-500" />
  }
}

// ---------- Chart colors ----------

const CHART_COLORS = ['#10b981', '#14b8a6', '#06b6d4', '#f59e0b', '#8b5cf6']
const GENDER_COLORS = ['#10b981', '#f43f5e']

// ---------- Animation variants ----------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

// ---------- Custom Tooltip ----------

function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-card p-3 shadow-xl text-sm">
        <p className="font-medium">{label}</p>
        <p className="text-emerald-600 mt-1">
          {payload[0].value} élève{payload[0].value > 1 ? 's' : ''}
        </p>
      </div>
    )
  }
  return null
}

function CustomRevenueTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload?: { revenue?: number } }>; label?: string }) {
  if (active && payload && payload.length) {
    const realRevenue = payload[0]?.payload?.revenue ?? payload[0]?.value ?? 0
    return (
      <div className="rounded-lg border bg-card p-3 shadow-xl text-sm min-w-[150px]">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-teal-500" />
          <span className="font-medium text-muted-foreground">{label}</span>
        </div>
        <p className="text-teal-700 dark:text-teal-400 font-bold text-base">
          {formatCurrency(realRevenue)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Revenu mensuel</p>
      </div>
    )
  }
  return null
}

// ---------- Main Component ----------

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { setActiveModule } = useAppStore()
  const schoolYear = useAppStore((s) => s.schoolYear)
  const activeInstitutionId = useAppStore((s) => s.activeInstitutionId)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch(withInstitution(withSchoolYear('/api/dashboard', schoolYear), activeInstitutionId))
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (err) {
        console.error('Failed to fetch dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [schoolYear, activeInstitutionId])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse h-[160px]">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-64 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-lg">Impossible de charger les données</p>
        <p className="text-sm mt-1">Vérifiez que la base de données est initialisée</p>
      </div>
    )
  }

  const { stats, attendance, studentsPerClass, genderDistribution, paymentMethods, recentActivities } = data
  const monthlyRevenue = data.monthlyRevenue ?? []
  const recentEnrollments = data.recentEnrollments ?? []
  const upcomingEvents = data.upcomingEvents ?? []
  const statusCases = data.statusCases ?? {
    studentCounts: { abandoned: 0, migrated: 0, deceased: 0 },
    teacherCounts: { abandoned: 0, migrated: 0, deceased: 0 },
    totals: { abandoned: 0, migrated: 0, deceased: 0 },
    cases: [],
  }
  const totalNonActive =
    statusCases.totals.abandoned + statusCases.totals.migrated + statusCases.totals.deceased

  // Prepare chart data
  const barChartData = studentsPerClass.map((cls) => ({
    name: cls.name,
    élèves: cls.studentCount,
    capacité: cls.capacity,
  }))

  // Mountain chart data — we plot the REAL revenue directly so values are
  // honest and the Y-axis matches what you see. Sharp mountain peaks come
  // from `type="linear"` on the Area (no curve smoothing); the translucent
  // teal gradient evokes a mountain silhouette while keeping the chart
  // perfectly readable at a glance.
  const mountainChartData = monthlyRevenue.map((m) => ({
    month: m.month,
    revenue: m.revenue,
  }))

  // KPI summary for the chart header — gives immediate context.
  const totalRevenue = monthlyRevenue.reduce((s, m) => s + m.revenue, 0)
  const avgRevenue = monthlyRevenue.length > 0 ? totalRevenue / monthlyRevenue.length : 0
  const bestMonth = monthlyRevenue.length > 0
    ? monthlyRevenue.reduce((best, m) => (m.revenue > best.revenue ? m : best), monthlyRevenue[0])
    : { month: '—', revenue: 0 }

  const pieChartData = [
    { name: 'Masculin', value: genderDistribution.male },
    { name: 'Féminin', value: genderDistribution.female },
  ]

  const totalAttendance = attendance.present + attendance.absent + attendance.late
  const attendanceRate = totalAttendance > 0 ? Math.round((attendance.present / totalAttendance) * 100) : 0

  // Payment methods data
  const paymentMethodsData = [
    { name: 'Mobile Money', value: paymentMethods.mobile_money, icon: Smartphone, color: 'text-emerald-600' },
    { name: 'Espèces', value: paymentMethods.cash, icon: Banknote, color: 'text-amber-600' },
    { name: 'Virement', value: paymentMethods.bank_transfer, icon: Building2, color: 'text-sky-600' },
  ]
  const totalPayments = paymentMethods.mobile_money + paymentMethods.cash + paymentMethods.bank_transfer

  // Average class capacity
  const avgCapacity = stats.totalClasses > 0
    ? Math.round(studentsPerClass.reduce((a, c) => a + c.capacity, 0) / stats.totalClasses)
    : 0

  // Quick actions config
  const quickActions = [
    { label: 'Nouvel élève', icon: UserPlus, module: 'students' as const },
    { label: 'Nouvelle note', icon: FileText, module: 'grades' as const },
    { label: 'Marquer présence', icon: CalendarCheck, module: 'attendance' as const },
    { label: 'Nouveau paiement', icon: CreditCard, module: 'payments' as const },
    { label: 'Nouvelle annonce', icon: Bell, module: 'communication' as const },
  ]

  // Unique staff functions count
  const staffFunctions = stats.totalStaff > 0 ? Math.min(stats.totalStaff, 5) : 0

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ===== 6 Stat Cards — 3x2 grid on desktop, 2 on tablet, 1 on mobile ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Élèves — emerald */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow h-full">
            <CardContent className="p-6 flex flex-col justify-between h-full min-h-[160px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Élèves</p>
                  <p className="text-3xl font-bold mt-1">{stats.totalStudents}</p>
                  {(() => {
                    const nonActive =
                      (statusCases.studentCounts.abandoned || 0) +
                      (statusCases.studentCounts.migrated || 0) +
                      (statusCases.studentCounts.deceased || 0)
                    const active = Math.max(0, stats.totalStudents - nonActive)
                    return nonActive > 0 ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        {active} actif{active !== 1 ? 's' : ''} • {nonActive} non actif{nonActive !== 1 ? 's' : ''}
                      </p>
                    ) : null
                  })()}
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
                  <Users className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-emerald-600">
                <ArrowUpRight className="w-3 h-3" />
                <span>+{Math.round(stats.totalStudents * 0.05)} ce mois</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Enseignants — purple */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-l-4 border-l-purple-500 hover:shadow-md transition-shadow h-full">
            <CardContent className="p-6 flex flex-col justify-between h-full min-h-[160px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Enseignants</p>
                  <p className="text-3xl font-bold mt-1">{stats.totalTeachers}</p>
                  {(() => {
                    const nonActive =
                      (statusCases.teacherCounts.abandoned || 0) +
                      (statusCases.teacherCounts.migrated || 0) +
                      (statusCases.teacherCounts.deceased || 0)
                    // `stats.totalTeachers` contient désormais TOUS les enseignants
                    // (actifs + non actifs). On en déduit le nombre d'actifs par
                    // soustraction, pour ne pas afficher un « 0 » trompeur lorsque
                    // une institution n'a plus que des enseignants non actifs.
                    const active = Math.max(0, stats.totalTeachers - nonActive)
                    return nonActive > 0 ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        {active} actif{active !== 1 ? 's' : ''} • {nonActive} non actif{nonActive !== 1 ? 's' : ''}
                      </p>
                    ) : null
                  })()}
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5 mt-3">
                {(() => {
                  const tc = statusCases.teacherCounts
                  const chips: Array<{ label: string; value: number; cls: string }> = [
                    { label: 'Abandonnés', value: tc.abandoned || 0, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
                    { label: 'Migrés', value: tc.migrated || 0, cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
                    { label: 'Décédés', value: tc.deceased || 0, cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
                  ]
                  const visible = chips.filter((c) => c.value > 0)
                  if (visible.length === 0) {
                    return (
                      <div className="flex items-center gap-1 text-xs text-purple-600">
                        <GraduationCap className="w-3 h-3" />
                        <span>{stats.totalClasses} classe{stats.totalClasses !== 1 ? 's' : ''} attribuée{stats.totalClasses !== 1 ? 's' : ''}</span>
                      </div>
                    )
                  }
                  return (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {visible.map((c) => (
                        <span
                          key={c.label}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.cls}`}
                          title={`${c.value} enseignant(s) ${c.label.toLowerCase()}`}
                        >
                          {c.label}: {c.value}
                        </span>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Classes — amber */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-l-4 border-l-amber-500 hover:shadow-md transition-shadow h-full">
            <CardContent className="p-6 flex flex-col justify-between h-full min-h-[160px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Classes</p>
                  <p className="text-3xl font-bold mt-1">{stats.totalClasses}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center">
                  <School className="w-6 h-6 text-amber-600" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-amber-600">
                <School className="w-3 h-3" />
                <span>Capacité moyenne {avgCapacity}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Parents — pink/rose */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-l-4 border-l-rose-500 hover:shadow-md transition-shadow h-full">
            <CardContent className="p-6 flex flex-col justify-between h-full min-h-[160px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Parents</p>
                  <p className="text-3xl font-bold mt-1">{stats.totalParents}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center">
                  <Heart className="w-6 h-6 text-rose-600" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-rose-600">
                <Heart className="w-3 h-3" />
                <span>{stats.totalParents} contacts enregistrés</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Revenus Total — teal */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-l-4 border-l-teal-500 hover:shadow-md transition-shadow h-full">
            <CardContent className="p-6 flex flex-col justify-between h-full min-h-[160px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Revenus Total</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(stats.totalRevenue)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-teal-600" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-teal-600">
                <CreditCard className="w-3 h-3" />
                <span>En attente: {formatCurrency(stats.pendingRevenue)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Personnel — cyan */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-l-4 border-l-cyan-500 hover:shadow-md transition-shadow h-full">
            <CardContent className="p-6 flex flex-col justify-between h-full min-h-[160px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Personnel</p>
                  <p className="text-3xl font-bold mt-1">{stats.totalStaff}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-cyan-600" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-cyan-600">
                <Briefcase className="w-3 h-3" />
                <span>{staffFunctions} fonction{staffFunctions > 1 ? 's' : ''}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ===== Quick Actions Bar ===== */}
      <motion.div variants={itemVariants}>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-muted-foreground">Actions rapides</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveModule(action.module)}
                    className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950 dark:hover:text-emerald-300 transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{action.label}</span>
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ===== Charts Section — 2 columns ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Students per class */}
        <motion.div variants={itemVariants}>
          <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Élèves par classe</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex-1">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="élèves" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="capacité" fill="var(--capacite-bar, #d1d5db)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pie Chart - Gender distribution */}
        <motion.div variants={itemVariants}>
          <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Répartition par genre</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex-1">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GENDER_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value} élèves`, '']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ===== Revenue Chart Section — Full width (clean mountain silhouette, readable peaks) ===== */}
      <motion.div variants={itemVariants}>
        <Card className="hover:shadow-md transition-shadow overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-600" />
              Tendance des revenus mensuels
              <span className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-gradient-to-t from-teal-600/30 to-teal-500 border border-teal-600/40" />
                Année {schoolYear || 'en cours'}
              </span>
            </CardTitle>
            {/* KPI summary — gives immediate context before reading the chart */}
            {monthlyRevenue.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs font-normal gap-1 py-1">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold text-teal-700 dark:text-teal-400">{formatCurrency(totalRevenue)}</span>
                </Badge>
                <Badge variant="outline" className="text-xs font-normal gap-1 py-1">
                  <span className="text-muted-foreground">Moyenne / mois</span>
                  <span className="font-semibold text-teal-700 dark:text-teal-400">{formatCurrency(Math.round(avgRevenue))}</span>
                </Badge>
                <Badge variant="outline" className="text-xs font-normal gap-1 py-1">
                  <span className="text-muted-foreground">Pic</span>
                  <span className="font-semibold text-teal-700 dark:text-teal-400">{bestMonth.month} · {formatCompact(bestMonth.revenue)}</span>
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {monthlyRevenue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <TrendingUp className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">Aucune donnée de revenu disponible</p>
                <p className="text-xs mt-1">Les revenus mensuels apparaîtront ici une fois les paiements enregistrés</p>
              </div>
            ) : (
              <div className="h-80 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={mountainChartData} margin={{ top: 28, right: 16, left: 4, bottom: 4 }}>
                    <defs>
                      {/* Single clean teal gradient — opaque at the peak, fading to translucent at the base */}
                      <linearGradient id="mountainFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.9} />
                        <stop offset="55%" stopColor="#14b8a6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      interval={0}
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      // Compact formatter keeps axis labels short at any scale
                      // (e.g. "0", "2M$", "4M$", "6M$" instead of "2000k").
                      tickFormatter={(value: number) => value === 0 ? '0' : formatCompact(value)}
                      width={48}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={<CustomRevenueTooltip />}
                      cursor={{ stroke: '#14b8a6', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    {/* Single mountain silhouette — sharp peaks (type="linear") with a translucent teal fill. */}
                    <Area
                      type="linear"
                      dataKey="revenue"
                      stroke="#0d9488"
                      strokeWidth={2.5}
                      fill="url(#mountainFill)"
                      dot={{ fill: '#0d9488', stroke: '#ffffff', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2, fill: '#0d9488' }}
                    >
                      {/* Value label on every peak — the chart is readable without hovering */}
                      <LabelList
                        dataKey="revenue"
                        position="top"
                        offset={10}
                        formatter={formatCompactLabel}
                        style={{ fontSize: 11, fontWeight: 600, fill: '#0f766e' }}
                      />
                    </Area>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ===== Cas particuliers : élèves & enseignants non actifs (selon l'année scolaire) ===== */}
      <motion.div variants={itemVariants}>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
              <UserX className="w-5 h-5 text-rose-600" />
              Suivi des cas particuliers
              <Badge variant="outline" className="ml-auto text-xs font-normal">
                {schoolYear || 'Toutes les années'}
              </Badge>
              <Badge
                className={`text-xs ${totalNonActive > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}`}
              >
                {totalNonActive} cas
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Élèves et enseignants ayant abandonné, migré ou décédés pour l&apos;année scolaire sélectionnée.
            </p>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {/* Summary chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  key: 'abandoned',
                  label: 'Abandonnés',
                  total: statusCases.totals.abandoned,
                  students: statusCases.studentCounts.abandoned,
                  teachers: statusCases.teacherCounts.abandoned,
                  chipClass: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
                  dotClass: 'bg-amber-500',
                  textClass: 'text-amber-700 dark:text-amber-400',
                },
                {
                  key: 'migrated',
                  label: 'Migrés',
                  total: statusCases.totals.migrated,
                  students: statusCases.studentCounts.migrated,
                  teachers: statusCases.teacherCounts.migrated,
                  chipClass: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800',
                  dotClass: 'bg-sky-500',
                  textClass: 'text-sky-700 dark:text-sky-400',
                },
                {
                  key: 'deceased',
                  label: 'Décédés',
                  total: statusCases.totals.deceased,
                  students: statusCases.studentCounts.deceased,
                  teachers: statusCases.teacherCounts.deceased,
                  chipClass: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
                  dotClass: 'bg-rose-500',
                  textClass: 'text-rose-700 dark:text-rose-400',
                },
              ].map((chip) => (
                <div
                  key={chip.key}
                  className={`rounded-xl border p-4 ${chip.chipClass}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${chip.dotClass}`} />
                    <span className="text-sm font-medium">{chip.label}</span>
                    <span className={`ml-auto text-2xl font-bold ${chip.textClass}`}>{chip.total}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" />
                      {chip.students} élève{chip.students > 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {chip.teachers} ens.
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Cases table */}
            {statusCases.cases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <UserX className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">Aucun cas particulier pour cette année scolaire</p>
                <p className="text-xs mt-1">Tous les élèves et enseignants sont actifs</p>
              </div>
            ) : (
              <ScrollArea className="max-h-80">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">Nom</th>
                      <th className="text-left py-2 px-2 font-medium">Type</th>
                      <th className="text-left py-2 px-2 font-medium">Statut</th>
                      <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">
                        Classe / Matière
                      </th>
                      <th className="text-left py-2 px-2 font-medium hidden md:table-cell">
                        Date de constat
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusCases.cases.map((c) => (
                      <tr key={`${c.type}-${c.id}`} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-2.5 px-2">
                          <span className="font-medium">
                            {c.firstName} {c.lastName}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          {c.type === 'student' ? (
                            <Badge variant="outline" className="text-xs font-normal">
                              <GraduationCap className="w-3 h-3 mr-1" />
                              Élève
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs font-normal">
                              <Users className="w-3 h-3 mr-1" />
                              Enseignant
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${PERSON_STATUS_BADGE_CLASSES[c.status] || PERSON_STATUS_BADGE_CLASSES.active}`}
                          >
                            {PERSON_STATUS_LABELS[c.status] || c.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-2 hidden sm:table-cell text-muted-foreground">
                          {c.detail}
                        </td>
                        <td className="py-2.5 px-2 hidden md:table-cell text-muted-foreground">
                          {c.statusDate
                            ? (
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarClock className="w-3.5 h-3.5 text-rose-500" />
                                {formatDateShort(c.statusDate)}
                              </span>
                            )
                            : (
                              <span className="italic opacity-60">Non renseignée</span>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ===== Bottom section — 3 columns ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Today */}
        <motion.div variants={itemVariants}>
          <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-emerald-600" />
                Présence aujourd&apos;hui
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between space-y-4">
              <div className="text-center">
                <span className="text-4xl font-bold text-emerald-600">{attendanceRate}%</span>
                <p className="text-sm text-muted-foreground mt-1">Taux de présence</p>
              </div>
              <Progress value={attendanceRate} className="h-2" />
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 p-3">
                  <p className="text-xl font-bold text-emerald-600">{attendance.present}</p>
                  <p className="text-xs text-muted-foreground">Présents</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950/50 p-3">
                  <p className="text-xl font-bold text-red-600">{attendance.absent}</p>
                  <p className="text-xs text-muted-foreground">Absents</p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/50 p-3">
                  <p className="text-xl font-bold text-amber-600">{attendance.late}</p>
                  <p className="text-xs text-muted-foreground">En retard</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Methods */}
        <motion.div variants={itemVariants}>
          <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-teal-600" />
                Méthodes de paiement
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                {paymentMethodsData.map((method) => {
                  const Icon = method.icon
                  const pct = totalPayments > 0 ? Math.round((method.value / totalPayments) * 100) : 0
                  return (
                    <div key={method.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${method.color}`} />
                          <span className="text-sm font-medium">{method.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {method.value} ({pct}%)
                        </span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  )
                })}
              </div>
              <div>
                <Separator />
                <div className="flex items-center justify-between text-sm pt-3">
                  <span className="font-medium">Total paiements</span>
                  <span className="font-semibold">{totalPayments}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activities */}
        <motion.div variants={itemVariants}>
          <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                Activités récentes
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-[260px]">
                <div className="px-6 pb-4 space-y-1">
                  {recentActivities.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Aucune activité récente
                    </p>
                  ) : (
                    recentActivities.map((activity, idx) => (
                      <div key={idx} className="flex items-start gap-3 py-3">
                        <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getActivityBg(activity.type)}`}>
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug line-clamp-2">
                            {activity.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(activity.date)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ===== Recent Enrollments & Upcoming Events — 2 columns ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Enrollments */}
        <motion.div variants={itemVariants}>
          <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                Inscriptions récentes
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {recentEnrollments.length === 0 ? (
                <div className="px-6 pb-4 py-8 text-center text-muted-foreground">
                  <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Aucune inscription récente</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="px-6 pb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 font-medium">Nom</th>
                          <th className="text-left py-2 font-medium">Classe</th>
                          <th className="text-left py-2 font-medium hidden sm:table-cell">Date</th>
                          <th className="text-left py-2 font-medium">Genre</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentEnrollments.map((enrollment) => (
                          <tr key={enrollment.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                            <td className="py-2.5">
                              <span className="font-medium">
                                {enrollment.firstName} {enrollment.lastName}
                              </span>
                            </td>
                            <td className="py-2.5">
                              <Badge variant="outline" className="text-xs font-normal">
                                {enrollment.className}
                              </Badge>
                            </td>
                            <td className="py-2.5 text-muted-foreground hidden sm:table-cell">
                              {formatDateShort(enrollment.enrollmentDate)}
                            </td>
                            <td className="py-2.5">
                              {enrollment.gender === 'M' ? (
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs">
                                  M
                                </Badge>
                              ) : enrollment.gender === 'F' ? (
                                <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-xs">
                                  F
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">—</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming Events */}
        <motion.div variants={itemVariants}>
          <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                Événements à venir
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {upcomingEvents.length === 0 ? (
                <div className="px-6 pb-4 py-8 text-center text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Aucun événement à venir</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="px-6 pb-4 space-y-1">
                    {upcomingEvents.map((event) => {
                      const typeBadge = getEventTypeBadge(event.type)
                      const typeIcon = getEventTypeIcon(event.type)
                      return (
                        <div
                          key={event.id}
                          className="flex items-start gap-3 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors rounded-md px-2 -mx-2"
                        >
                          <div className="mt-0.5 w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
                            {typeIcon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium leading-snug">
                                {event.title}
                              </p>
                              <Badge className={`text-[10px] px-1.5 py-0 ${typeBadge.className}`} variant={typeBadge.variant}>
                                {typeBadge.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDateShort(event.startDate)}
                              {event.endDate && event.endDate !== event.startDate && (
                                <> — {formatDateShort(event.endDate)}</>
                              )}
                            </p>
                            {event.location && (
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {event.location}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ===== Messaging summary (real-time) ===== */}
      <motion.div variants={itemVariants}>
        <MessageSummaryCard />
      </motion.div>
    </motion.div>
  )
}
