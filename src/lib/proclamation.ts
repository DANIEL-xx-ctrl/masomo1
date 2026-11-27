import { db } from '@/lib/db'

export const ANNUAL_MAX_TOTAL = 3600

export interface ProclamationOptions {
  schoolYear: string
  period?: string | null
  trimester?: string | null
  semester?: string | null
  classId?: string | null
  studentIds?: string[] | null
}

export interface ProclamationEntry {
  rank: number
  studentId: string
  studentName: string
  lastName: string
  firstName: string
  userCode: string | null
  classId: string
  className: string
  total: number
  maxTotal: number
  percentage: number
  average: number
}

export interface ProclamationResult {
  schoolYear: string
  period: string
  trimester: string | null
  semester: string | null
  classId: string | null
  annualMaxTotal: number
  entries: ProclamationEntry[]
  stats: {
    totalStudents: number
    averagePercentage: number
    highestTotal: number
    lowestTotal: number
    annualMaxTotal: number
  }
}

export function applyTieRanks<T extends { total: number; rank: number }>(items: T[]): T[] {
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && items[i].total === items[i - 1].total) {
      items[i].rank = items[i - 1].rank
    } else {
      items[i].rank = i + 1
    }
  }
  return items
}

export function sumGradeValues(
  grades: Array<{ value: number | string | null | undefined; maxValue?: number | string | null | undefined }>
): { total: number; rawMaxTotal: number } {
  let rawTotal = 0
  let rawMax = 0

  for (const g of grades) {
    const val = Number(g.value)
    if (Number.isFinite(val)) {
      rawTotal += val
    }
    const maxVal = Number(g.maxValue)
    if (Number.isFinite(maxVal)) {
      rawMax += maxVal
    }
  }

  return {
    total: Math.round(rawTotal * 100) / 100,
    rawMaxTotal: Math.round(rawMax * 100) / 100,
  }
}

export async function getProclamationData(
  _request: Request,
  options: ProclamationOptions
): Promise<ProclamationResult> {
  const {
    schoolYear,
    period = 'trimester',
    trimester = null,
    semester = null,
    classId = null,
    studentIds = null,
  } = options

  const normalizedPeriod = period || 'trimester'
  const isAnnual = normalizedPeriod === 'annual'

  const studentWhere: Record<string, unknown> = {
    status: 'active',
  }
  if (classId) {
    studentWhere.classId = classId
  }
  if (studentIds && studentIds.length > 0) {
    studentWhere.id = { in: studentIds }
  }

  const students = await db.student.findMany({
    where: studentWhere,
    select: {
      id: true,
      lastName: true,
      firstName: true,
      classId: true,
      class: {
        select: {
          id: true,
          name: true,
        },
      },
      user: {
        select: {
          userCode: true,
        },
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  const gradeWhere: Record<string, unknown> = {
    schoolYear,
  }

  if (studentIds && studentIds.length > 0) {
    gradeWhere.studentId = { in: studentIds }
  } else if (students.length > 0) {
    gradeWhere.studentId = { in: students.map((s) => s.id) }
  }

  if (!isAnnual) {
    if (normalizedPeriod === 'trimester' && trimester) {
      gradeWhere.trimester = trimester
    } else if (normalizedPeriod === 'semester' && semester) {
      gradeWhere.trimester =
        semester === '1' ? { in: ['1er', '2eme'] } : { in: ['2eme', '3eme'] }
    }
  }

  // On récupère toutes les lignes d'évaluation sans écraser plusieurs notes d'une même matière/période
  const grades = await db.grade.findMany({
    where: gradeWhere,
    select: {
      id: true,
      studentId: true,
      value: true,
      maxValue: true,
    },
  })

  const gradesByStudent = new Map<
    string,
    Array<{ value: number; maxValue: number }>
  >()

  for (const g of grades) {
    let list = gradesByStudent.get(g.studentId)
    if (!list) {
      list = []
      gradesByStudent.set(g.studentId, list)
    }
    list.push({
      value: Number(g.value) || 0,
      maxValue: Number(g.maxValue) || 0,
    })
  }

  const entries: ProclamationEntry[] = students.map((s) => {
    const studentGrades = gradesByStudent.get(s.id) ?? []
    const { total, rawMaxTotal } = sumGradeValues(studentGrades)

    // Total annuel fixé à 3600 en mode annuel
    const maxTotal = isAnnual ? ANNUAL_MAX_TOTAL : rawMaxTotal
    const percentage =
      maxTotal > 0 ? Math.round(((total / maxTotal) * 100) * 10) / 10 : 0
    const average = percentage

    return {
      rank: 0,
      studentId: s.id,
      studentName: `${s.lastName} ${s.firstName}`.trim(),
      lastName: s.lastName,
      firstName: s.firstName,
      userCode: s.user?.userCode ?? null,
      classId: s.classId,
      className: s.class?.name ?? '',
      total,
      maxTotal,
      percentage,
      average,
    }
  })

  entries.sort((a, b) =>
    b.total !== a.total
      ? b.total - a.total
      : a.studentName.localeCompare(b.studentName)
  )

  applyTieRanks(entries)

  const totalStudents = entries.length
  const averagePercentage =
    totalStudents > 0
      ? Math.round(
          (entries.reduce((acc, e) => acc + e.percentage, 0) / totalStudents) * 10
        ) / 10
      : 0
  const highestTotal =
    totalStudents > 0 ? Math.max(...entries.map((e) => e.total)) : 0
  const lowestTotal =
    totalStudents > 0 ? Math.min(...entries.map((e) => e.total)) : 0

  return {
    schoolYear,
    period: normalizedPeriod,
    trimester,
    semester,
    classId,
    annualMaxTotal: ANNUAL_MAX_TOTAL,
    entries,
    stats: {
      totalStudents,
      averagePercentage,
      highestTotal,
      lowestTotal,
      annualMaxTotal: ANNUAL_MAX_TOTAL,
    },
  }
}
