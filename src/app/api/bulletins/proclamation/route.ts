import { NextResponse } from 'next/server'
import { getProclamationData } from '@/lib/proclamation'

/**
 * GET /api/bulletins/proclamation
 *
 * Query params:
 *  - schoolYear (required)
 *  - period: "trimester" | "semester" | "annual"  (default: trimester)
 *  - trimester: "1er" | "2eme" | "3eme"            (when period=trimester)
 *  - semester: "1" | "2"                            (when period=semester)
 *  - classId: optional — restrict to a single class
 *
 * Returns a proclamation list sorted by average DESC (rank 1 = best).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolYear = searchParams.get('schoolYear')
    const period = searchParams.get('period')
    const trimester = searchParams.get('trimester')
    const semester = searchParams.get('semester')
    const classId = searchParams.get('classId')

    if (!schoolYear) {
      return NextResponse.json(
        { error: 'Année scolaire requise' },
        { status: 400 }
      )
    }

    if (period === 'trimester' && !trimester) {
      return NextResponse.json(
        { error: 'Trimestre requis pour la période "trimestre"' },
        { status: 400 }
      )
    }
    if (period === 'semester' && !semester) {
      return NextResponse.json(
        { error: 'Semestre requis pour la période "semestre"' },
        { status: 400 }
      )
    }

    const result = await getProclamationData(request, {
      schoolYear,
      period,
      trimester,
      semester,
      classId,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get proclamation error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la proclamation' },
      { status: 500 }
    )
  }
}
