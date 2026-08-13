import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const TRIMESTER_LABELS: Record<string, string> = {
  '1er': '1er Trimestre',
  '2eme': '2ème Trimestre',
  '3eme': '3ème Trimestre',
}

const GRADE_TYPE_LABELS: Record<string, string> = {
  devoir: 'Devoir',
  examen: 'Examen',
  controle: 'Contrôle',
}

/**
 * GET /api/bulletins/[id]/export/pdf
 * Exports an INDIVIDUAL bulletin (with detailed grades per subject) as a PDF.
 * The PDF is designed to be a printable single-student report card.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bulletinId } = await params

    // Load the bulletin with student + class info
    const bulletin = await db.bulletin.findUnique({
      where: { id: bulletinId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gender: true,
            dateOfBirth: true,
            parentContact: true,
            class: { select: { id: true, name: true, level: true } },
          },
        },
      },
    })

    if (!bulletin) {
      return NextResponse.json(
        { error: 'Bulletin introuvable' },
        { status: 404 }
      )
    }

    // Load the detailed grades for this student/trimester/year
    const grades = await db.grade.findMany({
      where: {
        studentId: bulletin.studentId,
        trimester: bulletin.trimester,
        schoolYear: bulletin.schoolYear,
      },
      include: {
        subject: true,
      },
      orderBy: { subject: { name: 'asc' } },
    })

    // Group grades by subject (like the on-screen detail view)
    const gradesBySubject = new Map<string, { subjectId: string; subjectName: string; coefficient: number; grades: typeof grades }>()
    for (const g of grades) {
      const key = g.subjectId
      if (!gradesBySubject.has(key)) {
        gradesBySubject.set(key, {
          subjectId: key,
          subjectName: g.subject?.name || '—',
          coefficient: g.subject?.coefficient || 1,
          grades: [],
        })
      }
      gradesBySubject.get(key)!.grades.push(g)
    }

    // Compute per-subject average (on /20) + global average
    const subjectRows: Array<{
      subjectName: string
      coefficient: number
      average: number
      types: string
      count: number
      weighted: number
    }> = []

    let totalWeighted = 0
    let totalCoeff = 0

    gradesBySubject.forEach((entry) => {
      const subjectAvg =
        entry.grades.length > 0
          ? entry.grades.reduce((s, g) => s + (g.value / g.maxValue) * 20, 0) /
            entry.grades.length
          : 0
      const types = Array.from(
        new Set(entry.grades.map((g) => GRADE_TYPE_LABELS[g.type] || g.type))
      ).join(', ')
      subjectRows.push({
        subjectName: entry.subjectName,
        coefficient: entry.coefficient,
        average: subjectAvg,
        types,
        count: entry.grades.length,
        weighted: subjectAvg * entry.coefficient,
      })
      totalWeighted += subjectAvg * entry.coefficient
      totalCoeff += entry.coefficient
    })

    const computedAverage = totalCoeff > 0 ? totalWeighted / totalCoeff : 0

    // ===== Build the PDF =====
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()

    // --- Header band ---
    doc.setFillColor(16, 185, 129) // emerald-600
    doc.rect(0, 0, pageWidth, 24, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('BULLETIN DE NOTES', pageWidth / 2, 11, { align: 'center' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(
      TRIMESTER_LABELS[bulletin.trimester] || bulletin.trimester,
      pageWidth / 2,
      18,
      { align: 'center' }
    )

    // --- School year ---
    doc.setTextColor(40, 40, 40)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`Année scolaire: ${bulletin.schoolYear}`, 14, 33)

    // --- Student info block ---
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    let y = 41
    const student = bulletin.student
    const leftCol = 14
    const rightCol = pageWidth / 2 + 4

    doc.setFont('helvetica', 'bold')
    doc.text('Élève:', leftCol, y)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${student?.lastName || '—'} ${student?.firstName || ''}`.trim(),
      leftCol + 18,
      y
    )

    doc.setFont('helvetica', 'bold')
    doc.text('Classe:', rightCol, y)
    doc.setFont('helvetica', 'normal')
    doc.text(student?.class?.name || '—', rightCol + 18, y)
    y += 6

    if (student?.dateOfBirth) {
      doc.setFont('helvetica', 'bold')
      doc.text('Né(e) le:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(student.dateOfBirth, leftCol + 18, y)
    }

    doc.setFont('helvetica', 'bold')
    doc.text('Genre:', rightCol, y)
    doc.setFont('helvetica', 'normal')
    doc.text(
      student?.gender === 'F' ? 'Féminin' : student?.gender === 'M' ? 'Masculin' : '—',
      rightCol + 18,
      y
    )
    y += 6

    if (student?.parentContact) {
      doc.setFont('helvetica', 'bold')
      doc.text('Contact parent:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(student.parentContact, leftCol + 30, y)
    }

    doc.setFont('helvetica', 'bold')
    doc.text('Généré le:', rightCol, y)
    doc.setFont('helvetica', 'normal')
    doc.text(bulletin.generatedAt || new Date().toISOString().split('T')[0], rightCol + 18, y)
    y += 4

    // --- Grades table ---
    const tableBody = subjectRows.map((row) => [
      row.subjectName,
      String(row.coefficient),
      row.count.toString(),
      row.average.toFixed(2),
      row.weighted.toFixed(2),
      row.types || '—',
      row.average >= 10 ? 'Acquis' : row.average >= 8 ? 'Fragile' : 'Insuffisant',
    ])

    // Summary rows appended at the bottom of the table
    tableBody.push([
      'TOTAL',
      String(totalCoeff),
      String(grades.length),
      computedAverage.toFixed(2),
      totalWeighted.toFixed(2),
      '',
      '',
    ])

    autoTable(doc, {
      startY: y + 2,
      head: [
        ['Matière', 'Coef.', 'Nb notes', 'Moyenne /20', 'Note×Coef', 'Types', 'Appréciation'],
      ],
      body: tableBody,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 14, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 32 },
        6: { cellWidth: 32, halign: 'center' },
      },
      didParseCell: (data) => {
        // Highlight the TOTAL row
        if (
          data.section === 'body' &&
          data.row.index === tableBody.length - 1
        ) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [209, 250, 229] // emerald-100
        }
        // Color the average cell red/green based on the value
        if (
          data.section === 'body' &&
          data.column.index === 3 &&
          data.row.index < tableBody.length - 1
        ) {
          const val = parseFloat(String(data.cell.text[0]))
          if (!isNaN(val)) {
            data.cell.styles.textColor = val >= 10 ? [5, 150, 105] : [220, 38, 38]
            data.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })

    // @ts-expect-error — autoTable adds lastAutoTable to the doc instance
    const afterTableY = doc.lastAutoTable.finalY + 8

    // --- Summary cards: Moyenne / Rang / Appréciation ---
    const cardW = (pageWidth - 28 - 8) / 3 // 3 cards, 14mm margins, 4mm gap
    const cardH = 22
    const cardY = afterTableY
    const finalAvgForColor = bulletin.average ?? computedAverage
    const avgColor: [number, number, number] =
      finalAvgForColor >= 10 ? [5, 150, 105] : [220, 38, 38]

    // Card 1: Moyenne
    doc.setFillColor(236, 253, 245) // emerald-50
    doc.roundedRect(14, cardY, cardW, cardH, 2, 2, 'F')
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Moyenne générale', 14 + cardW / 2, cardY + 7, { align: 'center' })
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(avgColor[0], avgColor[1], avgColor[2])
    doc.text(
      (bulletin.average ?? computedAverage).toFixed(2),
      14 + cardW / 2,
      cardY + 16,
      { align: 'center' }
    )
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.text('/20', 14 + cardW / 2, cardY + 20, { align: 'center' })

    // Card 2: Rang
    doc.setFillColor(240, 253, 244)
    doc.roundedRect(14 + cardW + 4, cardY, cardW, cardH, 2, 2, 'F')
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(9)
    doc.text('Rang', 14 + cardW + 4 + cardW / 2, cardY + 7, { align: 'center' })
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 184, 166) // teal-600
    doc.text(
      bulletin.rank ? `${bulletin.rank}er` : '—',
      14 + cardW + 4 + cardW / 2,
      cardY + 16,
      { align: 'center' }
    )
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.text('de la classe', 14 + cardW + 4 + cardW / 2, cardY + 20, {
      align: 'center',
    })

    // Card 3: Appréciation
    doc.setFillColor(255, 251, 235) // amber-50
    doc.roundedRect(14 + (cardW + 4) * 2, cardY, cardW, cardH, 2, 2, 'F')
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(9)
    doc.text('Appréciation', 14 + (cardW + 4) * 2 + cardW / 2, cardY + 7, {
      align: 'center',
    })
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(217, 119, 6) // amber-600
    doc.text(
      bulletin.appreciation || '—',
      14 + (cardW + 4) * 2 + cardW / 2,
      cardY + 16,
      { align: 'center' }
    )

    // --- Mention / decision line ---
    const decisionY = cardY + cardH + 8
    const finalAvg = bulletin.average ?? computedAverage
    let decision = 'Insuffisant'
    if (finalAvg >= 16) decision = 'Très bien — Félicitations'
    else if (finalAvg >= 14) decision = 'Bien — Encouragements'
    else if (finalAvg >= 12) decision = 'Assez bien — Tableau d’honneur'
    else if (finalAvg >= 10) decision = 'Passable — Admis'
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text(`Mention: ${decision}`, 14, decisionY)

    // --- Signature area ---
    const sigY = decisionY + 22
    doc.setDrawColor(200, 200, 200)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text('Le Directeur / La Directrice', 30, sigY, { align: 'center' })
    doc.text('Le Professeur Principal', pageWidth / 2, sigY, { align: 'center' })
    doc.text('Parent / Tuteur', pageWidth - 30, sigY, { align: 'center' })
    doc.line(15, sigY + 18, 60, sigY + 18)
    doc.line(pageWidth / 2 - 25, sigY + 18, pageWidth / 2 + 25, sigY + 18)
    doc.line(pageWidth - 60, sigY + 18, pageWidth - 15, sigY + 18)

    // --- Footer ---
    const footerY = doc.internal.pageSize.getHeight() - 8
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Bulletin généré le ${new Date().toLocaleDateString('fr-FR')} — MASOMO`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    )

    // --- Filename ---
    const studentName = `${student?.lastName || 'eleve'}_${student?.firstName || ''}`
      .trim()
      .replace(/\s+/g, '-')
    const filename = `bulletin_${studentName}_${bulletin.trimester}_${bulletin.schoolYear}.pdf`

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error('Export bulletin individuel PDF error:', error)
    return NextResponse.json(
      {
        error:
          'Erreur lors de l\'export PDF du bulletin: ' +
          (error instanceof Error ? error.message : 'unknown'),
      },
      { status: 500 }
    )
  }
}
