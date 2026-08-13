import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

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
 * GET /api/bulletins/[id]/export/excel
 * Exports an INDIVIDUAL bulletin (with detailed grades per subject) as an .xlsx file.
 * The workbook contains TWO sheets:
 *   1. "Bulletin"      — the summary (student info + per-subject average + global)
 *   2. "Détail notes"  — the raw list of every grade behind the bulletin
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bulletinId } = await params

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

    // Load detailed grades
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

    // Group by subject (same logic as the PDF + on-screen detail view)
    const gradesBySubject = new Map<
      string,
      {
        subjectName: string
        coefficient: number
        grades: typeof grades
      }
    >()
    for (const g of grades) {
      const key = g.subjectId
      if (!gradesBySubject.has(key)) {
        gradesBySubject.set(key, {
          subjectName: g.subject?.name || '—',
          coefficient: g.subject?.coefficient || 1,
          grades: [],
        })
      }
      gradesBySubject.get(key)!.grades.push(g)
    }

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
    const finalAverage = bulletin.average ?? computedAverage

    const student = bulletin.student

    // ===== Sheet 1: Bulletin (summary) =====
    const bulletinRows: (string | number)[][] = [
      ['BULLETIN DE NOTES'],
      [TRIMESTER_LABELS[bulletin.trimester] || bulletin.trimester],
      [`Année scolaire: ${bulletin.schoolYear}`],
      [],
      ['Élève', `${student?.lastName || ''} ${student?.firstName || ''}`.trim()],
      ['Classe', student?.class?.name || '—'],
      ['Genre', student?.gender === 'F' ? 'Féminin' : student?.gender === 'M' ? 'Masculin' : '—'],
      ['Date de naissance', student?.dateOfBirth || '—'],
      ['Contact parent', student?.parentContact || '—'],
      ['Date de génération', bulletin.generatedAt || '—'],
      [],
      ['Matière', 'Coefficient', 'Nb notes', 'Moyenne /20', 'Note×Coef', 'Types', 'Appréciation'],
    ]

    for (const row of subjectRows) {
      bulletinRows.push([
        row.subjectName,
        row.coefficient,
        row.count,
        parseFloat(row.average.toFixed(2)),
        parseFloat(row.weighted.toFixed(2)),
        row.types || '—',
        row.average >= 10 ? 'Acquis' : row.average >= 8 ? 'Fragile' : 'Insuffisant',
      ])
    }

    // Total row
    bulletinRows.push([
      'TOTAL',
      totalCoeff,
      grades.length,
      parseFloat(computedAverage.toFixed(2)),
      parseFloat(totalWeighted.toFixed(2)),
      '',
      '',
    ])

    bulletinRows.push([])
    bulletinRows.push(['Moyenne générale', parseFloat(finalAverage.toFixed(2)), '/20'])
    bulletinRows.push(['Rang', bulletin.rank ? `${bulletin.rank}er` : '—', ''])
    bulletinRows.push(['Appréciation', bulletin.appreciation || '—', ''])

    // Mention / decision
    let mention = 'Insuffisant'
    if (finalAverage >= 16) mention = 'Très bien — Félicitations'
    else if (finalAverage >= 14) mention = 'Bien — Encouragements'
    else if (finalAverage >= 12) mention = 'Assez bien — Tableau d’honneur'
    else if (finalAverage >= 10) mention = 'Passable — Admis'
    bulletinRows.push([])
    bulletinRows.push(['Mention', mention])

    const wsBulletin = XLSX.utils.aoa_to_sheet(bulletinRows)
    wsBulletin['!cols'] = [
      { wch: 26 }, // Matière / label
      { wch: 14 }, // Coef
      { wch: 10 }, // Nb notes
      { wch: 14 }, // Moyenne
      { wch: 14 }, // Note×Coef
      { wch: 26 }, // Types
      { wch: 18 }, // Appréciation
    ]

    // Merge the title rows for a cleaner look
    wsBulletin['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
    ]

    // ===== Sheet 2: Détail des notes =====
    const detailHeader = [
      'Matière',
      'Coefficient',
      'Type',
      'Note',
      'Sur',
      'Note /20',
      'Date',
      'Commentaire',
    ]
    const detailRows: (string | number)[][] = [detailHeader]

    for (const g of grades) {
      const normalized = (g.value / g.maxValue) * 20
      detailRows.push([
        g.subject?.name || '—',
        g.subject?.coefficient || 1,
        GRADE_TYPE_LABELS[g.type] || g.type,
        parseFloat(g.value.toFixed(2)),
        g.maxValue,
        parseFloat(normalized.toFixed(2)),
        g.date || '—',
        g.comment || '',
      ])
    }

    if (grades.length === 0) {
      detailRows.push(['Aucune note enregistrée pour ce trimestre', '', '', '', '', '', '', ''])
    }

    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows)
    wsDetail['!cols'] = [
      { wch: 22 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 8 },
      { wch: 10 },
      { wch: 14 },
      { wch: 40 },
    ]

    // ===== Build the workbook =====
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsBulletin, 'Bulletin')
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Détail notes')

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })

    const studentName = `${student?.lastName || 'eleve'}_${student?.firstName || ''}`
      .trim()
      .replace(/\s+/g, '-')
    const filename = `bulletin_${studentName}_${bulletin.trimester}_${bulletin.schoolYear}.xlsx`

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': excelBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error('Export bulletin individuel Excel error:', error)
    return NextResponse.json(
      {
        error:
          'Erreur lors de l\'export Excel du bulletin: ' +
          (error instanceof Error ? error.message : 'unknown'),
      },
      { status: 500 }
    )
  }
}
