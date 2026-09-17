import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/bulletins/proclamation/candidates
 *
 * Returns the list of students for a given class + schoolYear, annotated
 * with their solvency status. Used by the proclamation dialog to let the
 * admin check which solvent students should appear in the proclamation list.
 *
 * Query params:
 *  - classId   (required) — restrict to a single class
 *  - schoolYear (required)
 *
 * A student is considered "solvent" if they have NO payments with status
 * "pending" or "failed" for the school year.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const schoolYear = searchParams.get('schoolYear') || '2024-2025'

    if (!classId) {
      return NextResponse.json(
        { error: 'classId est requis' },
        { status: 400 }
      )
    }

    const students = await db.student.findMany({
      where: { classId, status: 'active' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        class: { select: { name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    if (students.length === 0) {
      return NextResponse.json({ students: [] })
    }

    const studentIds = students.map((s) => s.id)
    const insolventPayments = await db.payment.findMany({
      where: {
        studentId: { in: studentIds },
        status: { in: ['pending', 'failed'] },
        schoolYear,
      },
      select: { studentId: true },
      distinct: ['studentId'],
    })
    const insolventIds = new Set(insolventPayments.map((p) => p.studentId))

    const result = students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      className: s.class?.name || '',
      solvent: !insolventIds.has(s.id),
    }))

    return NextResponse.json({ students: result })
  } catch (error) {
    console.error('Get proclamation candidates error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des élèves' },
      { status: 500 }
    )
  }
}
