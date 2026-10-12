import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'
import { generateExcelBuffer, generateWordBuffer } from '@/lib/bulletin-export'
import { renderExcelToHtml, extractExcelData } from '@/lib/bulletin-excel-renderer'
import type { BulletinStructure } from '@/lib/bulletin-parser'
// @ts-ignore — html-to-docx n'a pas de types complets
import HTMLtoDOCX from 'html-to-docx'

/**
 * GET /api/settings/bulletin-templates/[id]/export?format=xlsx|pdf|word
 * Exporte un modèle de bulletin au format demandé.
 *
 * - xlsx : renvoie le fichier Excel original (fidèle à 100%)
 * - pdf  : génère un PDF fidèle au bulletin original (couleurs, bordures, merges)
 * - word : génère un DOCX à partir du HTML fidèle (préserve la mise en forme)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const institutionId = await getInstitutionIdWithFallback(request)
    const format = (request.nextUrl.searchParams.get('format') || 'xlsx').toLowerCase()

    if (!['xlsx', 'pdf', 'word'].includes(format)) {
      return NextResponse.json(
        { error: 'Format non supporté. Utilisez xlsx, pdf ou word.' },
        { status: 400 }
      )
    }

    let template = await db.bulletinTemplate.findFirst({
      where: { id, institutionId },
    })

    if (!template) {
      const fallback = await db.bulletinTemplate.findUnique({ where: { id } })
      if (!fallback) {
        return NextResponse.json({ error: 'Modèle non trouvé' }, { status: 404 })
      }
      template = fallback
    }

    const safeName = (template.name || 'bulletin').replace(/[^a-zA-Z0-9_-]/g, '_')

    // ---- Excel : renvoyer le fichier original ----
    if (format === 'xlsx') {
      if (template.mediaFileId) {
        const media = await db.mediaFile.findUnique({
          where: { id: template.mediaFileId },
        })
        if (media) {
          const buffer = Buffer.from(media.data, 'base64')
          return new NextResponse(buffer as any, {
            status: 200,
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'Content-Disposition': `attachment; filename="${safeName}.xlsx"`,
            },
          })
        }
      }
      // Fallback: régénérer depuis la structure parsée
      const structure = template.structure as unknown as BulletinStructure
      if (!structure) {
        return NextResponse.json(
          { error: 'Structure du bulletin introuvable' },
          { status: 400 }
        )
      }
      const buffer = await generateExcelBuffer(structure)
      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${safeName}.xlsx"`,
        },
      })
    }

    // ---- PDF & Word : utiliser le HTML fidèle ----
    if (!template.mediaFileId) {
      return NextResponse.json(
        { error: 'Aucun fichier Excel associé à ce modèle' },
        { status: 400 }
      )
    }

    const mediaFile = await db.mediaFile.findUnique({
      where: { id: template.mediaFileId },
    })

    if (!mediaFile) {
      return NextResponse.json(
        { error: 'Fichier Excel introuvable' },
        { status: 404 }
      )
    }

    const excelBuffer = Buffer.from(mediaFile.data, 'base64')

    // ---- PDF : générer un PDF fidèle à l'Excel original ----
    if (format === 'pdf') {
      const pdfBuffer = await generatePdfFromExcel(excelBuffer, template.name)
      return new NextResponse(pdfBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
        },
      })
    }

    // ---- Word : HTML → DOCX avec html-to-docx (préserve les styles) ----
    if (format === 'word') {
      const htmlContent = await renderExcelToHtml(excelBuffer, 'BULLETIN')
      const docxBuffer = await HTMLtoDOCX(htmlContent, null, {
        table: { row: { cantSplit: true } },
        footer: false,
        pageNumber: false,
      })
      return new NextResponse(docxBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${safeName}.docx"`,
        },
      })
    }

    return NextResponse.json({ error: 'Format inconnu' }, { status: 400 })
  } catch (error) {
    console.error('[bulletin-templates] export error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * Génère un PDF à partir du fichier Excel original en préservant
 * les styles (couleurs, bordures, merges).
 */
async function generatePdfFromExcel(
  excelBuffer: Buffer,
  title: string
): Promise<Buffer> {
  const { cells, rowCount, colCount } = await extractExcelData(excelBuffer, 'BULLETIN')

  const jsPDF = (await import('jspdf')).default
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })
  const pageWidth = doc.internal.pageSize.getWidth()

  // ---- Titre ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(11, 26, 46)
  doc.text(title || 'BULLETIN', pageWidth / 2, 8, { align: 'center' })
  doc.setDrawColor(11, 26, 46)
  doc.setLineWidth(0.3)
  doc.line(10, 11, pageWidth - 10, 11)

  // ---- Construire la matrice de cellules pour autoTable ----
  // autoTable attend un tableau 2D de strings
  type CellInfo = {
    content: string
    rowspan: number
    colspan: number
    fillColor?: [number, number, number]
    textColor?: [number, number, number]
    bold?: boolean
    halign?: 'left' | 'center' | 'right'
  }
  const grid: (CellInfo | null)[][] = []
  for (let r = 1; r <= rowCount; r++) {
    const row: (CellInfo | null)[] = []
    for (let c = 1; c <= colCount; c++) {
      const cell = cells.find((x) => x.row === r && x.col === c)
      if (cell) {
        row.push({
          content: cell.content,
          rowspan: cell.rowspan,
          colspan: cell.colspan,
          fillColor: cell.fillColor,
          textColor: cell.textColor,
          bold: cell.bold,
          halign: cell.halign,
        })
      } else {
        row.push(null)
      }
    }
    grid.push(row)
  }

  // Calculer la largeur de la première colonne (plus large pour les noms de matières)
  const firstColWidth = 50
  const remainingCols = colCount - 1
  const remainingWidth = pageWidth - 20 - firstColWidth
  const colWidth = Math.max(8, remainingWidth / Math.max(remainingCols, 1))

  const columnStyles: any = { 0: { cellWidth: firstColWidth } }
  for (let i = 1; i < colCount; i++) {
    columnStyles[i] = { cellWidth: colWidth }
  }

  autoTable(doc, {
    startY: 14,
    body: grid.map((r) => r.map((c) => (c ? c.content : ''))) as any,
    theme: 'grid',
    styles: {
      fontSize: 5,
      cellPadding: 0.5,
      overflow: 'linebreak',
      lineColor: [30, 58, 95],
      lineWidth: 0.1,
      textColor: [11, 26, 46],
      halign: 'center',
      valign: 'middle',
    },
    columnStyles,
    didParseCell: (data: any) => {
      const rowIdx = data.row.index
      const colIdx = data.column.index
      if (rowIdx < grid.length && colIdx < grid[rowIdx].length) {
        const info = grid[rowIdx][colIdx]
        if (info) {
          if (info.fillColor) {
            data.cell.styles.fillColor = info.fillColor
          }
          if (info.textColor) {
            data.cell.styles.textColor = info.textColor
          }
          if (info.bold) {
            data.cell.styles.fontStyle = 'bold'
          }
          if (info.halign) {
            data.cell.styles.halign = info.halign
          }
          if (info.rowspan > 1) {
            data.cell.rowSpan = info.rowspan
          }
          if (info.colspan > 1) {
            data.cell.colSpan = info.colspan
          }
        }
      }
    },
  })

  return Buffer.from(doc.output('arraybuffer'))
}
