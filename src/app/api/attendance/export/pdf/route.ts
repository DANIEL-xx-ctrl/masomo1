import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionId } from '@/lib/api-auth'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

    // Multi-institution isolation: restrict records to the caller's institution.
    // Super-admin (no institution header) sees all records.
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

    if (classId) {
      // Filter by the student's current class.
      where.student = { classId }
    } else if (institutionId) {
      // No specific class → scope to the institution via the student's user.
      where.student = { user: { institutionId } }
    }

    // If both classId AND institutionId are set, combine them so a user can
    // never export another institution's data even by guessing a classId.
    if (classId && institutionId) {
      where.student = { classId, user: { institutionId } }
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

    // Fetch class name for the filter label in the header.
    let className = ''
    if (classId) {
      const cls = await db.class.findUnique({ where: { id: classId }, select: { name: true } })
      className = cls?.name || classId
    }

    // ---------- Build the PDF ----------
    const doc = new jsPDF({ orientation: 'landscape' })

    // Title block
    doc.setFontSize(18)
    doc.setTextColor(15, 23, 42) // slate-900
    doc.text('Liste des Présences', 14, 18)

    doc.setFontSize(11)
    doc.setTextColor(71, 85, 105) // slate-600
    doc.text(`Année scolaire : ${schoolYear}`, 14, 26)

    // Active filters line
    const filters: string[] = []
    if (className) filters.push(`Classe : ${className}`)
    if (date) {
      filters.push(
        `Date : ${new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`
      )
    }
    let filterY = 32
    if (filters.length > 0) {
      doc.setFontSize(9)
      doc.text(filters.join('   |   '), 14, filterY)
      filterY += 6
    }

    // Summary stats
    const presentCount = attendance.filter((a) => a.status === 'present').length
    const absentCount = attendance.filter((a) => a.status === 'absent').length
    const lateCount = attendance.filter((a) => a.status === 'late').length
    const excusedCount = attendance.filter((a) => a.status === 'excused').length
    const rate = attendance.length > 0 ? ((presentCount / attendance.length) * 100).toFixed(1) : '0'

    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    doc.text(
      `Résumé :  ${presentCount} Présents  |  ${absentCount} Absents  |  ${lateCount} En retard  |  ${excusedCount} Excusés  —  Taux : ${rate}%  (${attendance.length} enregistrements)`,
      14,
      filterY
    )
    filterY += 8

    // ---------- Table data ----------
    // Columns requested by the user:
    //   N° ordre | Noms | Classes | Jour | Pointage
    const tableBody: (string | number)[][] = []
    attendance.forEach((record, idx) => {
      const dayLabel = new Date(record.date + 'T00:00:00').toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      tableBody.push([
        idx + 1, // N° ordre
        `${record.student.lastName.toUpperCase()} ${record.student.firstName}`, // Noms
        record.student.class?.name || '—', // Classes
        dayLabel, // Jour
        ATTENDANCE_STATUS_LABELS[record.status] || record.status, // Pointage
      ])
    })

    autoTable(doc, {
      startY: filterY + 2,
      head: [['N° ordre', 'Noms', 'Classes', 'Jour', 'Pointage']],
      body: tableBody,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: {
        fillColor: [16, 185, 129], // emerald-500
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' }, // N° ordre
        1: { cellWidth: 80 }, // Noms
        2: { cellWidth: 40, halign: 'center' }, // Classes
        3: { cellWidth: 35, halign: 'center' }, // Jour
        4: { cellWidth: 35, halign: 'center', fontStyle: 'bold' }, // Pointage
      },
      alternateRowStyles: { fillColor: [240, 253, 250] }, // emerald-50
      didParseCell: (data) => {
        // Color the Pointage cell text by status for instant readability.
        if (data.section === 'body' && data.column.index === 4) {
          const val = String(data.cell.raw)
          if (val === 'Présent') data.cell.styles.textColor = [22, 163, 74] // green-600
          else if (val === 'Absent') data.cell.styles.textColor = [220, 38, 38] // red-600
          else if (val === 'En retard') data.cell.styles.textColor = [217, 119, 6] // amber-600
          else if (val === 'Excusé') data.cell.styles.textColor = [14, 165, 233] // sky-500
        }
      },
    })

    // Footer: generation timestamp
    const finalY =
      // @ts-expect-error — autoTable injects lastAutoTableProps on the doc instance
      typeof doc.lastAutoTable?.finalY === 'number' ? doc.lastAutoTable.finalY : filterY + 10
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184) // slate-400
    doc.text(
      `Généré le ${new Date().toLocaleString('fr-FR')}`,
      14,
      finalY + 10
    )

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="presences-${schoolYear}${className ? '-' + className.replace(/\s+/g, '-') : ''}${date ? '-' + date : ''}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export PDF error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'export PDF des présences" },
      { status: 500 }
    )
  }
}
