import { NextResponse } from 'next/server'
import { getProclamationData } from '@/lib/proclamation'
import { db } from '@/lib/db'

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

    // ---- Exclude insolvent students ----
    // If excludeInsolvent is true, we remove students who have pending or
    // failed payments for the school year. A student is considered "solvent"
    // if they have NO payments with status "pending" or "failed".
    if (excludeInsolvent && result.entries.length > 0) {
      const studentIds = result.entries.map((e: { studentId: string }) => e.studentId)
      // Find students with at least one pending or failed payment
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

      // Filter out insolvent students and re-rank
      const filtered = result.entries.filter(
        (e: { studentId: string }) => !insolventIds.has(e.studentId)
      )
      // Re-rank
      filtered.forEach((entry: { rank: number }, i: number) => {
        entry.rank = i + 1
      })

      result.entries = filtered
      result.stats = {
        ...result.stats,
        totalStudents: filtered.length,
        excludedCount: result.entries.length - filtered.length,
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get proclamation error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la proclamation' },
      { status: 500 }
    )
  }
}
