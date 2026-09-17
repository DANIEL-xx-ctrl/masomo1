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
import {
  getFilteredGrades,
  resolveFilterLabels,
  GRADE_TYPE_LABELS,
  TRIMESTER_LABELS,
  formatDateFR,
} from '@/lib/grades-export'

/**
 * GET /api/grades/export/word
 *
 * Exports the filtered grades list as a .docx file (Word). The filter
 * params and teacher/student scoping are shared with the PDF and Excel
 * export routes via `getFilteredGrades` (see src/lib/grades-export.ts).
 */
export async function GET(request: Request) {
  try {
    const { grades, schoolYear, classId, subjectId, trimester } =
      await getFilteredGrades(request)
    const { className, subjectName } = await resolveFilterLabels(classId, subjectId)

    // ---- Build summary stats ----
    const scaledValues = grades.map((g) => (g.value / g.maxValue) * 20)
    const moyenne =
      scaledValues.length > 0
        ? scaledValues.reduce((a, b) => a + b, 0) / scaledValues.length
        : 0
    const tauxReussite =
      scaledValues.length > 0
        ? (scaledValues.filter((v) => v >= 10).length / scaledValues.length) * 100
        : 0

    // ---- Build table rows ----
    const headerCells = [
      'N°',
      'Élève',
      'Matière',
      'Note',
      '/20',
      'Type',
      'Trimestre',
      'Date',
    ].map(
      (text) =>
        new TableCell({
          shading: { type: ShadingType.SOLID, color: '2980B9', fill: '2980B9' },
          children: [
            new Paragraph({
              children: [new TextRun({ text, bold: true, color: 'FFFFFF' })],
            }),
          ],
        })
    )

    const dataRows = grades.map((grade, index) => {
      const scaledValue = (grade.value / grade.maxValue) * 20
      const cells = [
        String(index + 1),
        `${grade.student.lastName} ${grade.student.firstName}`,
        grade.subject.name,
        String(grade.value),
        scaledValue.toFixed(2),
        GRADE_TYPE_LABELS[grade.type] || grade.type,
        TRIMESTER_LABELS[grade.trimester] || grade.trimester,
        formatDateFR(grade.date),
      ]
      return new TableRow({
        children: cells.map(
          (text) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text })] })],
            })
        ),
      })
    })

    // Summary rows (Moyenne, Taux de réussite, Total)
    const summaryRow = (label: string, value: string) =>
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            shading: { type: ShadingType.SOLID, color: 'EBF5FB', fill: 'EBF5FB' },
            children: [
              new Paragraph({
                children: [new TextRun({ text: label, bold: true })],
              }),
            ],
          }),
          new TableCell({
            columnSpan: 3,
            shading: { type: ShadingType.SOLID, color: 'EBF5FB', fill: 'EBF5FB' },
            children: [
              new Paragraph({
                children: [new TextRun({ text: value, bold: true })],
              }),
            ],
          }),
          new TableCell({
            columnSpan: 3,
            shading: { type: ShadingType.SOLID, color: 'EBF5FB', fill: 'EBF5FB' },
            children: [new Paragraph({ children: [new TextRun({ text: '' })] })],
          }),
        ],
      })

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
        left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
        right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      },
      rows: [
        new TableRow({
          tableHeader: true,
          children: headerCells,
        }),
        ...dataRows,
        summaryRow('Moyenne générale', moyenne.toFixed(2)),
        summaryRow('Taux de réussite', `${tauxReussite.toFixed(1)}%`),
        summaryRow('Total notes', String(grades.length)),
      ],
    })

    // ---- Build filters text ----
    const filters: string[] = []
    if (className) filters.push(`Classe: ${className}`)
    if (subjectName) filters.push(`Matière: ${subjectName}`)
    if (trimester)
      filters.push(`Trimestre: ${TRIMESTER_LABELS[trimester] || trimester}`)

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: 'Liste des Notes', bold: true, size: 32 })],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Année scolaire: ${schoolYear}`, size: 22 }),
              ],
            }),
            ...(filters.length > 0
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Filtres: ${filters.join(' | ')}`,
                        size: 20,
                        italics: true,
                      }),
                    ],
                  }),
                ]
              : []),
            new Paragraph({ text: '' }),
            table,
          ],
        },
      ],
    })

    const buffer = await Packer.toBuffer(doc)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="notes-${schoolYear}.docx"`,
      },
    })
  } catch (error) {
    console.error('Export Word error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'export Word des notes" },
      { status: 500 }
    )
  }
}

