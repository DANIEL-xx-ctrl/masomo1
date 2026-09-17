import { NextResponse } from 'next/server'
import { getProclamationData, applyProclamationFilters } from '@/lib/proclamation'

/**
 * GET /api/bulletins/proclamation
 *
 * Query params:
 *  - schoolYear (required)
 *  - period: "trimester" | "semester" | "annual"  (default: trimester)
 *  - trimester: "1er" | "2eme" | "3eme"            (when period=trimester)
 *  - semester: "1" | "2"                            (when period=semester)
 *  - classId: optional — restrict to a single class
 *  - excludeInsolvent: "true" — exclude students with pending/unpaid payments
 *  - studentIds: comma-separated list of student IDs — when provided, only
 *    those students are included in the proclamation list (used by the
 *    pre-selection checkbox UI).
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
    const excludeInsolvent = searchParams.get('excludeInsolvent') === 'true'
    // Optional pre-selected student IDs (comma-separated). When provided,
    // the proclamation list is restricted to only these students.
    const studentIdsParam = searchParams.get('studentIds')
    const selectedStudentIds = studentIdsParam
      ? studentIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : []

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

    // Apply insolvent filter + pre-selected student IDs filter (shared
    // with the export routes so exports always match the dialog).
    await applyProclamationFilters(result, {
      excludeInsolvent,
      selectedStudentIds,
      schoolYear,
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
