import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/superadmin/browse?institutionId=xxx - Browse full institution data
export async function GET(request: Request) {
  try {
    const superAdminId = request.headers.get('x-super-admin-id')
    if (!superAdminId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const superAdmin = await db.superAdmin.findUnique({ where: { id: superAdminId } })
    if (!superAdmin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const institutionId = searchParams.get('institutionId')

    if (!institutionId) {
      return NextResponse.json({ error: 'ID de l\'institution requis' }, { status: 400 })
    }

    // Fetch all entity data in parallel
    const [
      students,
      teachers,
      parents,
      staff,
      classes,
      subjects,
      payments,
      attendanceAgg,
      gradeAgg,
      users,
      announcementCount,
      eventCount,
    ] = await Promise.all([
      // Full student list with user info, class, parent
      db.student.findMany({
        where: { user: { institutionId } },
        include: {
          user: { select: { id: true, email: true, phone: true, active: true, userCode: true } },
          class: { select: { id: true, name: true, level: true } },
          parent: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
        orderBy: { lastName: 'asc' },
      }),

      // Full teacher list with user info, subject, qualification
      db.teacher.findMany({
        where: { user: { institutionId } },
        include: {
          user: { select: { id: true, email: true, phone: true, active: true, userCode: true } },
          classes: { include: { class: { select: { id: true, name: true } } } },
        },
        orderBy: { lastName: 'asc' },
      }),

      // Full parent list with user info, phone, address, children count
      db.parent.findMany({
        where: { user: { institutionId } },
        include: {
          user: { select: { id: true, email: true, phone: true, active: true, userCode: true } },
          children: {
            where: { user: { institutionId } },
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { lastName: 'asc' },
      }),

      // Full staff list with user info, fonction, phone
      db.staff.findMany({
        where: { user: { institutionId } },
        include: {
          user: { select: { id: true, email: true, phone: true, active: true, userCode: true } },
        },
        orderBy: { lastName: 'asc' },
      }),

      // Full class list with student count, level, section, room
      db.class.findMany({
        where: { institutionId },
        include: {
          _count: { select: { students: true } },
          teachers: { include: { teacher: { select: { id: true, firstName: true, lastName: true } } } },
        },
        orderBy: { name: 'asc' },
      }),

      // Full subject list (subjects are global, not per-institution)
      db.subject.findMany({
        orderBy: { name: 'asc' },
      }),

      // Full payment list with student info
      db.payment.findMany({
        where: { student: { user: { institutionId } } },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              class: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Attendance stats
      db.attendance.groupBy({
        by: ['status'],
        where: { student: { user: { institutionId } } },
        _count: { status: true },
      }),

      // Grade stats
      db.grade.aggregate({
        where: { student: { user: { institutionId } } },
        _count: { id: true },
        _avg: { value: true },
      }),

      // Users list
      db.user.findMany({
        where: { institutionId },
        select: {
          id: true,
          userCode: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          active: true,
        },
        orderBy: { name: 'asc' },
      }),

      // Announcement count (announcements link to author User, filter by author's institution)
      db.announcement.count({
        where: { author: { institutionId } },
      }),

      // Event count
      db.schoolEvent.count({ where: { institutionId } }),
    ])

    // Compute payment stats
    const paymentStats = {
      total: payments.length,
      completed: payments.filter(p => p.status === 'completed').length,
      pending: payments.filter(p => p.status === 'pending').length,
      failed: payments.filter(p => p.status === 'failed').length,
      totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      completedAmount: payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0),
    }

    // Compute attendance stats
    const attendanceStats: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0 }
    for (const row of attendanceAgg) {
      attendanceStats[row.status] = row._count.status
    }

    // Compute grade stats
    const gradeStats = {
      count: gradeAgg._count.id,
      average: gradeAgg._avg.value ? Math.round(gradeAgg._avg.value * 100) / 100 : 0,
    }

    // Class with student count
    const classesWithCount = classes.map(c => ({
      ...c,
      studentCount: c._count.students,
    }))

    return NextResponse.json({
      students,
      teachers,
      parents,
      staff,
      classes: classesWithCount,
      subjects,
      payments,
      paymentStats,
      attendanceStats,
      gradeStats,
      users,
      announcementCount,
      eventCount,
    })
  } catch (error) {
    console.error('Browse institution error:', error)
    return NextResponse.json({ error: 'Erreur lors de la consultation des données' }, { status: 500 })
  }
}
