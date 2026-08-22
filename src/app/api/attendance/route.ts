import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { resolveInstitutionScope } from '@/lib/institution-scope'
import { getTeacherClassIds } from '@/lib/teacher-classes'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const date = searchParams.get('date')
    const classId = searchParams.get('classId')
    const schoolYear = searchParams.get('schoolYear')

    // ---- Institution scoping ----
    const scope = await resolveInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId
    const role = scope.role
    const userId = scope.userId

    const where: Record<string, unknown> = {}

    // ---- Teacher scoping ----
    // A teacher only sees attendance for their own classes. We resolve the
    // teacher's class IDs and filter attendance by the students in those
    // classes. Admin and super_admin see all attendance in the institution.
    if (role === 'teacher' && userId) {
      const teacherClassIds = await getTeacherClassIds(userId, schoolYear)
      if (teacherClassIds.length > 0) {
        const studentsInTeacherClasses = await db.student.findMany({
          where: { classId: { in: teacherClassIds } },
          select: { id: true },
        })
        where.studentId = { in: studentsInTeacherClasses.map((s) => s.id) }
      } else {
        return NextResponse.json({ attendance: [] })
      }
    } else if (institutionId) {
      // Non-teacher, non-super-admin: scope by institution
      where.student = { user: { institutionId } }
    }

    if (studentId) where.studentId = studentId
    if (date) where.date = date
    if (schoolYear) where.schoolYear = schoolYear

    if (classId) {
      // If a classId is explicitly requested, intersect with the teacher
      // scope (a teacher cannot read attendance for a class they don't teach).
      if (role === 'teacher' && userId) {
        const teacherClassIds = await getTeacherClassIds(userId, schoolYear)
        if (!teacherClassIds.includes(classId)) {
          return NextResponse.json({ attendance: [] })
        }
      }
      const studentsInClass = await db.student.findMany({
        where: { classId },
        select: { id: true },
      })
      const classStudentIds = studentsInClass.map((s) => s.id)
      // Intersect with existing studentId filter if any
      if (where.studentId && typeof where.studentId === 'object' && 'in' in (where.studentId as object)) {
        const existing = (where.studentId as { in: string[] }).in
        where.studentId = { in: existing.filter((id) => classStudentIds.includes(id)) }
      } else {
        where.studentId = { in: classStudentIds }
      }
    }

    const attendance = await db.attendance.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            class: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ attendance })
  } catch (error) {
    console.error('Get attendance error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des présences' },
      { status: 500 }
    )
  }
}

const VALID_STATUSES = ['present', 'absent', 'late', 'excused']

// Shared relation include for the `student` relation on Attendance.
// Used as `include: studentInclude` so Prisma returns the student with their class.
const studentInclude = {
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      class: {
        select: { id: true, name: true },
      },
    },
  },
} as const

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const querySchoolYear = searchParams.get('schoolYear')

    // ---- Role guard ----
    // Only admin, super_admin, and teacher can write attendance. Students
    // and parents cannot.
    const role = request.headers.get('x-user-role') || ''
    const userId = request.headers.get('x-user-id') || ''
    if (role !== 'admin' && role !== 'super_admin' && role !== 'teacher') {
      return NextResponse.json(
        { error: 'Accès non autorisé. Seul un administrateur ou enseignant peut enregistrer les présences.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // ---- Batch mode: { records: [...] } ----
    // This is the format sent by the attendance page "Enregistrer" button.
    if (Array.isArray(body?.records)) {
      const records = body.records as Array<{
        studentId?: string
        date?: string
        status?: string
        comment?: string
        schoolYear?: string
      }>

      if (records.length === 0) {
        return NextResponse.json(
          { error: 'Aucune présence à enregistrer' },
          { status: 400 }
        )
      }

      // Validate every record up-front so we fail fast and atomically.
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        if (!r.studentId || !r.date || !r.status) {
          return NextResponse.json(
            {
              error: `Enregistrement ${i + 1} invalide: studentId, date et status requis`,
            },
            { status: 400 }
          )
        }
        if (!VALID_STATUSES.includes(r.status)) {
          return NextResponse.json(
            {
              error: `Enregistrement ${i + 1}: statut invalide "${r.status}". Statuts acceptés: ${VALID_STATUSES.join(', ')}`,
            },
            { status: 400 }
          )
        }
      }

      const fallbackYear = querySchoolYear || '2024-2025'

      // ---- Teacher class-ownership check (batch mode) ----
      // For each student in the batch, verify the teacher owns the class
      // that student belongs to. Fail fast if any student is outside the
      // teacher's scope.
      if (role === 'teacher' && userId) {
        const teacherClassIds = await getTeacherClassIds(userId, fallbackYear)
        if (teacherClassIds.length === 0) {
          return NextResponse.json(
            { error: 'Vous n\'avez aucune classe assignée. Vous ne pouvez pas enregistrer de présences.' },
            { status: 403 }
          )
        }
        // Fetch all students in the batch and verify they belong to the
        // teacher's classes.
        const studentIds = records.map((r) => r.studentId!).filter(Boolean)
        const studentsInBatch = await db.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, classId: true },
        })
        const outOfScope = studentsInBatch.find(
          (s) => s.classId && !teacherClassIds.includes(s.classId)
        )
        if (outOfScope) {
          return NextResponse.json(
            { error: 'Vous ne pouvez enregistrer des présences que pour les élèves de vos classes.' },
            { status: 403 }
          )
        }
      }

      // Use an interactive transaction so the whole batch is atomic and
      // every query runs inside the same transaction context. We use
      // findFirst + update/create (not upsert) because there is no
      // @@unique([studentId, date]) constraint on the Attendance model.
      const result = await db.$transaction(async (tx) => {
        const saved = []
        for (const r of records) {
          const existing = await tx.attendance.findFirst({
            where: { studentId: r.studentId!, date: r.date! },
            select: { id: true },
          })

          if (existing) {
            const updated = await tx.attendance.update({
              where: { id: existing.id },
              data: {
                status: r.status!,
                comment: r.comment ?? null,
                schoolYear: r.schoolYear || querySchoolYear || undefined,
              },
              include: studentInclude,
            })
            saved.push(updated)
          } else {
            const created = await tx.attendance.create({
              data: {
                studentId: r.studentId!,
                date: r.date!,
                status: r.status!,
                comment: r.comment || undefined,
                schoolYear: r.schoolYear || fallbackYear,
              },
              include: studentInclude,
            })
            saved.push(created)
          }
        }
        return saved
      })

      return NextResponse.json(
        { attendance: result, count: result.length },
        { status: 201 }
      )
    }

    // ---- Single-record mode (backward compatibility) ----
    const { studentId, date, status, comment, schoolYear } = body

    if (!studentId || !date || !status) {
      return NextResponse.json(
        { error: 'studentId, date et status requis' },
        { status: 400 }
      )
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Statut invalide. Statuts acceptés: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const fallbackYearSingle = schoolYear || querySchoolYear || '2024-2025'

    // ---- Teacher class-ownership check (single-record mode) ----
    if (role === 'teacher' && userId) {
      const teacherClassIds = await getTeacherClassIds(userId, fallbackYearSingle)
      const studentRecord = await db.student.findUnique({
        where: { id: studentId },
        select: { classId: true },
      })
      if (studentRecord?.classId && !teacherClassIds.includes(studentRecord.classId)) {
        return NextResponse.json(
          { error: 'Vous ne pouvez enregistrer des présences que pour les élèves de vos classes.' },
          { status: 403 }
        )
      }
    }

    const existing = await db.attendance.findFirst({
      where: { studentId, date },
      select: { id: true },
    })

    let attendance
    if (existing) {
      attendance = await db.attendance.update({
        where: { id: existing.id },
        data: {
          status,
          comment,
          schoolYear: schoolYear || querySchoolYear || undefined,
        },
        include: studentInclude,
      })
    } else {
      attendance = await db.attendance.create({
        data: {
          studentId,
          date,
          status,
          comment,
          schoolYear: fallbackYearSingle,
        },
        include: studentInclude,
      })
    }

    return NextResponse.json({ attendance }, { status: 201 })
  } catch (error) {
    console.error('Create attendance error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de la présence" },
      { status: 500 }
    )
  }
}
