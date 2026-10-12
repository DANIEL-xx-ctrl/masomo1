/**
 * Bulletin Export Generators
 *
 * Génère des exports d'un bulletin structuré vers :
 *   - Excel (.xlsx) — via exceljs, avec styles complets
 *   - PDF  (.pdf)    — via jspdf + jspdf-autotable
 *   - Word (.docx)   — via docx
 */

import ExcelJS from 'exceljs'
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalTabStopType,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { BulletinStructure } from './bulletin-parser'

// ---- Couleurs (thème RDC officiel) ----
const COLOR_HEADER_BG = 'FF0B1A2E'        // bleu foncé
const COLOR_DOMAIN_BG = 'FF1E3A5F'        // bleu moyen
const COLOR_SOUSDOM_BG = 'FFD6E4F0'       // bleu clair
const COLOR_SUBTOTAL_BG = 'FFE2E8F0'      // gris-bleu
const COLOR_MAXIMA_BG = 'FFC9A227'        // doré
const COLOR_BORDER = 'FF1E3A5F'
const COLOR_WHITE = 'FFFFFFFF'
const COLOR_TEXT_DARK = 'FF0B1A2E'

// ============================================================================
// EXCEL EXPORT
// ============================================================================

export async function generateExcelBuffer(struct: BulletinStructure): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'MASOMO'
  wb.created = new Date()

  const ws = wb.addWorksheet('BULLETIN', {
    properties: { defaultRowHeight: 18 },
    views: [{ showGridLines: false }],
  })

  const colsCount = struct.meta.trimesterCount === 3 ? 20 : 14
  const colWidths = [32, 8, 8, 8, 9, 10, 10, 10, 8, 8, 9, 10, 10, 10, 8, 8, 9, 10, 10, 10]
  for (let i = 0; i < colsCount; i++) {
    ws.getColumn(i + 1).width = colWidths[i] || 8
  }

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: ExcelJS.BorderStyle.thin, color: { argb: COLOR_BORDER } },
    left: { style: ExcelJS.BorderStyle.thin, color: { argb: COLOR_BORDER } },
    bottom: { style: ExcelJS.BorderStyle.thin, color: { argb: COLOR_BORDER } },
    right: { style: ExcelJS.BorderStyle.thin, color: { argb: COLOR_BORDER } },
  }

  // ---- Header (lignes 1-7) ----
  const h = struct.header
  // R1 — Pays
  ws.mergeCells(1, 1, 1, colsCount)
  setCell(ws, 1, 1, h.pays || 'REPUBLIQUE DEMOCRATIQUE DU CONGO', {
    bold: true, size: 12, align: 'center',
    fill: COLOR_HEADER_BG, fontColor: COLOR_WHITE,
  })
  ws.getRow(1).height = 24

  // R2 — N° ID
  ws.mergeCells(2, 1, 2, colsCount)
  setCell(ws, 2, 1, 'N° ID', { bold: true, align: 'center', fill: COLOR_SOUSDOM_BG })

  // R3 — Ville / Nom élève
  ws.mergeCells(3, 1, 3, 4)
  setCell(ws, 3, 1, h.ville, { bold: true })
  ws.mergeCells(3, 9, 3, colsCount)
  setCell(ws, 3, 9, h.eleveNom, { bold: true })

  // R4 — Commune / Date naiss
  ws.mergeCells(4, 1, 4, 4)
  setCell(ws, 4, 1, h.commune)
  ws.mergeCells(4, 9, 4, colsCount)
  setCell(ws, 4, 9, h.eleveId)

  // R5 — École / Classe
  ws.mergeCells(5, 1, 5, 4)
  setCell(ws, 5, 1, h.ecole, { bold: true })
  ws.mergeCells(5, 9, 5, colsCount)
  setCell(ws, 5, 9, h.eleveClasse)

  // R6 — Code / N° Perm
  ws.mergeCells(6, 1, 6, 4)
  setCell(ws, 6, 1, h.code)
  ws.mergeCells(6, 9, 6, colsCount)
  setCell(ws, 6, 9, h.elevePerm)

  // R7 — Titre bulletin
  ws.mergeCells(7, 1, 7, colsCount)
  setCell(ws, 7, 1, h.titre || `BULLETIN DE L'ELEVE : DEGRE ELEMENTaire`, {
    bold: true, align: 'center', size: 11,
    fill: COLOR_DOMAIN_BG, fontColor: COLOR_WHITE,
  })
  ws.getRow(7).height = 22

  // R8 — Trimestres (group headers)
  const t = struct.trimestres
  setCell(ws, 8, 1, 'BRANCHES', { bold: true, align: 'center', fill: COLOR_HEADER_BG, fontColor: COLOR_WHITE, border: thinBorder })
  ws.mergeCells(8, 1, 9, 1) // BRANCHES sur 2 lignes
  if (t.length >= 1) {
    ws.mergeCells(8, 2, 8, 8)
    setCell(ws, 8, 2, t[0], { bold: true, align: 'center', fill: COLOR_HEADER_BG, fontColor: COLOR_WHITE, border: thinBorder })
  }
  if (t.length >= 2) {
    ws.mergeCells(8, 9, 8, 14)
    setCell(ws, 8, 9, t[1], { bold: true, align: 'center', fill: COLOR_HEADER_BG, fontColor: COLOR_WHITE, border: thinBorder })
  }
  if (t.length >= 3) {
    ws.mergeCells(8, 15, 8, 20)
    setCell(ws, 8, 15, t[2], { bold: true, align: 'center', fill: COLOR_HEADER_BG, fontColor: COLOR_WHITE, border: thinBorder })
  }

  // R9 — Sub-headers
  const subHeaders =
    t.length === 3
      ? [
          'MAX per', '1è P', '2è P', 'MAX EX.', 'PTS OBT.', 'MAX TRIM.', 'PTS OBT.',
          '3è P', '4è P', 'MAX EX.', 'PTS OBT', 'MAX TRI.', 'PTS OBT',
          '5è P', '6è P', 'MAX EX.', 'PTS OBT', 'MAX TRI.', 'PTS OBT',
        ]
      : [
          'MAX per', '1è P', '2è P', 'MAX EX.', 'PTS OBT.', 'MAX TRIM.', 'PTS OBT.',
          '3è P', '4è P', 'MAX EX.', 'PTS OBT', 'MAX TRIM.', 'PTS OBT',
        ]
  subHeaders.forEach((h, idx) => {
    setCell(ws, 9, idx + 2, h, {
      bold: true, size: 9, align: 'center',
      fill: COLOR_HEADER_BG, fontColor: COLOR_WHITE, border: thinBorder,
    })
  })
  ws.getRow(9).height = 20

  // R10 — empty
  ws.getRow(10).height = 6

  // ---- Domaines + courses ----
  let r = 11
  for (const dom of struct.domaines) {
    // Domaine row
    ws.mergeCells(r, 1, r, colsCount)
    setCell(ws, r, 1, dom.nom, {
      bold: true, size: 10, align: 'left',
      fill: COLOR_DOMAIN_BG, fontColor: COLOR_WHITE, border: thinBorder,
    })
    ws.getRow(r).height = 20
    r++

    for (const sd of dom.sousDomaines) {
      // Sous-domaine row (seulement si son nom est différent du domaine)
      if (sd.nom && sd.nom !== dom.nom) {
        ws.mergeCells(r, 1, r, colsCount)
        setCell(ws, r, 1, sd.nom, {
          bold: true, size: 9, align: 'left',
          fill: COLOR_SOUSDOM_BG, fontColor: COLOR_TEXT_DARK, border: thinBorder,
        })
        r++
      }

      // Courses
      for (const c of sd.courses) {
        writeCourseRow(ws, r, c, t.length, { border: thinBorder })
        r++
      }

      // Sous-total du sous-domaine
      if (sd.sousTotal) {
        writeCourseRow(ws, r, sd.sousTotal, t.length, {
          border: thinBorder, fill: COLOR_SUBTOTAL_BG, bold: true,
        })
        r++
      }
    }

    // Sous-total du domaine
    if (dom.sousTotal) {
      writeCourseRow(ws, r, dom.sousTotal, t.length, {
        border: thinBorder, fill: COLOR_SUBTOTAL_BG, bold: true,
      })
      r++
    }
  }

  // ---- MAXIMA GENERAUX ----
  if (struct.maxima) {
    writeCourseRow(ws, r, struct.maxima.row, t.length, {
      border: thinBorder, fill: COLOR_MAXIMA_BG, fontColor: COLOR_WHITE, bold: true,
    })
    r++
  }

  // ---- Wrap into buffer ----
  const arrayBuf = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuf)
}

function setCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: string | number,
  opts: {
    bold?: boolean
    size?: number
    align?: 'left' | 'center' | 'right'
    fill?: string
    fontColor?: string
    border?: Partial<ExcelJS.Borders>
  } = {}
) {
  const cell = ws.getCell(row, col)
  cell.value = value
  cell.font = {
    bold: opts.bold ?? false,
    size: opts.size ?? 10,
    color: { argb: opts.fontColor || COLOR_TEXT_DARK },
    name: 'Calibri',
  }
  cell.alignment = { vertical: 'middle', horizontal: opts.align || 'left' }
  if (opts.fill) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: opts.fill },
    }
  }
  if (opts.border) {
    cell.border = opts.border
  }
}

function writeCourseRow(
  ws: ExcelJS.Worksheet,
  row: number,
  c: BulletinStructure['domaines'][number]['sousDomaines'][number]['courses'][number],
  trimesterCount: number,
  opts: {
    border?: Partial<ExcelJS.Borders>
    fill?: string
    fontColor?: string
    bold?: boolean
  } = {}
) {
  setCell(ws, row, 1, c.nom, { ...opts, align: 'left' })
  setCell(ws, row, 2, c.maxPer as any, { ...opts, align: 'center' })
  setCell(ws, row, 3, c.p1 as any, { ...opts, align: 'center' })
  setCell(ws, row, 4, c.p2 as any, { ...opts, align: 'center' })
  setCell(ws, row, 5, c.maxEX1 as any, { ...opts, align: 'center' })
  setCell(ws, row, 6, c.ptsObt1 as any, { ...opts, align: 'center' })
  setCell(ws, row, 7, c.maxTrim1 as any, { ...opts, align: 'center' })
  setCell(ws, row, 8, c.trim1Pts as any, { ...opts, align: 'center' })
  if (trimesterCount >= 2) {
    setCell(ws, row, 9, c.p3 as any, { ...opts, align: 'center' })
    setCell(ws, row, 10, c.p4 as any, { ...opts, align: 'center' })
    setCell(ws, row, 11, c.maxEX2 as any, { ...opts, align: 'center' })
    setCell(ws, row, 12, c.ptsObt2 as any, { ...opts, align: 'center' })
    setCell(ws, row, 13, c.maxTrim2 as any, { ...opts, align: 'center' })
    setCell(ws, row, 14, c.trim2Pts as any, { ...opts, align: 'center' })
  }
  if (trimesterCount >= 3) {
    setCell(ws, row, 15, c.p5 as any, { ...opts, align: 'center' })
    setCell(ws, row, 16, c.p6 as any, { ...opts, align: 'center' })
    setCell(ws, row, 17, c.maxEX3 as any, { ...opts, align: 'center' })
    setCell(ws, row, 18, c.ptsObt3 as any, { ...opts, align: 'center' })
    setCell(ws, row, 19, c.maxTrim3 as any, { ...opts, align: 'center' })
    setCell(ws, row, 20, c.trim3Pts as any, { ...opts, align: 'center' })
  }
}

// ============================================================================
// PDF EXPORT
// ============================================================================

export function generatePdfBuffer(struct: BulletinStructure): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  // ---- Header text ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(struct.header.pays || 'REPUBLIQUE DEMOCRATIQUE DU CONGO', pageWidth / 2, 8, { align: 'center' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`N° ID`, pageWidth / 2, 13, { align: 'center' })

  // Left column (institution)
  doc.setFont('helvetica', 'bold')
  doc.text(struct.header.ville, 12, 20)
  doc.setFont('helvetica', 'normal')
  doc.text(struct.header.commune, 12, 25)
  doc.setFont('helvetica', 'bold')
  doc.text(struct.header.ecole, 12, 30)
  doc.setFont('helvetica', 'normal')
  doc.text(`Code: ${struct.header.code}`, 12, 35)

  // Right column (student)
  doc.setFont('helvetica', 'bold')
  doc.text(struct.header.eleveNom, pageWidth - 12, 20, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.text(`N° ID: ${struct.header.eleveId}`, pageWidth - 12, 25)
  doc.text(`Date naiss: ${struct.header.eleveDateNaiss}`, pageWidth - 12, 30)
  doc.text(`Classe: ${struct.header.eleveClasse}  |  N° Perm: ${struct.header.elevePerm}`, pageWidth - 12, 35)

  // Title bar
  doc.setFillColor(11, 26, 46)
  doc.rect(0, 40, pageWidth, 6, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(
    struct.header.titre || `BULLETIN DE L'ELEVE`,
    pageWidth / 2, 44, { align: 'center' }
  )
  doc.setTextColor(0, 0, 0)

  // ---- Course table ----
  const t = struct.trimestres
  const head =
    t.length === 3
      ? [[
          'BRANCHES', 'MAX', '1P', '2P', 'EX', 'PTS', 'TRIM', 'PTS',
          '3P', '4P', 'EX', 'PTS', 'TRIM', 'PTS',
          '5P', '6P', 'EX', 'PTS', 'TRIM', 'PTS',
        ]]
      : [[
          'BRANCHES', 'MAX', '1P', '2P', 'EX', 'PTS', 'TRIM', 'PTS',
          '3P', '4P', 'EX', 'PTS', 'TRIM', 'PTS',
        ]]

  const body: (string | number)[][] = []

  for (const dom of struct.domaines) {
    body.push([dom.nom.toUpperCase(), ...Array(head[0].length - 1).fill('')])
    for (const sd of dom.sousDomaines) {
      if (sd.nom && sd.nom !== dom.nom) {
        body.push(['  ' + sd.nom, ...Array(head[0].length - 1).fill('')])
      }
      for (const c of sd.courses) {
        body.push(courseToRow(c, t.length))
      }
      if (sd.sousTotal) {
        body.push(courseToRow(sd.sousTotal, t.length, true))
      }
    }
    if (dom.sousTotal) {
      body.push(courseToRow(dom.sousTotal, t.length, true))
    }
  }

  if (struct.maxima) {
    body.push(courseToRow(struct.maxima.row, t.length, false, true))
  }

  autoTable(doc, {
    startY: 48,
    head: head as any,
    body: body as any,
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1.2, overflow: 'linebreak' },
    headStyles: { fillColor: [11, 26, 46], textColor: 255, fontSize: 6.5, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' } },
    didParseCell: (data) => {
      const raw = data.cell.raw as string
      if (!raw) return
      // Domaine row → blue background
      if (data.row.index >= 0 && data.section === 'body') {
        const trimmed = raw.trim().toUpperCase()
        if (trimmed.startsWith('DOMAINE')) {
          data.cell.styles.fillColor = [30, 58, 95]
          data.cell.styles.textColor = [255, 255, 255]
          data.cell.styles.fontStyle = 'bold'
        } else if (trimmed === 'SOUS-TOTAL' || trimmed === 'SOUS TOTAL') {
          data.cell.styles.fillColor = [226, 232, 240]
          data.cell.styles.fontStyle = 'bold'
        } else if (raw.startsWith('MAXIMA')) {
          data.cell.styles.fillColor = [201, 162, 39]
          data.cell.styles.textColor = [255, 255, 255]
          data.cell.styles.fontStyle = 'bold'
        } else if (raw.startsWith('  ')) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [214, 228, 240]
        }
      }
    },
  })

  return Buffer.from(doc.output('arraybuffer'))
}

function courseToRow(
  c: BulletinStructure['domaines'][number]['sousDomaines'][number]['courses'][number],
  trimesterCount: number,
  isSubtotal = false,
  isMaxima = false
): (string | number)[] {
  const name = isSubtotal ? `SOUS-TOTAL — ${c.nom}` : c.nom
  if (trimesterCount === 3) {
    return [
      name,
      c.maxPer, c.p1, c.p2, c.maxEX1, c.ptsObt1, c.maxTrim1, c.trim1Pts,
      c.p3, c.p4, c.maxEX2, c.ptsObt2, c.maxTrim2, c.trim2Pts,
      c.p5 || '', c.p6 || '', c.maxEX3 || '', c.ptsObt3 || '', c.maxTrim3 || '', c.trim3Pts || '',
    ]
  }
  return [
    name,
    c.maxPer, c.p1, c.p2, c.maxEX1, c.ptsObt1, c.maxTrim1, c.trim1Pts,
    c.p3, c.p4, c.maxEX2, c.ptsObt2, c.maxTrim2, c.trim2Pts,
  ]
}

// ============================================================================
// WORD EXPORT
// ============================================================================

export async function generateWordBuffer(struct: BulletinStructure): Promise<Buffer> {
  const t = struct.trimestres
  const colsCount = t.length === 3 ? 20 : 14

  const headerParagraphs: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: struct.header.pays || 'REPUBLIQUE DEMOCRATIQUE DU CONGO',
        bold: true, size: 24,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'N° ID', bold: true, size: 18 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      shading: { type: ShadingType.SOLID, color: '1E3A5F', fill: '1E3A5F' },
      children: [new TextRun({
        text: struct.header.titre || `BULLETIN DE L'ELEVE`,
        bold: true, size: 22, color: 'FFFFFF',
      })],
    }),
    new Paragraph({ children: [new TextRun('')] }),
    // Institution + student info
    new Paragraph({
      children: [
        new TextRun({ text: `${struct.header.ville} — ${struct.header.commune}`, bold: true }),
        new TextRun({ text: '          ' }),
        new TextRun({ text: `Élève: ${struct.header.eleveNom}`, bold: true }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `${struct.header.ecole} (Code: ${struct.header.code})`, bold: true }),
        new TextRun({ text: '          ' }),
        new TextRun({ text: `N° ID: ${struct.header.eleveId} | Naiss: ${struct.header.eleveDateNaiss}` }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Classe: ${struct.header.eleveClasse}` }),
        new TextRun({ text: '          ' }),
        new TextRun({ text: `N° Perm: ${struct.header.elevePerm}` }),
      ],
    }),
    new Paragraph({ children: [new TextRun('')] }),
  ]

  // ---- Build table header row ----
  const tableHeaderCells: TableCell[] = []
  tableHeaderCells.push(new TableCell({
    width: { size: 32, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: '0B1A2E', fill: '0B1A2E' },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'BRANCHES', bold: true, color: 'FFFFFF' })],
    })],
  }))

  const subLabels =
    t.length === 3
      ? ['MAX', '1P', '2P', 'EX', 'PTS', 'TRIM', 'PTS', '3P', '4P', 'EX', 'PTS', 'TRIM', 'PTS', '5P', '6P', 'EX', 'PTS', 'TRIM', 'PTS']
      : ['MAX', '1P', '2P', 'EX', 'PTS', 'TRIM', 'PTS', '3P', '4P', 'EX', 'PTS', 'TRIM', 'PTS']
  for (const lbl of subLabels) {
    tableHeaderCells.push(new TableCell({
      shading: { type: ShadingType.SOLID, color: '0B1A2E', fill: '0B1A2E' },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: lbl, bold: true, color: 'FFFFFF', size: 14 })],
      })],
    }))
  }
  const tableRows: TableRow[] = [new TableRow({
    children: tableHeaderCells,
    tableHeader: true,
  })]

  // ---- Body rows ----
  const borderAll = {
    top: { style: BorderStyle.SINGLE, size: 1, color: '1E3A5F' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: '1E3A5F' },
    left: { style: BorderStyle.SINGLE, size: 1, color: '1E3A5F' },
    right: { style: BorderStyle.SINGLE, size: 1, color: '1E3A5F' },
  }

  for (const dom of struct.domaines) {
    // Domaine row — blue background, span all columns
    tableRows.push(new TableRow({
      children: [new TableCell({
        columnSpan: colsCount,
        shading: { type: ShadingType.SOLID, color: '1E3A5F', fill: '1E3A5F' },
        borders: borderAll,
        children: [new Paragraph({
          children: [new TextRun({ text: dom.nom, bold: true, color: 'FFFFFF', size: 16 })],
        })],
      })],
    }))

    for (const sd of dom.sousDomaines) {
      if (sd.nom && sd.nom !== dom.nom) {
        tableRows.push(new TableRow({
          children: [new TableCell({
            columnSpan: colsCount,
            shading: { type: ShadingType.SOLID, color: 'D6E4F0', fill: 'D6E4F0' },
            borders: borderAll,
            children: [new Paragraph({
              children: [new TextRun({ text: sd.nom, bold: true, size: 14 })],
            })],
          })],
        }))
      }

      for (const c of sd.courses) {
        tableRows.push(new TableRow({
          children: courseToDocxCells(c, t.length, borderAll),
        }))
      }

      if (sd.sousTotal) {
        tableRows.push(new TableRow({
          children: courseToDocxCells(sd.sousTotal, t.length, borderAll, true),
        }))
      }
    }

    if (dom.sousTotal) {
      tableRows.push(new TableRow({
        children: courseToDocxCells(dom.sousTotal, t.length, borderAll, true),
      }))
    }
  }

  // Maxima row
  if (struct.maxima) {
    tableRows.push(new TableRow({
      children: courseToDocxCells(struct.maxima.row, t.length, borderAll, false, true),
    }))
  }

  const table = new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '1E3A5F' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '1E3A5F' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '1E3A5F' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '1E3A5F' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '1E3A5F' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '1E3A5F' },
    },
  })

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [...headerParagraphs, table],
      },
    ],
  })

  const blob = await Packer.toBuffer(doc)
  return Buffer.from(blob)
}

function courseToDocxCells(
  c: BulletinStructure['domaines'][number]['sousDomaines'][number]['courses'][number],
  trimesterCount: number,
  borders: any,
  isSubtotal = false,
  isMaxima = false
): TableCell[] {
  const fill = isMaxima ? 'C9A227' : isSubtotal ? 'E2E8F0' : undefined
  const textColor = isMaxima ? 'FFFFFF' : '0B1A2E'
  const bold = isSubtotal || isMaxima

  const makeCell = (text: string | number, align: any = AlignmentType.CENTER) => new TableCell({
    shading: fill ? { type: ShadingType.SOLID, color: fill, fill } : undefined,
    borders,
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({
        text: String(text ?? ''),
        bold, color: textColor, size: 14,
      })],
    })],
  })

  const cells: TableCell[] = [makeCell(c.nom, AlignmentType.LEFT)]
  cells.push(makeCell(c.maxPer))
  cells.push(makeCell(c.p1))
  cells.push(makeCell(c.p2))
  cells.push(makeCell(c.maxEX1))
  cells.push(makeCell(c.ptsObt1))
  cells.push(makeCell(c.maxTrim1))
  cells.push(makeCell(c.trim1Pts))
  if (trimesterCount >= 2) {
    cells.push(makeCell(c.p3))
    cells.push(makeCell(c.p4))
    cells.push(makeCell(c.maxEX2))
    cells.push(makeCell(c.ptsObt2))
    cells.push(makeCell(c.maxTrim2))
    cells.push(makeCell(c.trim2Pts))
  }
  if (trimesterCount >= 3) {
    cells.push(makeCell(c.p5 || ''))
    cells.push(makeCell(c.p6 || ''))
    cells.push(makeCell(c.maxEX3 || ''))
    cells.push(makeCell(c.ptsObt3 || ''))
    cells.push(makeCell(c.maxTrim3 || ''))
    cells.push(makeCell(c.trim3Pts || ''))
  }
  return cells
}
