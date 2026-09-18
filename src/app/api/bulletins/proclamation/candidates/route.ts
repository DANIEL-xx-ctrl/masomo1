import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/bulletins/proclamation/candidates
 *
 * Returns the list of students for a given class + schoolYear.
 * NO solvency/payment filter is applied — all active students in the class
 * are returned. The user decides who to include by checking boxes.
 *
 * Query params:
 *  - classId   (required) — restrict to a single class
 *  - schoolYear (required)
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

    const result = students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      className: s.class?.name || '',
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
