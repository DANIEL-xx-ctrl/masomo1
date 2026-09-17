import { db } from '@/lib/db'

export const GRADE_TYPE_LABELS: Record<string, string> = {
  devoir: 'Devoir',
  examen: 'Examen',
  controle: 'Contrôle',
}

export const TRIMESTER_LABELS: Record<string, string> = {
  '1er': '1er Trimestre',
  '2eme': '2ème Trimestre',
  '3eme': '3ème Trimestre',
}

export interface FilteredGradesResult {
  grades: Array<{
    id: string
    value: number
    maxValue: number
    type: string
    trimester: string
    date: string
    comment: string | null
    student: { id: string; firstName: string; lastName: string }
    subject: { id: string; name: string; code: string }
  }>
  schoolYear: string
  classId: string | null
  subjectId: string | null
  trimester: string | null
}

/**
 * Shared grade-filtering logic used by the PDF / Excel / Word export
 * routes. Resolves teacher / student scoping exactly like the main
 * /api/grades GET endpoint so exports never leak data across classes.
 */
export async function getFilteredGrades(request: Request): Promise<FilteredGradesResult> {
  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId')
  const classId = searchParams.get('classId')
  const subjectId = searchParams.get('subjectId')
  const trimester = searchParams.get('trimester')
  const schoolYear = searchParams.get('schoolYear') || '2024-2025'
  const userId = searchParams.get('userId')
  const userRole = searchParams.get('role')
  // Additional client-side filters that we now also apply server-side so the
  // PDF/Excel/Word exports honor the search box + type filter exactly like the
  // UI table does.
  const type = searchParams.get('type')
  const search = searchParams.get('search')?.trim() || ''

  const where: Record<string, unknown> = { schoolYear }

  if (studentId) where.studentId = studentId
  if (classId) where.classId = classId
  if (subjectId) where.subjectId = subjectId
  if (trimester) where.trimester = trimester
  if (type) where.type = type

  // If the user is a teacher, only show grades from their assigned classes
  if (userId && userRole === 'teacher') {
    const teacher = await db.teacher.findUnique({
      where: { userId },
      select: { id: true },
    })

    if (teacher) {
      const teacherClasses = await db.classTeacher.findMany({
        where: {
          teacherId: teacher.id,
          class: { schoolYear },
        },
        select: { classId: true },
      })
      const teacherClassIds = teacherClasses.map((tc) => tc.classId)

      if (teacherClassIds.length > 0) {
        if (classId) {
          if (!teacherClassIds.includes(classId)) {
            return { grades: [], schoolYear, classId, subjectId, trimester }
          }
        } else {
          where.classId = { in: teacherClassIds }
        }
      } else {
        return { grades: [], schoolYear, classId, subjectId, trimester }
      }
    } else {
      return { grades: [], schoolYear, classId, subjectId, trimester }
    }
  }

  // If the user is a student, only show their own grades
  if (userId && userRole === 'student') {
    const student = await db.student.findUnique({
      where: { userId },
      select: { id: true },
    })

    if (student) {
      where.studentId = student.id
    } else {
      return { grades: [], schoolYear, classId, subjectId, trimester }
    }
  }

  const allGrades = await db.grade.findMany({
    where,
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      subject: true,
    },
    orderBy: { date: 'desc' },
  })

  // Apply the search query (match by student name OR subject name),
  // exactly like the UI does on the client side.
  const grades = search
    ? allGrades.filter((g) => {
        const studentName = `${g.student.firstName} ${g.student.lastName}`.toLowerCase()
        const subjectName = (g.subject?.name || '').toLowerCase()
        const q = search.toLowerCase()
        return studentName.includes(q) || subjectName.includes(q)
      })
    : allGrades

  return { grades, schoolYear, classId, subjectId, trimester }
}

/** Resolve human-readable labels for the active class/subject filters. */
export async function resolveFilterLabels(classId: string | null, subjectId: string | null) {
  let className = ''
  let subjectName = ''
  if (classId) {
    const cls = await db.class.findUnique({
      where: { id: classId },
      select: { name: true },
    })
    className = cls?.name || classId
  }
  if (subjectId) {
    const subj = await db.subject.findUnique({
      where: { id: subjectId },
      select: { name: true },
    })
    subjectName = subj?.name || subjectId
  }
  return { className, subjectName }
}
