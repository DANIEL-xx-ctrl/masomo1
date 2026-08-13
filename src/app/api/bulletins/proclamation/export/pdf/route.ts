import { NextResponse } from 'next/server'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getProclamationData } from '@/lib/proclamation'

/**
 * GET /api/bulletins/proclamation/export/pdf
 * Generates a landscape A4 PDF of the proclamation list.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolYear = searchParams.get('schoolYear')
    const period = searchParams.get('period') || 'trimester'
    const trimester = searchParams.get('trimester')
    const semester = searchParams.get('semester')
    const classId = searchParams.get('classId')

    if (!schoolYear) {
      return NextResponse.json({ error: 'Année scolaire requise' }, { status: 400 })
    }

    const data = await getProclamationData(request, {
      schoolYear,
      period,
      trimester,
      semester,
      classId,
    })

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const now = new Date().toLocaleDateString('fr-FR')

    // ---- Header band ----
    doc.setFillColor(16, 185, 129)
    doc.rect(0, 0, pageWidth, 26, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('LISTE DE PROCLAMATION', pageWidth / 2, 12, { align: 'center' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(data.params.periodLabel, pageWidth / 2, 20, { align: 'center' })

    // ---- Sub-header: institution + filters ----
    let y = 34
    doc.setTextColor(20, 20, 20)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    if (data.institution?.name) {
      doc.text(data.institution.name, 14, y)
    }
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(75, 85, 99)
    doc.text(`Année scolaire : ${data.params.schoolYear}`, 14, y)
    doc.text(`Classe : ${data.params.classLabel}`, 14 + pageWidth / 3, y)
    doc.text(`Édité le : ${now}`, 14 + (pageWidth * 2) / 3, y)
    y += 6

    // ---- Stats line ----
    const s = data.stats
    doc.setFontSize(9)
    doc.setTextColor(17, 24, 39)
    doc.setFont('helvetica', 'bold')
    doc.text(
      `Effectif : ${s.totalStudents}  |  Réussite : ${s.passedCount} (${s.successRate}%)  |  Échec : ${s.failedCount}  |  Moy. classe : ${s.classAverage.toFixed(2)}/20  |  Meilleure moy. : ${s.highestAverage.toFixed(2)}/20`,
      14,
      y
    )
    y += 4

    // ---- Table ----
    const head = [['Rang', 'Nom', 'Prénom', 'Classe', 'Moyenne /20', 'Pourcentage', 'Mention', 'Appréciation']]

    const rankLabel = (n: number) => (n === 1 ? '1er' : `${n}ème`)

    const body = data.entries.map((e) => [
      rankLabel(e.rank),
      e.lastName,
      e.firstName,
      e.className,
      e.average.toFixed(2),
      `${e.percentage.toFixed(1)} %`,
      e.mention,
      e.appreciation,
    ])

    // Add summary rows at the end
    body.push(['', 'MOYENNE DE CLASSE', '', '', s.classAverage.toFixed(2), '', '', ''])
    body.push(['', 'TAUX DE RÉUSSITE', '', '', `${s.successRate.toFixed(1)} %`, '', '', ''])
    body.push(['', 'TOTAL ÉLÈVES', '', '', String(s.totalStudents), '', '', ''])

    autoTable(doc, {
      startY: y + 2,
      head,
      body,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 40 },
        2: { cellWidth: 38 },
        3: { cellWidth: 30, halign: 'center' },
        4: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 28, halign: 'center' },
        6: { cellWidth: 28, halign: 'center' },
        7: { cellWidth: 'auto' },
      },
      didParseCell: (d) => {
        if (d.section !== 'body') return
        const totalRows = body.length
        // Top-3 highlighting
        if (d.row.index < 3 && d.row.index < data.entries.length) {
          const podium = [
            [255, 251, 235], // 1er — amber
            [243, 244, 246], // 2ème — gray
            [255, 237, 213], // 3ème — orange-100
          ]
          d.cell.styles.fillColor = podium[d.row.index] as [number, number, number]
          d.cell.styles.fontStyle = 'bold'
        }
        // Color the average cell based on pass/fail
        if (d.column.index === 4 && d.row.index < data.entries.length) {
          const val = parseFloat(d.cell.text[0])
          if (!isNaN(val)) {
            d.cell.styles.textColor = val >= 10 ? [4, 120, 87] : [185, 28, 28]
          }
        }
        // Summary rows (last 3)
        if (d.row.index >= totalRows - 3) {
          d.cell.styles.fontStyle = 'bold'
          d.cell.styles.fillColor = [209, 250, 229]
          d.cell.styles.textColor = [17, 24, 39]
        }
      },
    })

    // ---- Footer ----
    // @ts-expect-error lastAutoTable is added by the autoTable plugin
    const finalY: number = doc.lastAutoTable?.finalY ?? y
    const pageHeight = doc.internal.pageSize.getHeight()
    const footerY = Math.max(finalY + 16, pageHeight - 20)

    doc.setDrawColor(156, 163, 175)
    doc.setLineWidth(0.2)
    doc.line(30, footerY, 90, footerY)
    doc.line(pageWidth - 90, footerY, pageWidth - 30, footerY)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(75, 85, 99)
    doc.text('Le Directeur', 60, footerY + 5, { align: 'center' })
    doc.text('Le Secrétariat', pageWidth - 60, footerY + 5, { align: 'center' })

    // Page numbers
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(`Page ${i}/${pageCount}`, pageWidth - 20, pageHeight - 6, { align: 'right' })
    }

    // Filename
    const parts = ['proclamation']
    if (classId) parts.push(data.params.classLabel.replace(/\s+/g, '_'))
    parts.push(data.params.periodLabel.replace(/\s+/g, '_'))
    parts.push(schoolYear)
    const safeName = parts.join('_').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export proclamation PDF error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'export PDF de la proclamation" },
      { status: 500 }
    )
  }
}
