import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionId } from '@/lib/api-auth'
import * as XLSX from 'xlsx'

// French labels for each attendance status — this is the "Pointage" column.
const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: 'Présent',
  absent: 'Absent',
  late: 'En retard',
  excused: 'Excusé',
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const date = searchParams.get('date')
    const schoolYear = searchParams.get('schoolYear') || '2024-2025'

    // Multi-institution isolation.
    const institutionId = await getInstitutionId(request)

    // Build the Prisma `where` clause using the REAL schema:
    //   - Attendance has `schoolYear` and `date` directly
    //   - Attendance -> Student -> Class (Student.classId is the current class)
    //   - Attendance -> Student -> User (User.institutionId scopes the data)
    // The previous implementation referenced a non-existent `studentEnrollment`
    // model and `student.enrollments` relation, which is why exports 500'd.
    const where: Record<string, unknown> = {
      schoolYear,
    }
    if (date) where.date = date

    if (classId && institutionId) {
      where.student = { classId, user: { institutionId } }
    } else if (classId) {
      where.student = { classId }
    } else if (institutionId) {
      where.student = { user: { institutionId } }
    }

    const attendance = await db.attendance.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            classId: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { student: { lastName: 'asc' } }],
    })

    if (attendance.length === 0) {
      return NextResponse.json(
        { error: 'Aucune présence à exporter pour les critères sélectionnés' },
        { status: 404 }
      )
    }

    // ---------- Build the rows ----------
    // Columns requested by the user:
    //   N° ordre | Noms | Classes | Jour | Pointage
    const rows = attendance.map((record, index) => ({
      'N° ordre': index + 1,
      'Noms': `${record.student.lastName.toUpperCase()} ${record.student.firstName}`,
      'Classes': record.student.class?.name || '—',
      'Jour': new Date(record.date + 'T00:00:00').toLocaleDateString('fr-FR'),
      'Pointage': ATTENDANCE_STATUS_LABELS[record.status] || record.status,
    }))

    // ---------- Workbook ----------
    const wb = XLSX.utils.book_new()

    // Main sheet — the attendance list with the 5 requested columns.
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 10 }, // N° ordre
      { wch: 32 }, // Noms
      { wch: 18 }, // Classes
      { wch: 14 }, // Jour
      { wch: 14 }, // Pointage
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Présences')

    // Summary sheet — context + stats.
    const presentCount = attendance.filter((a) => a.status === 'present').length
    const absentCount = attendance.filter((a) => a.status === 'absent').length
    const lateCount = attendance.filter((a) => a.status === 'late').length
    const excusedCount = attendance.filter((a) => a.status === 'excused').length
    const rate =
      attendance.length > 0
        ? `${((presentCount / attendance.length) * 100).toFixed(1)}%`
        : '0%'

    let className = ''
    if (classId) {
      const cls = await db.class.findUnique({ where: { id: classId }, select: { name: true } })
      className = cls?.name || classId
    }

    const summaryRows = [
      { 'Indicateur': 'Année scolaire', 'Valeur': schoolYear },
      { 'Indicateur': 'Classe', 'Valeur': className || 'Toutes' },
      {
        'Indicateur': 'Date',
        'Valeur': date
          ? new Date(date + 'T00:00:00').toLocaleDateString('fr-FR')
          : 'Toutes',
      },
      { 'Indicateur': 'Total enregistrements', 'Valeur': attendance.length },
      { 'Indicateur': 'Présents', 'Valeur': presentCount },
      { 'Indicateur': 'Absents', 'Valeur': absentCount },
      { 'Indicateur': 'En retard', 'Valeur': lateCount },
      { 'Indicateur': 'Excusés', 'Valeur': excusedCount },
      { 'Indicateur': 'Taux de présence', 'Valeur': rate },
    ]

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 28 }]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Résumé')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="presences-${schoolYear}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export Excel error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'export Excel des présences" },
      { status: 500 }
    )
  }
}
