import { NextResponse } from 'next/server'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
} from 'docx'
import { getProclamationData } from '@/lib/proclamation'

/**
 * GET /api/bulletins/proclamation/export/word
 * Generates a .docx document of the proclamation list.
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
    const s = data.stats

    const EMERALD = '10B981'
    const LIGHT_EMERALD = 'D1FAE5'
    const AMBER = 'FEF3C7'
    const GRAY = 'F3F4F6'
    const ORANGE = 'FFEDD5'
    const DARK = '111827'
    const MUTED = '6B7280'

    // ---- Title paragraph ----
    const titleParagraph = new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({
          text: 'LISTE DE PROCLAMATION',
          bold: true,
          size: 32,
          color: EMERALD,
        }),
      ],
    })

    const institutionParagraph = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: data.institution?.name || 'Établissement',
          bold: true,
          size: 24,
          color: DARK,
        }),
      ],
    })

    const periodParagraph = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: data.params.periodLabel,
          size: 22,
          color: EMERALD,
          bold: true,
        }),
      ],
    })

    const metaParagraph = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Année scolaire ${data.params.schoolYear}  —  Classe : ${data.params.classLabel}  —  Édité le ${now}`,
          size: 18,
          color: MUTED,
        }),
      ],
    })

    const statsParagraph = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Effectif : ${s.totalStudents}  |  Réussite : ${s.passedCount} (${s.successRate}%)  |  Échec : ${s.failedCount}  |  Moy. classe : ${s.classAverage.toFixed(2)}/20`,
          size: 18,
          color: DARK,
          bold: true,
        }),
      ],
    })

    // ---- Table header row ----
    const headerCells = ['Rang', 'Nom', 'Prénom', 'Classe', 'Moyenne /20', 'Pourcentage', 'Mention', 'Appréciation'].map(
      (label) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: EMERALD, color: 'auto' },
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: label, bold: true, color: 'FFFFFF', size: 18 })],
            }),
          ],
        })
    )

    const headerRow = new TableRow({
      tableHeader: true,
      children: headerCells,
    })

    // ---- Data rows ----
    const dataRows = data.entries.map((e, idx) => {
      // Podium shading for the top 3
      let shading: string | undefined
      if (idx === 0) shading = AMBER
      else if (idx === 1) shading = GRAY
      else if (idx === 2) shading = ORANGE

      const cellMargins = { top: 40, bottom: 40, left: 80, right: 80 }
      const mkCell = (text: string, opts?: { align?: typeof AlignmentType.CENTER; bold?: boolean; color?: string; width?: number }) =>
        new TableCell({
          ...(shading
            ? { shading: { type: ShadingType.CLEAR, fill: shading, color: 'auto' } }
            : {}),
          margins: cellMargins,
          ...(opts?.width ? { width: { size: opts.width, type: WidthType.PERCENTAGE } } : {}),
          children: [
            new Paragraph({
              alignment: opts?.align ?? AlignmentType.LEFT,
              children: [
                new TextRun({
                  text,
                  bold: opts?.bold ?? false,
                  size: 18,
                  color: opts?.color ?? DARK,
                }),
              ],
            }),
          ],
        })

      const avgColor = e.average >= 10 ? '047857' : 'B91C1C'

      return new TableRow({
        children: [
          mkCell(rankLabel(e.rank), { align: AlignmentType.CENTER, bold: true }),
          mkCell(e.lastName, { bold: true }),
          mkCell(e.firstName),
          mkCell(e.className, { align: AlignmentType.CENTER }),
          mkCell(e.average.toFixed(2), { align: AlignmentType.CENTER, bold: true, color: avgColor }),
          mkCell(`${e.percentage.toFixed(1)} %`, { align: AlignmentType.CENTER }),
          mkCell(e.mention, { align: AlignmentType.CENTER }),
          mkCell(e.appreciation, { align: AlignmentType.CENTER }),
        ],
      })
    })

    // ---- Summary rows ----
    const summaryCellMargins = { top: 60, bottom: 60, left: 80, right: 80 }
    const mkSummaryCell = (text: string, opts?: { align?: typeof AlignmentType.CENTER; bold?: boolean; width?: number }) =>
      new TableCell({
        shading: { type: ShadingType.CLEAR, fill: LIGHT_EMERALD, color: 'auto' },
        margins: summaryCellMargins,
        ...(opts?.width ? { width: { size: opts.width, type: WidthType.PERCENTAGE } } : {}),
        children: [
          new Paragraph({
            alignment: opts?.align ?? AlignmentType.LEFT,
            children: [new TextRun({ text, bold: opts?.bold ?? true, size: 18, color: DARK })],
          }),
        ],
      })

    const emptySummaryCell = () =>
      new TableCell({
        shading: { type: ShadingType.CLEAR, fill: LIGHT_EMERALD, color: 'auto' },
        margins: summaryCellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: '' })] })],
      })

    const summaryRows: TableRow[] = [
      new TableRow({
        children: [
          emptySummaryCell(),
          mkSummaryCell('MOYENNE DE CLASSE'),
          emptySummaryCell(),
          emptySummaryCell(),
          mkSummaryCell(s.classAverage.toFixed(2), { align: AlignmentType.CENTER }),
          emptySummaryCell(),
          emptySummaryCell(),
          emptySummaryCell(),
        ],
      }),
      new TableRow({
        children: [
          emptySummaryCell(),
          mkSummaryCell('TAUX DE RÉUSSITE'),
          emptySummaryCell(),
          emptySummaryCell(),
          mkSummaryCell(`${s.successRate.toFixed(1)} %`, { align: AlignmentType.CENTER }),
          emptySummaryCell(),
          emptySummaryCell(),
          emptySummaryCell(),
        ],
      }),
      new TableRow({
        children: [
          emptySummaryCell(),
          mkSummaryCell('TOTAL ÉLÈVES'),
          emptySummaryCell(),
          emptySummaryCell(),
          mkSummaryCell(String(s.totalStudents), { align: AlignmentType.CENTER }),
          emptySummaryCell(),
          emptySummaryCell(),
          emptySummaryCell(),
        ],
      }),
    ]

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
      },
      rows: [headerRow, ...dataRows, ...summaryRows],
    })

    // ---- Footer signatures ----
    const footerParagraph = new Paragraph({
      spacing: { before: 600 },
      children: [new TextRun({ text: '' })],
    })

    const signatureRow = new TableRow({
      children: [
        new TableCell({
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: '6B7280' },
            bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          },
          margins: { top: 200, bottom: 40, left: 40, right: 200 },
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Le Directeur', size: 18, color: MUTED })],
            }),
          ],
        }),
        new TableCell({
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: '6B7280' },
            bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          },
          margins: { top: 200, bottom: 40, left: 200, right: 40 },
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Le Secrétariat', size: 18, color: MUTED })],
            }),
          ],
        }),
      ],
    })

    const signatureTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      rows: [signatureRow],
    })

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            titleParagraph,
            institutionParagraph,
            periodParagraph,
            metaParagraph,
            statsParagraph,
            table,
            footerParagraph,
            signatureTable,
          ],
        },
      ],
    })

    const wordBuffer = await Packer.toBuffer(doc)

    // Filename
    const parts = ['proclamation']
    if (classId) parts.push(data.params.classLabel.replace(/\s+/g, '_'))
    parts.push(data.params.periodLabel.replace(/\s+/g, '_'))
    parts.push(schoolYear)
    const safeName = parts.join('_').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)

    return new NextResponse(wordBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeName}.docx"`,
      },
    })
  } catch (error) {
    console.error('Export proclamation Word error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'export Word de la proclamation" },
      { status: 500 }
    )
  }
}
