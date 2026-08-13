import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getProclamationData } from '@/lib/proclamation'

/**
 * GET /api/bulletins/proclamation/export/excel
 * Generates a .xlsx workbook of the proclamation list.
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

    const rankLabel = (n: number) => (n === 1 ? '1er' : `${n}ème`)
    const now = new Date().toLocaleDateString('fr-FR')

    // Build the worksheet as an array-of-arrays (aoa)
    const rows: (string | number)[][] = []

    // Title block
    rows.push(['LISTE DE PROCLAMATION'])
    rows.push([data.institution?.name || 'Établissement'])
    rows.push([data.params.periodLabel])
    rows.push([`Année scolaire ${data.params.schoolYear}`])
    rows.push([`Classe : ${data.params.classLabel}`])
    rows.push([`Édité le ${now}`])
    rows.push([])

    // Stats line
    const s = data.stats
    rows.push([
      `Effectif: ${s.totalStudents}`,
      `Réussite: ${s.passedCount} (${s.successRate}%)`,
      `Échec: ${s.failedCount}`,
      `Moy. classe: ${s.classAverage}`,
      `Meilleure moy.: ${s.highestAverage}`,
    ])
    rows.push([])

    // Header
    const header = [
      'Rang',
      'Nom',
      'Prénom',
      'Classe',
      'Moyenne /20',
      'Pourcentage (%)',
      'Mention',
      'Appréciation',
    ]
    rows.push(header)

    // Data rows
    data.entries.forEach((e) => {
      rows.push([
        rankLabel(e.rank),
        e.lastName,
        e.firstName,
        e.className,
        e.average,
        e.percentage,
        e.mention,
        e.appreciation,
      ])
    })

    // Blank line + summary
    rows.push([])
    rows.push(['', 'MOYENNE DE CLASSE', '', '', s.classAverage, '', '', ''])
    rows.push(['', 'TAUX DE RÉUSSITE', '', '', `${s.successRate}%`, '', '', ''])
    rows.push(['', 'TOTAL ÉLÈVES', '', '', s.totalStudents, '', '', ''])

    const ws = XLSX.utils.aoa_to_sheet(rows)

    // Column widths
    ws['!cols'] = [
      { wch: 8 }, // Rang
      { wch: 26 }, // Nom
      { wch: 26 }, // Prénom
      { wch: 16 }, // Classe
      { wch: 14 }, // Moyenne
      { wch: 18 }, // Pourcentage
      { wch: 14 }, // Mention
      { wch: 16 }, // Appréciation
    ]

    // Merge title cells
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 7 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: 7 } },
      { s: { r: 7, c: 0 }, e: { r: 7, c: 7 } },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Proclamation')

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })

    // Filename
    const parts = ['proclamation']
    if (classId) parts.push(data.params.classLabel.replace(/\s+/g, '_'))
    parts.push(data.params.periodLabel.replace(/\s+/g, '_'))
    parts.push(schoolYear)
    const safeName = parts.join('_').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeName}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export proclamation Excel error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'export Excel de la proclamation" },
      { status: 500 }
    )
  }
}
