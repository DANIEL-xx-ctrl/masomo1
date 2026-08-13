import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'
import * as XLSX from 'xlsx'

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

    // ===== INDIVIDUAL BULLETIN EXCEL EXPORT =====
    // Generates a structured .xlsx report card for a single bulletin.
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

      // Fetch all grades for this student / trimester / schoolYear
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

      const tLabel = TRIMESTER_LABELS[bulletin.trimester] || bulletin.trimester

      // Build array-of-arrays (aoa) for the worksheet
      const rows: (string | number)[][] = []

      // Title block
      rows.push(['BULLETIN DE NOTES'])
      rows.push([tLabel])
      rows.push([`Année scolaire ${bulletin.schoolYear}`])
      rows.push([])
      // Student info
      rows.push(['Nom', bulletin.student.lastName])
      rows.push(['Prénom', bulletin.student.firstName])
      rows.push(['Classe', bulletin.student.class?.name || '—'])
      rows.push(['Date de génération', bulletin.generatedAt || '—'])
      rows.push([])

      // Grades table header
      rows.push(['Matière', 'Coefficient', 'Moyenne /20', 'Type(s)', 'Commentaire'])
      bySubject.forEach((entry) => {
        const avg =
          entry.grades.length > 0
            ? entry.grades.reduce((s, g) => s + (g.value / g.maxValue) * 20, 0) / entry.grades.length
            : 0
        const types = entry.grades.map((g) => g.type).join(', ') || '—'
        const comment = entry.grades.map((g) => g.comment).filter(Boolean).join('; ') || '—'
        rows.push([entry.name, entry.coefficient, parseFloat(avg.toFixed(2)), types, comment])
      })
      if (bySubject.size === 0) {
        rows.push(['Aucune note enregistrée', '', '', '', ''])
      }
      rows.push([])

      // Récapitulatif
      rows.push(['RÉCAPITULATIF'])
      rows.push(['Moyenne générale', bulletin.average !== null ? parseFloat(bulletin.average.toFixed(2)) : '—'])
      rows.push(['Rang', bulletin.rank ? `${bulletin.rank}ème` : '—'])
      rows.push(['Appréciation', bulletin.appreciation || '—'])
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
      rows.push(['Mention', mention])
      rows.push([])
      rows.push(['Le Directeur', '', '', 'Parent / Tuteur'])

      const ws = XLSX.utils.aoa_to_sheet(rows)

      // Column widths
      ws['!cols'] = [
        { wch: 22 },
        { wch: 22 },
        { wch: 14 },
        { wch: 22 },
        { wch: 40 },
      ]

      // Merge title cells for a nicer look
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Bulletin')

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
      const safeName = `${bulletin.student.lastName}_${bulletin.student.firstName}`.replace(/[^a-zA-Z0-9_-]/g, '')

      return new NextResponse(excelBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="bulletin_${safeName}_${bulletin.trimester}.xlsx"`,
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
      // ===== PROCLAMATION EXCEL EXPORT =====
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
          level: b.average >= 16 ? 'Excellent' : b.average >= 14 ? 'Bien' : b.average >= 12 ? 'Assez bien' : b.average >= 10 ? 'Passable' : 'Insuffisant',
        }))

      // Header
      const header = ['Rang', 'Nom', 'Prénom', 'Classe', 'Moyenne /20', 'Pourcentage (%)', 'Appréciation', 'Niveau']

      // Data rows
      const dataRows = procData.map((entry) => [
        `${entry.rank}ème`,
        entry.lastName,
        entry.firstName,
        entry.className,
        parseFloat(entry.average.toFixed(2)),
        parseFloat(entry.percentage.toFixed(1)),
        entry.appreciation,
        entry.level,
      ])

      // Summary
      const avgArr = procData.map((p) => p.average)
      const moy = avgArr.length > 0 ? avgArr.reduce((a, b) => a + b, 0) / avgArr.length : 0
      const reussite = avgArr.length > 0 ? (avgArr.filter((a) => a >= 10).length / avgArr.length) * 100 : 0

      const summaryRows = [
        ['', 'Moyenne de classe', '', '', parseFloat(moy.toFixed(2)), '', '', ''],
        ['', 'Taux de réussite', '', '', `${reussite.toFixed(1)}%`, '', '', ''],
        ['', 'Total élèves', '', '', procData.length, '', '', ''],
      ]

      const allRows = [header, ...dataRows, [], ...summaryRows]

      const ws = XLSX.utils.aoa_to_sheet(allRows)

      ws['!cols'] = [
        { wch: 8 },   // Rang
        { wch: 25 },  // Nom
        { wch: 25 },  // Prénom
        { wch: 15 },  // Classe
        { wch: 14 },  // Moyenne
        { wch: 16 },  // Pourcentage
        { wch: 15 },  // Appréciation
        { wch: 14 },  // Niveau
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Proclamation')

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })

      return new NextResponse(excelBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="proclamation-${schoolYear}.xlsx"`,
        },
      })
    }

    // ===== REGULAR BULLETINS EXCEL EXPORT =====
    // Build header
    const header = ['N°', 'Nom', 'Prénom', 'Classe', 'Trimestre', 'Moyenne', 'Rang', 'Appréciation', 'Date génération']

    // Build data rows
    const dataRows = filtered.map((bulletin, index) => [
      index + 1,
      bulletin.student.lastName,
      bulletin.student.firstName,
      bulletin.student.class?.name || '—',
      TRIMESTER_LABELS[bulletin.trimester] || bulletin.trimester,
      bulletin.average !== null ? parseFloat(bulletin.average.toFixed(2)) : '—',
      bulletin.rank ? `${bulletin.rank}ème` : '—',
      bulletin.appreciation || '—',
      bulletin.generatedAt || '—',
    ])

    // Summary rows
    const averages = filtered.filter((b) => b.average !== null).map((b) => b.average as number)
    const moy = averages.length > 0 ? averages.reduce((a, b) => a + b, 0) / averages.length : 0
    const reussite = averages.length > 0 ? (averages.filter((a) => a >= 10).length / averages.length) * 100 : 0

    const summaryRows = [
      ['', 'Moyenne générale', '', '', '', parseFloat(moy.toFixed(2)), '', '', ''],
      ['', 'Taux de réussite', '', '', '', `${reussite.toFixed(1)}%`, '', '', ''],
      ['', 'Total bulletins', '', '', '', filtered.length, '', '', ''],
    ]

    const allRows = [header, ...dataRows, [], ...summaryRows]

    // Create worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(allRows)

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },  // N°
      { wch: 25 }, // Nom
      { wch: 25 }, // Prénom
      { wch: 15 }, // Classe
      { wch: 20 }, // Trimestre
      { wch: 10 }, // Moyenne
      { wch: 10 }, // Rang
      { wch: 15 }, // Appréciation
      { wch: 18 }, // Date
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Bulletins')

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="bulletins.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export bulletins Excel error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'export Excel des bulletins" },
      { status: 500 }
    )
  }
}
