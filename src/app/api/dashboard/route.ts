import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { resolveInstitutionScope } from '@/lib/institution-scope'

// Détection au runtime de la présence de la colonne `status` sur Student/Teacher.
// Sur une base de données plus ancienne (avant `prisma db push`), la colonne peut
// manquer. Au lieu de faire planter tout le tableau de bord (P2022), on détecte
// sa présence une fois pour toutes et on degrade gracieusement : on renvoie tous
// les enregistrements sans filtrer par statut, et la section « cas particuliers »
// est vide. Le script `predev` (package.json) finit par ajouter la colonne, après
// quoi ce cache est invalidé au redémarrage du serveur.
let statusColumnAvailable: boolean | null = null

async function checkStatusColumn(): Promise<boolean> {
  if (statusColumnAvailable !== null) return statusColumnAvailable
  try {
    // Sonde peu coûteuse : si la colonne manque, Prisma lève P2022.
    await db.student.findFirst({ where: { status: 'active' }, select: { id: true } })
    statusColumnAvailable = true
  } catch {
    statusColumnAvailable = false
  }
  return statusColumnAvailable
}

export async function GET(request: Request) {
  try {
    // ---- Strict institution isolation ----
    // Regular users (admin/teacher/student/parent/staff) see ONLY their own
    // institution's data (institutionId derived from their DB record, NOT from
    // the forgeable x-institution-id header). Super admin sees the browsed
    // institution when one is selected, or ALL institutions when in overview
    // mode (institutionId = null → no filter → aggregate across all).
    const scope = await resolveInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId
    const { searchParams } = new URL(request.url)
    const schoolYear = searchParams.get('schoolYear')

    // Build institution-aware filters
    // - Class has a direct institutionId field
    // - Student/Teacher/Parent/Staff link through User.institutionId
    // - Payment/Grade/Attendance link through Student → User.institutionId
    // - Announcement links through author (User).institutionId
    const instClassFilter = institutionId ? { institutionId } : {}
    const instUserFilter = institutionId ? { user: { institutionId } } : {}
    const instStudentFilter = institutionId ? { student: { user: { institutionId } } } : {}
    const instAuthorFilter = institutionId ? { author: { institutionId } } : {}

    // Filtres par année scolaire (SchoolYear)
    // - Student n'a pas de champ schoolYear direct → on filtre via sa classe
    // - Class/Payment/Grade/Attendance/Announcement/SchoolEvent ont un champ schoolYear direct
    const yearStudentFilter = schoolYear ? { class: { schoolYear } } : {}
    const yearDirectFilter = schoolYear ? { schoolYear } : {}
    // Teachers link to a school year through their assigned classes (ClassTeacher → Class).
    // A newly created teacher with no classes is still shown (mirrors /api/teachers behaviour).
    const yearTeacherFilter = schoolYear
      ? { OR: [{ classes: { some: { class: { schoolYear } } } }, { classes: { none: {} } }] }
      : {}

    // Détection de la colonne `status` pour les filtres « actifs uniquement »
    // utilisés plus bas (répartition par genre, inscriptions récentes, cas
    // particuliers). Les totaux principaux (Total Élèves / Total Enseignants)
    // incluent tous les statuts, mais ces sous-sections n'affichent que les
    // actifs pour éviter de faire apparaître des élèves abandonnés/migrés/
    // décédés dans les graphiques et listes d'activité récente.
    // Si la colonne `status` n'existe pas en base (base obsolète avant db push),
    // on dégrade gracieusement : filtre vide = tous les enregistrements.
    const hasStatus = await checkStatusColumn()
    const activeStudentFilter = hasStatus ? { status: 'active' as const } : {}

    // Total counts — scoped by institution
    // Les totaux « Total Élèves » et « Total Enseignants » affichent TOUS les
    // effectifs (actifs + non actifs), afin d'être cohérents avec la page de
    // liste des élèves/enseignants qui affiche tous les statuts par défaut.
    // Le détail des non-actifs (abandons, migrations, décès) est disponible
    // plus bas dans la section « Cas particuliers » et via statusCases.
    const [totalStudents, totalTeachers, totalClasses, totalParents, totalStaff] = await Promise.all([
      db.student.count({ where: { ...instUserFilter, ...yearStudentFilter } }),
      db.teacher.count({ where: { ...instUserFilter, ...yearTeacherFilter } }),
      db.class.count({ where: { ...instClassFilter, ...yearDirectFilter } }),
      db.parent.count({ where: instUserFilter }),
      db.staff.count({ where: instUserFilter }),
    ])

    // Revenue: sum of completed payments (scoped by student → user → institution)
    const completedPayments = await db.payment.findMany({
      where: { status: 'completed', ...instStudentFilter, ...yearDirectFilter },
      select: { amount: true },
    })
    const totalRevenue = completedPayments.reduce((sum, p) => sum + p.amount, 0)

    // Pending payments
    const pendingPayments = await db.payment.findMany({
      where: { status: 'pending', ...instStudentFilter, ...yearDirectFilter },
      select: { amount: true },
    })
    const pendingRevenue = pendingPayments.reduce((sum, p) => sum + p.amount, 0)

    // Attendance stats for today (scoped by student → user → institution)
    const today = new Date().toISOString().split('T')[0]
    const todayAttendance = await db.attendance.findMany({
      where: { date: today, ...instStudentFilter, ...yearDirectFilter },
      select: { status: true },
    })

    const presentCount = todayAttendance.filter((a) => a.status === 'present').length
    const absentCount = todayAttendance.filter((a) => a.status === 'absent').length
    const lateCount = todayAttendance.filter((a) => a.status === 'late').length

    // Recent activities (latest 10) — scoped by institution
    const recentPayments = await db.payment.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      where: { ...instStudentFilter, ...yearDirectFilter },
      include: {
        student: {
          select: { firstName: true, lastName: true },
        },
      },
    })

    const recentAnnouncements = await db.announcement.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      where: { ...instAuthorFilter, ...yearDirectFilter },
      include: {
        author: {
          select: { name: true },
        },
      },
    })

    const recentGrades = await db.grade.findMany({
      take: 4,
      orderBy: { createdAt: 'desc' },
      where: { ...instStudentFilter, ...yearDirectFilter },
      include: {
        student: {
          select: { firstName: true, lastName: true },
        },
        subject: {
          select: { name: true },
        },
      },
    })

    // Students per class (scoped by institution + schoolYear)
    const classStats = await db.class.findMany({
      where: { ...instClassFilter, ...yearDirectFilter },
      include: {
        _count: {
          select: { students: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const studentsPerClass = classStats.map((cls) => ({
      id: cls.id,
      name: cls.name,
      studentCount: cls._count.students,
      capacity: cls.capacity,
    }))

    // Gender distribution (scoped by institution + schoolYear) — active students only
    const maleStudents = await db.student.count({
      where: { gender: 'M', ...instUserFilter, ...yearStudentFilter, ...activeStudentFilter },
    })
    const femaleStudents = await db.student.count({
      where: { gender: 'F', ...instUserFilter, ...yearStudentFilter, ...activeStudentFilter },
    })

    // Payment method distribution (scoped by institution + schoolYear)
    const mobileMoneyPayments = await db.payment.count({
      where: { method: 'mobile_money', ...instStudentFilter, ...yearDirectFilter },
    })
    const cashPayments = await db.payment.count({
      where: { method: 'cash', ...instStudentFilter, ...yearDirectFilter },
    })
    const bankTransferPayments = await db.payment.count({
      where: { method: 'bank_transfer', ...instStudentFilter, ...yearDirectFilter },
    })

    // Monthly revenue trend — based on `paymentDate` (the real date the payment was
    // made), NOT `createdAt` (which reflects when the DB record was inserted, e.g.
    // the seed date, and would lump all payments into a single month).
    // We group completed payments by YYYY-MM, then fill the gaps between the
    // earliest and latest month so the mountain silhouette is continuous.
    // Scope: institution + selected school year. Falls back to the last 6
    // calendar months (empty) when there is no payment data.
    const monthlyRevenue: Array<{ month: string; revenue: number }> = []
    try {
      const trendPayments = await db.payment.findMany({
        where: {
          status: 'completed',
          ...instStudentFilter,
          ...yearDirectFilter,
          paymentDate: { not: null },
        },
        select: { amount: true, paymentDate: true },
      })

      // Group by YYYY-MM
      const byMonth = new Map<string, number>()
      for (const p of trendPayments) {
        const pd = p.paymentDate
        if (!pd || pd.length < 7) continue
        const ym = pd.slice(0, 7) // YYYY-MM
        byMonth.set(ym, (byMonth.get(ym) || 0) + p.amount)
      }

      if (byMonth.size > 0) {
        const sortedMonths = Array.from(byMonth.keys()).sort()
        // Cap to the most recent 12 months to keep the chart readable.
        const trimmed = sortedMonths.slice(-12)
        const [minY, minM] = trimmed[0].split('-').map(Number)
        const [maxY, maxM] = trimmed[trimmed.length - 1].split('-').map(Number)

        // Walk month by month from min to max, filling gaps with 0.
        let cy = minY
        let cm = minM
        while (cy < maxY || (cy === maxY && cm <= maxM)) {
          const ym = `${cy}-${String(cm).padStart(2, '0')}`
          const date = new Date(cy, cm - 1, 1)
          // Include the 2-digit year so months spanning two calendar years
          // (e.g. a school year Sep→Jun) remain unambiguous on the X axis.
          const label = date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
          monthlyRevenue.push({ month: label, revenue: byMonth.get(ym) || 0 })
          cm++
          if (cm > 12) {
            cm = 1
            cy++
          }
        }
      } else {
        // No payment data for this scope — show the last 6 calendar months as empty.
        const now = new Date()
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          monthlyRevenue.push({
            month: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
            revenue: 0,
          })
        }
      }
    } catch {
      // Defensive fallback: last 6 calendar months, empty.
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        monthlyRevenue.push({
          month: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
          revenue: 0,
        })
      }
    }

    // Recent enrollments (last 5 students, scoped by institution + schoolYear) — active only
    const recentEnrollmentRecords = await db.student.findMany({
      take: 5,
      orderBy: { enrollmentDate: 'desc' },
      where: { ...instUserFilter, ...yearStudentFilter, ...activeStudentFilter },
      include: {
        class: {
          select: { name: true },
        },
      },
    })

    const recentEnrollments = recentEnrollmentRecords.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      className: s.class?.name ?? 'Non assigné',
      enrollmentDate: s.enrollmentDate,
      gender: s.gender,
    }))

    // Upcoming events (next 5, scoped by institution + schoolYear)
    const upcomingEventRecords = await db.schoolEvent.findMany({
      where: {
        date: {
          gte: today,
        },
        ...(institutionId ? { institutionId } : {}),
        ...(schoolYear ? { schoolYear } : {}),
      },
      take: 5,
      orderBy: { date: 'asc' },
    })

    const upcomingEvents = upcomingEventRecords.map((e) => ({
      id: e.id,
      title: e.title,
      startDate: e.date,
      endDate: e.endDate ?? e.date,
      type: e.type,
      location: null as string | null,
    }))

    // Build recent activities list
    const recentActivities: Array<{
      type: string
      description: string
      date: string
      details?: Record<string, unknown>;
    }> = []

    for (const p of recentPayments) {
      recentActivities.push({
        type: 'payment',
        description: `Paiement de $${p.amount.toLocaleString('en-US')} par ${p.student.firstName} ${p.student.lastName}`,
        date: p.createdAt.toISOString(),
        details: { status: p.status, method: p.method },
      })
    }

    for (const a of recentAnnouncements) {
      recentActivities.push({
        type: 'announcement',
        description: `Annonce: ${a.title} par ${a.author.name}`,
        date: a.createdAt.toISOString(),
        details: { type: a.type, target: a.target },
      })
    }

    for (const g of recentGrades) {
      recentActivities.push({
        type: 'grade',
        description: `Note de ${g.value}/${g.maxValue} en ${g.subject.name} pour ${g.student.firstName} ${g.student.lastName}`,
        date: g.createdAt.toISOString(),
        details: { trimester: g.trimester, type: g.type },
      })
    }

    // Sort by date descending
    recentActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // ---- Cas particuliers : élèves et enseignants non actifs ----
    // (abandons, migrations, décès) — filtrés par institution ET par année scolaire.
    // Si la colonne `status` n'existe pas (base obsolète), on renvoie une section vide
    // plutôt que de faire planter le tableau de bord.
    const nonActiveStatuses = ['abandoned', 'migrated', 'deceased']

    const emptyStatusCases = {
      studentCounts: { abandoned: 0, migrated: 0, deceased: 0 },
      teacherCounts: { abandoned: 0, migrated: 0, deceased: 0 },
      totals: { abandoned: 0, migrated: 0, deceased: 0 },
      cases: [] as Array<{
        id: string
        type: 'student' | 'teacher'
        firstName: string
        lastName: string
        status: string
        statusDate: string | null
        detail: string
        reference: string
      }>,
    }

    let statusCases = emptyStatusCases
    if (hasStatus) {
      try {
        const [nonActiveStudents, nonActiveTeachers] = await Promise.all([
          db.student.findMany({
            where: {
              ...instUserFilter,
              ...yearStudentFilter,
              status: { in: nonActiveStatuses },
            },
            include: { class: { select: { name: true } } },
            orderBy: { updatedAt: 'desc' },
          }),
          db.teacher.findMany({
            where: {
              ...instUserFilter,
              ...yearTeacherFilter,
              status: { in: nonActiveStatuses },
            },
            orderBy: { updatedAt: 'desc' },
          }),
        ])

        const studentStatusCounts = {
          abandoned: nonActiveStudents.filter((s) => s.status === 'abandoned').length,
          migrated: nonActiveStudents.filter((s) => s.status === 'migrated').length,
          deceased: nonActiveStudents.filter((s) => s.status === 'deceased').length,
        }
        const teacherStatusCounts = {
          abandoned: nonActiveTeachers.filter((t) => t.status === 'abandoned').length,
          migrated: nonActiveTeachers.filter((t) => t.status === 'migrated').length,
          deceased: nonActiveTeachers.filter((t) => t.status === 'deceased').length,
        }

        statusCases = {
          studentCounts: studentStatusCounts,
          teacherCounts: teacherStatusCounts,
          totals: {
            abandoned: studentStatusCounts.abandoned + teacherStatusCounts.abandoned,
            migrated: studentStatusCounts.migrated + teacherStatusCounts.migrated,
            deceased: studentStatusCounts.deceased + teacherStatusCounts.deceased,
          },
          cases: [
            ...nonActiveStudents.map((s) => ({
              id: s.id,
              type: 'student' as const,
              firstName: s.firstName,
              lastName: s.lastName,
              status: s.status,
              statusDate: s.statusDate ?? null,
              detail: s.class?.name ?? 'Non assigné',
              reference: s.enrollmentDate,
            })),
            ...nonActiveTeachers.map((t) => ({
              id: t.id,
              type: 'teacher' as const,
              firstName: t.firstName,
              lastName: t.lastName,
              status: t.status,
              statusDate: t.statusDate ?? null,
              detail: t.subject,
              reference: t.hireDate,
            })),
          ],
        }
      } catch {
        // Si la requête échoue (colonne manquante, base corrompue…), on garde
        // la section vide — le reste du tableau de bord reste utilisable.
        statusCases = emptyStatusCases
      }
    }

    return NextResponse.json({
      stats: {
        totalStudents,
        totalTeachers,
        totalClasses,
        totalParents,
        totalStaff,
        totalRevenue,
        pendingRevenue,
      },
      attendance: {
        present: presentCount,
        absent: absentCount,
        late: lateCount,
      },
      studentsPerClass,
      genderDistribution: {
        male: maleStudents,
        female: femaleStudents,
      },
      paymentMethods: {
        mobile_money: mobileMoneyPayments,
        cash: cashPayments,
        bank_transfer: bankTransferPayments,
      },
      recentActivities: recentActivities.slice(0, 10),
      monthlyRevenue,
      recentEnrollments,
      upcomingEvents,
      statusCases,
    })
  } catch (error) {
    console.error('Get dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
