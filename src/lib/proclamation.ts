import { db } from './db'
import { getInstitutionIdWithFallback } from './api-auth'

// ============================================================
// Proclamation list — shared data layer
// Used by: GET /api/bulletins/proclamation
//          /api/bulletins/proclamation/export/{pdf,excel,word}
// ============================================================

export type ProclamationPeriod = 'trimester' | 'semester' | 'annual'

export interface ProclamationParams {
  institutionId: string
  classId?: string | null
  schoolYear: string
  period: ProclamationPeriod
  trimester?: string | null // "1er" | "2eme" | "3eme"
  semester?: string | null // "1" | "2"
}

export interface ProclamationEntry {
  rank: number
  studentId: string
  firstName: string
  lastName: string
  fullName: string
  className: string
  classLevel: string
  average: number // /20
  percentage: number // 0-100
  appreciation: string
  mention: string
  passed: boolean
}

export interface ProclamationResult {
  entries: ProclamationEntry[]
  params: {
    schoolYear: string
    period: ProclamationPeriod
    periodLabel: string
    classLabel: string
    trimester?: string | null
    semester?: string | null
  }
  institution: {
    name: string
    address?: string | null
    phone?: string | null
    email?: string | null
  } | null
  stats: {
    totalStudents: number
    passedCount: number
    failedCount: number
    classAverage: number
    successRate: number
    highestAverage: number
    lowestAverage: number
  }
}

const TRIMESTER_LABELS: Record<string, string> = {
  '1er': '1er Trimestre',
  '2eme': '2ème Trimestre',
  '3eme': '3ème Trimestre',
}

const SEMESTER_LABELS: Record<string, string> = {
  '1': '1er Semestre',
  '2': '2ème Semestre',
}

// Map a semester to the list of trimesters it aggregates.
// Standard francophone system: S1 = T1 + T2, S2 = T3
const SEMESTER_TRIMESTERS: Record<string, string[]> = {
  '1': ['1er', '2eme'],
  '2': ['3eme'],
}

function appreciationFor(avg: number): string {
  if (avg >= 16) return 'Très Bien'
  if (avg >= 14) return 'Bien'
  if (avg >= 12) return 'Assez Bien'
  if (avg >= 10) return 'Passable'
  return 'Insuffisant'
}

function mentionFor(avg: number): string {
  if (avg >= 16) return 'Excellent'
  if (avg >= 14) return 'Très bien'
  if (avg >= 12) return 'Assez bien'
  if (avg >= 10) return 'Passable'
  return 'Insuffisant'
}

/**
 * Compute the proclamation list for a given period.
 *
 * Period handling:
 *  - trimester: grades filtered by the given trimester
 *  - semester:  grades aggregated across the trimesters belonging to that semester
 *  - annual:    grades aggregated across ALL trimesters of the school year
 *
 * The list is sorted by average DESCENDING (best first) and rank is assigned
 * ascending (1 = best).
 */
export async function getProclamationData(
  request: Request,
  rawParams: {
    classId?: string | null
    schoolYear?: string | null
    period?: string | null
    trimester?: string | null
    semester?: string | null
  }
): Promise<ProclamationResult> {
  const institutionId = await getInstitutionIdWithFallback(request)

  const schoolYear = rawParams.schoolYear || '2024-2025'
  const period: ProclamationPeriod =
    rawParams.period === 'semester' || rawParams.period === 'annual'
      ? rawParams.period
      : 'trimester'

  const classId = rawParams.classId || null
  const trimester = rawParams.trimester || null
  const semester = rawParams.semester || null

  // Determine which trimesters to aggregate grades from
  let targetTrimesters: string[] | null = null // null = all
  if (period === 'trimester') {
    targetTrimesters = trimester ? [trimester] : null
  } else if (period === 'semester') {
    targetTrimesters = semester ? SEMESTER_TRIMESTERS[semester] || null : null
  }
  // period === 'annual' → targetTrimesters stays null (all trimesters)

  // Build the grade query
  const gradeWhere: Record<string, unknown> = {
    schoolYear,
    student: { user: { institutionId } },
  }
  if (targetTrimesters) {
    gradeWhere.trimester = { in: targetTrimesters }
  }

  // If a class is selected, restrict to students of that class
  if (classId) {
    ;(gradeWhere.student as Record<string, unknown>).classId = classId
  }

  // Fetch all relevant grades with subject info (for coefficient weighting)
  const grades = await db.grade.findMany({
    where: gradeWhere,
    include: {
      subject: { select: { id: true, name: true, coefficient: true } },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          class: { select: { id: true, name: true, level: true } },
        },
      },
    },
  })

  // Aggregate per student: weighted average on 20
  // average = sum((value/maxValue)*20 * coeff) / sum(coeff)
  const perStudent = new Map<
    string,
    {
      studentId: string
      firstName: string
      lastName: string
      className: string
      classLevel: string
      totalWeighted: number
      totalCoeff: number
      gradeCount: number
    }
  >()

  for (const g of grades) {
    const coeff = g.subject?.coefficient || 1
    const normalized = (g.value / g.maxValue) * 20 * coeff
    const existing = perStudent.get(g.studentId)
    if (existing) {
      existing.totalWeighted += normalized
      existing.totalCoeff += coeff
      existing.gradeCount += 1
    } else {
      perStudent.set(g.studentId, {
        studentId: g.studentId,
        firstName: g.student.firstName,
        lastName: g.student.lastName,
        className: g.student.class?.name || '—',
        classLevel: g.student.class?.level || '',
        totalWeighted: normalized,
        totalCoeff: coeff,
        gradeCount: 1,
      })
    }
  }

  // Build entries with computed average
  const entries: ProclamationEntry[] = []
  perStudent.forEach((s) => {
    const avg = s.totalCoeff > 0 ? s.totalWeighted / s.totalCoeff : 0
    const roundedAvg = Math.round(avg * 100) / 100
    const percentage = Math.round((avg / 20) * 1000) / 10
    entries.push({
      rank: 0, // assigned after sorting
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      fullName: `${s.lastName} ${s.firstName}`,
      className: s.className,
      classLevel: s.classLevel,
      average: roundedAvg,
      percentage,
      appreciation: appreciationFor(roundedAvg),
      mention: mentionFor(roundedAvg),
      passed: roundedAvg >= 10,
    })
  })

  // Sort DESCENDING by average (best first). Rank 1 = best.
  // The rank numbers then ascend (1, 2, 3, …) which is the universal
  // proclamation convention.
  entries.sort((a, b) => b.average - a.average)
  entries.forEach((e, idx) => {
    e.rank = idx + 1
  })

  // Institution info for headers
  const institution = await db.institution.findFirst({
    where: { id: institutionId },
    select: { name: true, address: true, phone: true, email: true },
  })

  // Stats
  const averages = entries.map((e) => e.average)
  const classAverage =
    averages.length > 0
      ? Math.round((averages.reduce((a, b) => a + b, 0) / averages.length) * 100) / 100
      : 0
  const passedCount = entries.filter((e) => e.passed).length
  const successRate =
    entries.length > 0 ? Math.round((passedCount / entries.length) * 1000) / 10 : 0

  // Period label
  let periodLabel = 'Année scolaire complète'
  if (period === 'trimester' && trimester) {
    periodLabel = TRIMESTER_LABELS[trimester] || `Trimestre ${trimester}`
  } else if (period === 'semester' && semester) {
    periodLabel = SEMESTER_LABELS[semester] || `Semestre ${semester}`
  }

  // Class label
  let classLabel = 'Toutes les classes'
  if (classId) {
    const cls = await db.class.findUnique({
      where: { id: classId },
      select: { name: true, level: true },
    })
    if (cls) classLabel = cls.level ? `${cls.name} (${cls.level})` : cls.name
  }

  return {
    entries,
    params: {
      schoolYear,
      period,
      periodLabel,
      classLabel,
      trimester,
      semester,
    },
    institution: institution || null,
    stats: {
      totalStudents: entries.length,
      passedCount,
      failedCount: entries.length - passedCount,
      classAverage,
      successRate,
      highestAverage: averages.length > 0 ? Math.max(...averages) : 0,
      lowestAverage: averages.length > 0 ? Math.min(...averages) : 0,
    },
  }
}

export { TRIMESTER_LABELS, SEMESTER_LABELS }
