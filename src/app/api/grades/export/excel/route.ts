import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const GRADE_TYPE_LABELS: Record<string, string> = {
  devoir: 'Devoir',
  examen: 'Examen',
  controle: 'Contrôle',
}

const TRIMESTER_LABELS: Record<string, string> = {
  '1er': '1er Trimestre',
  '2eme': '2ème Trimestre',
  '3eme': '3ème Trimestre',
}

async function getFilteredGrades(request: Request) {
  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId')
  const classId = searchParams.get('classId')
  const subjectId = searchParams.get('subjectId')
  const trimester = searchParams.get('trimester')
  const schoolYear = searchParams.get('schoolYear') || '2024-2025'
  const userId = searchParams.get('userId')
  const userRole = searchParams.get('role')

  const where: Record<string, unknown> = { schoolYear }

  if (studentId) where.studentId = studentId
  if (classId) where.classId = classId
  if (subjectId) where.subjectId = subjectId
  if (trimester) where.trimester = trimester

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

  const grades = await db.grade.findMany({
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

  return { grades, schoolYear, classId, subjectId, trimester }
}

export async function GET(request: Request) {
  try {
    const { grades } = await getFilteredGrades(request)

    // Calculate summary stats
    const scaledValues = grades.map((g) => (g.value / g.maxValue) * 20)
    const moyenne =
      scaledValues.length > 0
        ? scaledValues.reduce((a, b) => a + b, 0) / scaledValues.length
        : 0
    const tauxReussite =
      scaledValues.length > 0
        ? (scaledValues.filter((v) => v >= 10).length / scaledValues.length) *
          100
        : 0

    // Build header row
    const header = [
      'N°',
      'Élève',
      'Matière',
      'Note',
      '/20',
      'Type',
      'Trimestre',
      'Date',
      'Commentaire',
    ]

    // Build data rows
    const dataRows = grades.map((grade, index) => {
      const scaledValue = (grade.value / grade.maxValue) * 20
      return [
        index + 1,
        `${grade.student.lastName} ${grade.student.firstName}`,
        grade.subject.name,
        grade.value,
        parseFloat(scaledValue.toFixed(2)),
        GRADE_TYPE_LABELS[grade.type] || grade.type,
        TRIMESTER_LABELS[grade.trimester] || grade.trimester,
        grade.date,
        grade.comment || '',
      ]
    })

    // Summary rows
    const summaryRows = [
      [
        '',
        'Moyenne générale',
        '',
        '',
        parseFloat(moyenne.toFixed(2)),
        '',
        '',
        '',
        '',
      ],
      [
        '',
        'Taux de réussite',
        '',
        '',
        `${tauxReussite.toFixed(1)}%`,
        '',
        '',
        '',
        '',
      ],
      ['', 'Total notes', '', '', grades.length, '', '', '', ''],
    ]

    const allRows = [header, ...dataRows, [], ...summaryRows]

    // Create worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(allRows)

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },  // N°
      { wch: 30 }, // Élève
      { wch: 20 }, // Matière
      { wch: 8 },  // Note
      { wch: 8 },  // /20
      { wch: 12 }, // Type
      { wch: 18 }, // Trimestre
      { wch: 14 }, // Date
      { wch: 30 }, // Commentaire
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Notes')

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="notes.xlsx"',
      },
    })
  } catch (error) {
    console.error('Export Excel error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'export Excel des notes" },
      { status: 500 }
    )
  }
}
