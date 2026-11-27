import { NextResponse } from 'next/server'
import {
  ANNUAL_MAX_TOTAL,
  applyTieRanks,
  getProclamationData,
} from '@/lib/proclamation'

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

    if (selectedStudentIds.length > 0 && entries.length > 0) {
      const allowed = new Set(selectedStudentIds)
      entries = entries.filter((e: { studentId: string }) =>
        allowed.has(e.studentId)
      )
    }

    entries = entries.map((entry) => {
      const total = Math.round((Number(entry.total) || 0) * 100) / 100
      const maxTotal =
        period === 'annual' ? ANNUAL_MAX_TOTAL : Number(entry.maxTotal) || 0
      const percentage =
        maxTotal > 0 ? Math.round(((total / maxTotal) * 100) * 10) / 10 : 0
      return {
        ...entry,
        total,
        pointsObtenus: total,
        maxTotal,
        percentage,
        average: percentage,
      }
    })

    entries.sort((a: { total?: number }, b: { total?: number }) => {
      return (Number(b.total) || 0) - (Number(a.total) || 0)
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
        ? Math.max(
            ...entries.map((e: { total?: number }) => Number(e.total) || 0)
          )
        : 0
    const lowestTotal =
      totalStudents > 0
        ? Math.min(
            ...entries.map((e: { total?: number }) => Number(e.total) || 0)
          )
        : 0

    return NextResponse.json({
      ...result,
      period,
      annualMaxTotal:
        period === 'annual' ? ANNUAL_MAX_TOTAL : result.annualMaxTotal,
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
