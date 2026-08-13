import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getTeacherClassIds, getTeacherIdFromUserId } from '@/lib/teacher-classes'

/**
 * Resolve the active school year for a request.
 * The client sends it both as a query param (?schoolYear=) and as the
 * `x-school-year` header (via the FetchInterceptor). We prefer the query
 * param (explicit per-call override) and fall back to the header.
 */
function resolveSchoolYear(request: Request, searchParams: URLSearchParams): string | undefined {
  const fromQuery = searchParams.get('schoolYear')
  if (fromQuery) return fromQuery
  const fromHeader = request.headers.get('x-school-year')
  return fromHeader || undefined
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const classId = searchParams.get('classId')
    const subjectId = searchParams.get('subjectId')
    const trimester = searchParams.get('trimester')
    const schoolYear = resolveSchoolYear(request, searchParams)

    const role = request.headers.get('x-user-role') || ''
    const userId = request.headers.get('x-user-id') || ''

    const where: Record<string, unknown> = {}

    if (studentId) where.studentId = studentId
    if (classId) where.classId = classId
    if (subjectId) where.subjectId = subjectId
    if (trimester) where.trimester = trimester
    if (schoolYear) where.schoolYear = schoolYear

    // ── Teacher scoping ────────────────────────────────────────────
    // A teacher must only see the grades of THEIR classes, for the
    // active school year. We resolve the teacher's class IDs and force
    // the query into an `OR` of (their classes) ∪ (grades they
    // personally recorded via teacherId), intersected with the year.
    if (role === 'teacher' && userId) {
      const teacherClassIds = await getTeacherClassIds(userId, schoolYear)
      const teacherId = await getTeacherIdFromUserId(userId)

      // If the caller passed an explicit classId, make sure it belongs
      // to the teacher. If it doesn't, return nothing.
      if (classId) {
        if (!teacherClassIds.includes(classId)) {
          return NextResponse.json({ grades: [] })
        }
        // where.classId is already set; nothing else to do.
      } else if (teacherClassIds.length > 0) {
        // Restrict to the teacher's classes OR grades they recorded.
        where.OR = [
          { classId: { in: teacherClassIds } },
          ...(teacherId ? [{ teacherId }] : []),
        ]
      } else if (teacherId) {
        // No class assignments yet: only show grades they personally
        // recorded (legacy data safety net).
        where.teacherId = teacherId
      } else {
        // Not a real teacher record — return nothing.
        return NextResponse.json({ grades: [] })
      }
    }

    const grades = await db.grade.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            image: true,
            updatedAt: true,
          },
        },
        subject: true,
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ grades })
  } catch (error) {
    console.error('Get grades error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des notes' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      studentId,
      subjectId,
      classId,
      teacherId,
      value,
      maxValue,
      type,
      trimester,
      schoolYear,
      comment,
      date,
    } = body

    if (!studentId || !subjectId || value === undefined || !type || !trimester || !date) {
      return NextResponse.json(
        { error: 'studentId, subjectId, value, type, trimester et date requis' },
        { status: 400 }
      )
    }

    const role = request.headers.get('x-user-role') || ''
    const userId = request.headers.get('x-user-id') || ''
    const headerSchoolYear = request.headers.get('x-school-year') || undefined
    const effectiveSchoolYear = schoolYear || headerSchoolYear || '2024-2025'

    // ── Teacher scoping on create ──────────────────────────────────
    // A teacher may only create grades for THEIR classes. We verify
    // the requested classId is one of theirs (for the active year) and
    // we force teacherId to the teacher's own id so the audit trail
    // stays correct even if the client sends a wrong/empty value.
    let resolvedTeacherId = teacherId || null
    if (role === 'teacher' && userId) {
      const teacherClassIds = await getTeacherClassIds(userId, effectiveSchoolYear)
      if (!classId || !teacherClassIds.includes(classId)) {
        return NextResponse.json(
          { error: "Vous ne pouvez créer des notes que pour vos propres classes." },
          { status: 403 }
        )
      }
      const ownTeacherId = await getTeacherIdFromUserId(userId)
      resolvedTeacherId = ownTeacherId // force, ignore client value
    }

    const grade = await db.grade.create({
      data: {
        studentId,
        subjectId,
        classId,
        teacherId: resolvedTeacherId,
        value: parseFloat(String(value)),
        maxValue: maxValue ? parseFloat(String(maxValue)) : 20,
        type,
        trimester,
        schoolYear: effectiveSchoolYear,
        comment,
        date,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            image: true,
            updatedAt: true,
          },
        },
        subject: true,
      },
    })

    return NextResponse.json({ grade }, { status: 201 })
  } catch (error) {
    console.error('Create grade error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la note' },
      { status: 500 }
    )
  }
}
