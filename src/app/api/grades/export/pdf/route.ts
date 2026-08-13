import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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
    const { grades, schoolYear, classId, subjectId, trimester } =
      await getFilteredGrades(request)

    // Fetch filter labels for display
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

    // Create PDF in landscape orientation
    const doc = new jsPDF({ orientation: 'landscape' })

    // Title
    doc.setFontSize(18)
    doc.text('Liste des Notes', 14, 20)

    // School year
    doc.setFontSize(12)
    doc.text(`Année scolaire: ${schoolYear}`, 14, 28)

    // Active filters
    let filterY = 36
    const filters: string[] = []
    if (className) filters.push(`Classe: ${className}`)
    if (subjectName) filters.push(`Matière: ${subjectName}`)
    if (trimester)
      filters.push(`Trimestre: ${TRIMESTER_LABELS[trimester] || trimester}`)

    if (filters.length > 0) {
      doc.setFontSize(10)
      doc.text(`Filtres: ${filters.join(' | ')}`, 14, filterY)
      filterY += 8
    }

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

    // Build table data
    const tableBody = grades.map((grade, index) => {
      const scaledValue = (grade.value / grade.maxValue) * 20
      return [
        index + 1,
        `${grade.student.lastName} ${grade.student.firstName}`,
        grade.subject.name,
        grade.value,
        scaledValue.toFixed(2),
        GRADE_TYPE_LABELS[grade.type] || grade.type,
        TRIMESTER_LABELS[grade.trimester] || grade.trimester,
        grade.date,
      ]
    })

    // Summary rows
    tableBody.push([
      '',
      'Moyenne générale',
      '',
      '',
      moyenne.toFixed(2),
      '',
      '',
      '',
    ])
    tableBody.push([
      '',
      'Taux de réussite',
      '',
      '',
      `${tauxReussite.toFixed(1)}%`,
      '',
      '',
      '',
    ])
    tableBody.push([
      '',
      'Total notes',
      '',
      '',
      grades.length.toString(),
      '',
      '',
      '',
    ])

    autoTable(doc, {
      startY: filterY + 2,
      head: [
        [
          'N°',
          'Élève',
          'Matière',
          'Note',
          '/20',
          'Type',
          'Trimestre',
          'Date',
        ],
      ],
      body: tableBody,
      styles: { fontSize: 9 },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 55 },
        2: { cellWidth: 40 },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 25 },
        6: { cellWidth: 40 },
        7: { cellWidth: 30 },
      },
      // Style the summary rows at the bottom
      didParseCell: (data) => {
        if (
          data.row.index >= tableBody.length - 3 &&
          data.section === 'body'
        ) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [235, 245, 251]
        }
      },
    })

    // Return PDF as downloadable file
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="notes-${schoolYear}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export PDF error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'export PDF des notes" },
      { status: 500 }
    )
  }
}
