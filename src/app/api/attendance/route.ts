import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const date = searchParams.get('date')
    const classId = searchParams.get('classId')
    const schoolYear = searchParams.get('schoolYear')

    const where: Record<string, unknown> = {}

    if (studentId) where.studentId = studentId
    if (date) where.date = date
    if (schoolYear) where.schoolYear = schoolYear

    if (classId) {
      const studentsInClass = await db.student.findMany({
        where: { classId },
        select: { id: true },
      })
      where.studentId = { in: studentsInClass.map((s) => s.id) }
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
