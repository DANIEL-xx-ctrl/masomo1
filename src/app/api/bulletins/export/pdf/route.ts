import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const TRIMESTER_LABELS: Record<string, string> = {
  '1er': '1er Trimestre',
  '2eme': '2ème Trimestre',
  '3eme': '3ème Trimestre',
}

export async function GET(request: Request) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const trimester = searchParams.get('trimester')
    const schoolYear = searchParams.get('schoolYear') || '2024-2025'
    const search = searchParams.get('search') || ''
    const isProclamation = searchParams.get('proclamation') === 'true'
    const bulletinId = searchParams.get('bulletinId')

    // ===== INDIVIDUAL BULLETIN PDF EXPORT =====
    // Generates a full A4 report card for a single bulletin (one student).
    if (bulletinId) {
      const bulletin = await db.bulletin.findUnique({
        where: { id: bulletinId },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              class: { select: { name: true } },
            },
          },
        },
      })

      if (!bulletin) {
        return NextResponse.json({ error: 'Bulletin introuvable' }, { status: 404 })
      }

      // Fetch all grades for this student / trimester / schoolYear, grouped by subject
      const grades = await db.grade.findMany({
        where: {
          studentId: bulletin.studentId,
          trimester: bulletin.trimester,
          schoolYear: bulletin.schoolYear,
        },
        include: { subject: true },
        orderBy: { subject: { name: 'asc' } },
      })

      // Group grades by subject
      const bySubject = new Map<string, { name: string; coefficient: number; grades: typeof grades }>()
      for (const g of grades) {
        const key = g.subjectId
        if (!bySubject.has(key)) {
          bySubject.set(key, {
            name: g.subject?.name || '—',
            coefficient: g.subject?.coefficient || 1,
            grades: [],
          })
        }
        bySubject.get(key)!.grades.push(g)
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()

      // ---- Header band ----
      doc.setFillColor(16, 185, 129)
      doc.rect(0, 0, pageWidth, 28, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('BULLETIN DE NOTES', pageWidth / 2, 13, { align: 'center' })
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `${TRIMESTER_LABELS[bulletin.trimester] || bulletin.trimester}  —  Année scolaire ${bulletin.schoolYear}`,
        pageWidth / 2,
        22,
        { align: 'center' }
      )

      // ---- Student info box ----
      doc.setTextColor(20, 20, 20)
      let y = 38
      doc.setDrawColor(16, 185, 129)
      doc.setLineWidth(0.3)
      doc.roundedRect(14, y, pageWidth - 28, 22, 2, 2, 'S')
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Élève :', 18, y + 8)
      doc.text('Classe :', 18, y + 16)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `${bulletin.student.lastName} ${bulletin.student.firstName}`,
        38,
        y + 8
      )
      doc.text(bulletin.student.class?.name || '—', 38, y + 16)
      doc.setFont('helvetica', 'bold')
      doc.text('Date :', pageWidth - 60, y + 8)
      doc.setFont('helvetica', 'normal')
      doc.text(bulletin.generatedAt || '—', pageWidth - 48, y + 8)
      y += 30

      // ---- Grades table ----
      const tableBody: string[][] = []
      bySubject.forEach((entry) => {
        const avg =
          entry.grades.length > 0
            ? entry.grades.reduce((s, g) => s + (g.value / g.maxValue) * 20, 0) / entry.grades.length
            : 0
        const types = entry.grades.map((g) => g.type).join(', ')
        tableBody.push([
          entry.name,
          String(entry.coefficient),
          avg.toFixed(2),
          '/20',
          types || '—',
          (entry.grades.map((g) => g.comment).filter(Boolean).join('; ')) || '—',
        ])
      })

      if (tableBody.length === 0) {
        tableBody.push(['Aucune note enregistrée', '', '', '', '', ''])
      }

      autoTable(doc, {
        startY: y,
        head: [['Matière', 'Coef.', 'Note', '/20', 'Type', 'Commentaire']],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 16, halign: 'center' },
          2: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 14, halign: 'center' },
          4: { cellWidth: 35 },
          5: { cellWidth: 'auto' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 2) {
            const val = parseFloat(data.cell.text[0])
            if (!isNaN(val)) {
              data.cell.styles.textColor = val >= 10 ? [4, 120, 87] : [185, 28, 28]
            }
          }
        },
      })

      // @ts-expect-error lastAutoTable is added by the autoTable plugin
      y = (doc.lastAutoTable?.finalY ?? y) + 10

      // ---- Summary box ----
      const boxW = (pageWidth - 28 - 8) / 3
      const boxH = 22
      const labels = [
        { title: 'Moyenne', value: bulletin.average !== null ? bulletin.average.toFixed(2) : '—', sub: '/20' },
        { title: 'Rang', value: bulletin.rank ? `${bulletin.rank}ème` : '—', sub: '' },
        { title: 'Appréciation', value: bulletin.appreciation || '—', sub: '' },
      ]
      labels.forEach((l, i) => {
        const x = 14 + i * (boxW + 4)
        doc.setFillColor(240, 253, 244)
        doc.roundedRect(x, y, boxW, boxH, 2, 2, 'F')
        doc.setDrawColor(16, 185, 129)
        doc.roundedRect(x, y, boxW, boxH, 2, 2, 'S')
        doc.setTextColor(75, 85, 99)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.text(l.title, x + boxW / 2, y + 7, { align: 'center' })
        doc.setTextColor(17, 24, 39)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text(l.value, x + boxW / 2, y + 15, { align: 'center' })
        if (l.sub) {
          doc.setFontSize(8)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(75, 85, 99)
          doc.text(l.sub, x + boxW / 2, y + 20, { align: 'center' })
        }
      })
      y += boxH + 12

      // ---- Mention ----
      const mention =
        bulletin.average !== null
          ? bulletin.average >= 16
            ? 'Félicitations'
            : bulletin.average >= 14
            ? 'Encouragements'
            : bulletin.average >= 12
            ? 'Tableau d’honneur'
            : bulletin.average >= 10
            ? 'Passable'
            : 'Insuffisant'
          : '—'
      doc.setTextColor(17, 24, 39)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`Mention : ${mention}`, 14, y)
      y += 16

      // ---- Signatures ----
      const sigY = Math.max(y, doc.internal.pageSize.getHeight() - 40)
      doc.setDrawColor(156, 163, 175)
      doc.setLineWidth(0.2)
      doc.line(30, sigY, 80, sigY)
      doc.line(pageWidth - 80, sigY, pageWidth - 30, sigY)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(75, 85, 99)
      doc.text('Le Directeur', 55, sigY + 5, { align: 'center' })
      doc.text('Parent / Tuteur', pageWidth - 55, sigY + 5, { align: 'center' })

      const safeName = `${bulletin.student.lastName}_${bulletin.student.firstName}`.replace(/[^a-zA-Z0-9_-]/g, '')
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="bulletin_${safeName}_${bulletin.trimester}.pdf"`,
        },
      })
    }

    const where: Record<string, unknown> = {
      student: { user: { institutionId } },
    }

    if (classId) where.classId = classId
    if (trimester) where.trimester = trimester

    const bulletins = await db.bulletin.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            class: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Filter by search term
    const filtered = search
      ? bulletins.filter((b) => {
          const term = search.toLowerCase()
          return (
            b.student.firstName.toLowerCase().includes(term) ||
            b.student.lastName.toLowerCase().includes(term) ||
            (b.student.class?.name || '').toLowerCase().includes(term) ||
            (TRIMESTER_LABELS[b.trimester] || b.trimester).toLowerCase().includes(term) ||
            (b.appreciation || '').toLowerCase().includes(term) ||
            (b.average?.toFixed(2) || '').includes(term) ||
            (b.rank?.toString() || '').includes(term)
          )
        })
      : bulletins

    if (isProclamation) {
      // ===== PROCLAMATION PDF EXPORT =====
      // Sort by average descending for proclamation
      const procData = filtered
        .filter((b) => b.average !== null)
        .sort((a, b) => (b.average || 0) - (a.average || 0))
        .map((b, idx) => ({
          rank: idx + 1,
          lastName: b.student.lastName,
          firstName: b.student.firstName,
          className: b.student.class?.name || '—',
          average: b.average || 0,
          percentage: Math.round((b.average || 0) / 20 * 10000) / 100,
          appreciation: b.appreciation || '—',
        }))

      const doc = new jsPDF({ orientation: 'landscape' })

      // Title
      doc.setFontSize(20)
      doc.text('LISTE DE PROCLAMATION', 14, 20)

      // School year
      doc.setFontSize(13)
      doc.text(`Année scolaire: ${schoolYear}`, 14, 30)

      // Filters
      let filterY = 38
      const filters: string[] = []
      if (classId) {
        const cls = await db.class.findUnique({ where: { id: classId }, select: { name: true } })
        if (cls) filters.push(`Classe: ${cls.name}`)
      }
      if (trimester) filters.push(`Trimestre: ${TRIMESTER_LABELS[trimester] || trimester}`)
      if (search) filters.push(`Recherche: ${search}`)

      if (filters.length > 0) {
        doc.setFontSize(10)
        doc.text(`Filtres: ${filters.join(' | ')}`, 14, filterY)
        filterY += 8
      }

      // Stats
      const averages = procData.map((p) => p.average)
      const moy = averages.length > 0 ? averages.reduce((a, b) => a + b, 0) / averages.length : 0
      const reussite = averages.length > 0 ? (averages.filter((a) => a >= 10).length / averages.length) * 100 : 0
      const excellent = averages.filter((a) => a >= 16).length

      doc.setFontSize(10)
      doc.text(`Moyenne de classe: ${moy.toFixed(2)}/20  |  Taux de réussite: ${reussite.toFixed(1)}%  |  Excellents: ${excellent}`, 14, filterY)
      filterY += 6

      // Table
      const tableBody = procData.map((entry) => [
        `${entry.rank}ème`,
        entry.lastName,
        entry.firstName,
        entry.className,
        entry.average.toFixed(2),
        `${entry.percentage.toFixed(1)}%`,
        entry.appreciation,
        entry.average >= 16 ? 'Excellent' : entry.average >= 14 ? 'Bien' : entry.average >= 12 ? 'Assez bien' : entry.average >= 10 ? 'Passable' : 'Insuffisant',
      ])

      // Summary
      tableBody.push(['', 'Moyenne de classe', '', '', moy.toFixed(2), '', '', ''])
      tableBody.push(['', 'Taux de réussite', '', '', `${reussite.toFixed(1)}%`, '', '', ''])
      tableBody.push(['', 'Total élèves', '', '', procData.length.toString(), '', '', ''])

      autoTable(doc, {
        startY: filterY + 4,
        head: [['Rang', 'Nom', 'Prénom', 'Classe', 'Moyenne /20', 'Pourcentage', 'Appréciation', 'Niveau']],
        body: tableBody,
        styles: { fontSize: 9 },
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: 255,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 18, halign: 'center' },
          1: { cellWidth: 35 },
          2: { cellWidth: 35 },
          3: { cellWidth: 25 },
          4: { cellWidth: 22, halign: 'center' },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 25 },
          7: { cellWidth: 25 },
        },
        didParseCell: (data) => {
          // Highlight top 3
          if (data.section === 'body' && data.row.index < 3 && data.row.index < procData.length) {
            if (data.row.index === 0) {
              data.cell.styles.fillColor = [255, 251, 235]
              data.cell.styles.fontStyle = 'bold'
            } else if (data.row.index === 1) {
              data.cell.styles.fillColor = [243, 244, 246]
              data.cell.styles.fontStyle = 'bold'
            } else if (data.row.index === 2) {
              data.cell.styles.fillColor = [255, 243, 224]
              data.cell.styles.fontStyle = 'bold'
            }
          }
          // Summary rows
          if (data.row.index >= tableBody.length - 3 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [209, 250, 229]
          }
        },
      })

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="proclamation-${schoolYear}.pdf"`,
        },
      })
    }

    // ===== REGULAR BULLETINS PDF EXPORT =====
    // Create PDF in landscape orientation
    const doc = new jsPDF({ orientation: 'landscape' })

    // Title
    doc.setFontSize(18)
    doc.text('Liste des Bulletins Scolaires', 14, 20)

    // School year
    doc.setFontSize(12)
    doc.text(`Année scolaire: ${schoolYear}`, 14, 28)

    // Active filters
    let filterY = 36
    const filters: string[] = []
    if (classId) {
      const cls = await db.class.findUnique({ where: { id: classId }, select: { name: true } })
      if (cls) filters.push(`Classe: ${cls.name}`)
    }
    if (trimester) filters.push(`Trimestre: ${TRIMESTER_LABELS[trimester] || trimester}`)
    if (search) filters.push(`Recherche: ${search}`)

    if (filters.length > 0) {
      doc.setFontSize(10)
      doc.text(`Filtres: ${filters.join(' | ')}`, 14, filterY)
      filterY += 8
    }

    // Build table data
    const tableBody = filtered.map((bulletin, index) => [
      index + 1,
      `${bulletin.student.lastName} ${bulletin.student.firstName}`,
      bulletin.student.class?.name || '—',
      TRIMESTER_LABELS[bulletin.trimester] || bulletin.trimester,
      bulletin.average !== null ? bulletin.average.toFixed(2) : '—',
      bulletin.rank ? `${bulletin.rank}ème` : '—',
      bulletin.appreciation || '—',
      bulletin.generatedAt || '—',
    ])

    // Stats
    const averages = filtered.filter((b) => b.average !== null).map((b) => b.average as number)
    const moy = averages.length > 0 ? averages.reduce((a, b) => a + b, 0) / averages.length : 0
    const reussite = averages.length > 0 ? (averages.filter((a) => a >= 10).length / averages.length) * 100 : 0

    tableBody.push(['', 'Moyenne générale', '', '', moy.toFixed(2), '', '', ''])
    tableBody.push(['', 'Taux de réussite', '', '', `${reussite.toFixed(1)}%`, '', '', ''])
    tableBody.push(['', 'Total bulletins', '', '', filtered.length.toString(), '', '', ''])

    autoTable(doc, {
      startY: filterY + 2,
      head: [['N°', 'Élève', 'Classe', 'Trimestre', 'Moyenne', 'Rang', 'Appréciation', 'Date génération']],
      body: tableBody,
      styles: { fontSize: 9 },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 55 },
        2: { cellWidth: 30 },
        3: { cellWidth: 40 },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 30 },
        7: { cellWidth: 30 },
      },
      didParseCell: (data) => {
        if (data.row.index >= tableBody.length - 3 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [209, 250, 229]
        }
      },
    })

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="bulletins-${schoolYear}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export bulletins PDF error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'export PDF des bulletins" },
      { status: 500 }
    )
  }
}
