import { NextResponse } from 'next/server'
import { ANNUAL_MAX_TOTAL, applyTieRanks, getProclamationData } from '@/lib/proclamation'

/**
 * GET /api/bulletins/proclamation
 *
 * Query params:
 *  - schoolYear (required)
 *  - period: "trimester" | "semester" | "annual"  (default: trimester)
 *  - trimester: "1er" | "2eme" | "3eme"            (when period=trimester)
 *  - semester: "1" | "2"                            (when period=semester)
 *  - classId: optional — restrict to a single class
 *  - studentIds: comma-separated list of student IDs — when provided, only
 *    those students are included in the proclamation list (used by the
 *    pre-selection checkbox UI). NO solvency/payment filter is applied —
 *    the list only reflects what the user selected.
 *
 * Returns a proclamation list sorted by total DESC (rank 1 = best),
 * with annual max fixed at 3600 when period="annual".
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolYear = searchParams.get('schoolYear')
    const period = searchParams.get('period') || 'trimester'
    const trimester = searchParams.get('trimester')
    const semester = searchParams.get('semester')
    const classId = searchParams.get('classId')

    const studentIdsParam = searchParams.get('studentIds')
    const selectedStudentIds = studentIdsParam
      ? studentIdsParam
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
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
      studentIds: selectedStudentIds.length > 0 ? selectedStudentIds : null,
    })

    let entries = Array.isArray(result.entries) ? result.entries : []

    // Filtrage par liste d'élèves sélectionnés (sans filtre de paiement/solvabilité)
    if (selectedStudentIds.length > 0 && entries.length > 0) {
      const allowed = new Set(selectedStudentIds)
      entries = entries.filter((e: { studentId: string }) => allowed.has(e.studentId))
    }

    // Garantie du total annuel à 3600 lorsque period === 'annual'
    if (period === 'annual') {
      entries = entries.map((entry) => {
        const total = Number(entry.total) || 0
        const percentage =
          Math.round(((total / ANNUAL_MAX_TOTAL) * 100) * 10) / 10
        return {
          ...entry,
          total,
          maxTotal: ANNUAL_MAX_TOTAL,
          percentage,
          average: percentage,
        }
      })
    }

    entries.sort((a: { total?: number }, b: { total?: number }) => {
      const diff = (Number(b.total) || 0) - (Number(a.total) || 0)
      return diff
    })

    applyTieRanks(entries as { total: number; rank: number }[])

    const totalStudents = entries.length
    const averagePercentage =
      totalStudents > 0
        ? Math.round(
            (entries.reduce(
              (acc: number, e: { percentage?: number }) =>
                acc + (Number(e.percentage) || 0),
              0
            ) /
              totalStudents) *
              10
          ) / 10
        : 0
    const highestTotal =
      totalStudents > 0
        ? Math.max(...entries.map((e: { total?: number }) => Number(e.total) || 0))
        : 0
    const lowestTotal =
      totalStudents > 0
        ? Math.min(...entries.map((e: { total?: number }) => Number(e.total) || 0))
        : 0

    return NextResponse.json({
      ...result,
      period,
      annualMaxTotal: period === 'annual' ? ANNUAL_MAX_TOTAL : result.annualMaxTotal,
      entries,
      stats: {
        ...result.stats,
        totalStudents,
        averagePercentage,
        highestTotal,
        lowestTotal,
        ...(period === 'annual' ? { annualMaxTotal: ANNUAL_MAX_TOTAL } : {}),
      },
    })
  } catch (error) {
    console.error('Get proclamation error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la proclamation' },
      { status: 500 }
    )
  }
}
