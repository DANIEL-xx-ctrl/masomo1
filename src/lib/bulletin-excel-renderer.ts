/**
 * Bulletin Excel HTML Renderer
 *
 * Génère un HTML fidèle au fichier Excel original en lisant :
 *   - Les styles de cellules (couleurs de fond, polices, bordures)
 *   - Les fusions de cellules (merges)
 *   - Les largeurs de colonnes et hauteurs de lignes
 *   - Le contenu des cellules
 *
 * Utilisé pour :
 *   - La visualisation dans l'application (bulletin tel qu'il apparaît dans Excel)
 *   - L'export PDF (via les styles extraits)
 *   - L'export Word (via html-to-docx)
 */

import ExcelJS from 'exceljs'

export interface RenderOptions {
  /** Si true, inclut les boutons/imprimables CSS. Défaut: false (juste le tableau) */
  fullPage?: boolean
}

/**
 * Convertit une adresse de colonne (A, B, AA) en numéro (1, 2, 27).
 */
function colLetterToNumber(letter: string): number {
  let result = 0
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64)
  }
  return result
}

/**
 * Parse une range "A49:V49" → { top, left, bottom, right }
 */
function parseRange(range: string): { top: number; left: number; bottom: number; right: number } | null {
  const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
  if (!m) return null
  return {
    top: parseInt(m[2], 10),
    left: colLetterToNumber(m[1]),
    bottom: parseInt(m[4], 10),
    right: colLetterToNumber(m[3]),
  }
}

/**
 * Lit un fichier Excel (buffer) et génère un HTML qui reproduit fidèlement
 * l'apparence du fichier dans Excel.
 */
export async function renderExcelToHtml(
  buffer: Buffer,
  sheetName?: string,
  _options: RenderOptions = {}
): Promise<string> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as any)

  // Choisir la feuille : BULLETIN si dispo, sinon la première
  const ws =
    sheetName && wb.getWorksheet(sheetName)
      ? wb.getWorksheet(sheetName)!
      : wb.worksheets[0]

  if (!ws) {
    return '<p>Aucune feuille trouvée dans le fichier Excel.</p>'
  }

  // ---- Collecter les merges ----
  type Merge = { top: number; left: number; bottom: number; right: number }
  const merges: Merge[] = []
  const coveredCells = new Set<string>()
  const mergeMap = new Map<string, { rowspan: number; colspan: number }>()

  if (ws.model?.merges) {
    for (const m of ws.model.merges) {
      if (typeof m === 'string') {
        const parsed = parseRange(m)
        if (parsed) {
          merges.push(parsed)
          mergeMap.set(`${parsed.top}:${parsed.left}`, {
            rowspan: parsed.bottom - parsed.top + 1,
            colspan: parsed.right - parsed.left + 1,
          })
          for (let r = parsed.top; r <= parsed.bottom; r++) {
            for (let c = parsed.left; c <= parsed.right; c++) {
              if (r !== parsed.top || c !== parsed.left) {
                coveredCells.add(`${r}:${c}`)
              }
            }
          }
        }
      }
    }
  }

  // ---- Largeurs de colonnes ----
  const colWidths: number[] = []
  for (let c = 1; c <= ws.columnCount; c++) {
    const col = ws.getColumn(c)
    colWidths.push(col.width || 8)
  }

  // ---- Construire le HTML du tableau ----
  const rows: string[] = []

  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    if (!row) continue
    const rowHeight = row.height || 18
    const cells: string[] = []

    for (let c = 1; c <= ws.columnCount; c++) {
      if (coveredCells.has(`${r}:${c}`)) continue

      const cell = row.getCell(c)
      const merge = mergeMap.get(`${r}:${c}`)

      // Style de la cellule
      const styleParts: string[] = []

      // Bordures
      const borders = (cell.style?.border || {}) as any
      for (const side of ['top', 'bottom', 'left', 'right']) {
        const b = borders[side]
        if (b && b.style) {
          const color = b.color?.argb ? '#' + b.color.argb.substring(2) : '#1E3A5F'
          const borderWidth = b.style === 'thin' ? '1px' : b.style === 'medium' ? '2px' : '1px'
          styleParts.push(
            `border-${side}: ${borderWidth} ${b.style === 'double' ? 'double' : 'solid'} ${color}`
          )
        }
      }

      // Fond
      const fill = cell.style?.fill as any
      if (
        fill &&
        fill.type === 'pattern' &&
        fill.pattern === 'solid' &&
        fill.fgColor?.argb &&
        fill.fgColor.argb !== 'FFFFFFFF' &&
        fill.fgColor.argb !== '00000000'
      ) {
        const argb = fill.fgColor.argb
        styleParts.push(`background-color: #${argb.substring(2)}`)
      }

      // Police
      const font = cell.style?.font as any
      if (font) {
        if (font.bold) styleParts.push('font-weight: bold')
        if (font.italic) styleParts.push('font-style: italic')
        if (font.size) styleParts.push(`font-size: ${Math.min(font.size, 12)}pt`)
        if (font.color?.argb && font.color.argb !== 'FF000000') {
          styleParts.push(`color: #${font.color.argb.substring(2)}`)
        }
        if (font.name) styleParts.push(`font-family: '${font.name}', sans-serif`)
      }

      // Alignement
      const align = cell.style?.alignment as any
      if (align) {
        if (align.horizontal) styleParts.push(`text-align: ${align.horizontal}`)
        if (align.vertical) styleParts.push(`vertical-align: ${align.vertical}`)
        if (align.wrapText) styleParts.push('white-space: normal')
      }

      // Padding par défaut
      styleParts.push('padding: 2px 4px')

      // Attributs rowspan/colspan
      const mergeAttrs = merge
        ? ` rowspan="${merge.rowspan}" colspan="${merge.colspan}"`
        : ''

      // Contenu de la cellule
      let content = ''
      if (cell.value !== null && cell.value !== undefined) {
        const v = cell.value as any
        if (typeof v === 'object') {
          if (v.text) content = escapeHtml(String(v.text))
          else if (v.richText) {
            content = v.richText.map((rt: any) => escapeHtml(String(rt.text))).join('')
          } else if (v.result !== undefined) {
            content = escapeHtml(String(v.result))
          } else if (v.hyperlink) {
            content = escapeHtml(String(v.text || v.hyperlink))
          } else {
            content = ''
          }
        } else {
          content = escapeHtml(String(v))
        }
      }

      const styleAttr = styleParts.length > 0 ? ` style="${styleParts.join('; ')}"` : ''
      cells.push(`<td${mergeAttrs}${styleAttr}>${content}</td>`)
    }

    if (cells.length > 0) {
      rows.push(`<tr style="height: ${rowHeight}px">${cells.join('')}</tr>`)
    }
  }

  // ---- Construire les <col> ----
  const colsHtml = colWidths
    .map((w, i) => `<col data-col="${i + 1}" style="width: ${Math.round(w * 7.5)}px">`)
    .join('')

  // ---- CSS global ----
  const css = `
    <style>
      body {
        margin: 0;
        padding: 16px;
        background: #fff;
        font-family: 'Calibri', 'Segoe UI', sans-serif;
        font-size: 10pt;
        color: #1a1a1a;
      }
      table.bulletin {
        border-collapse: collapse;
        table-layout: fixed;
        width: auto;
        max-width: 100%;
        box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      }
      table.bulletin td {
        border: 1px solid #d0d7de;
        padding: 2px 4px;
        font-family: 'Calibri', 'Segoe UI', sans-serif;
        font-size: 10pt;
        overflow: hidden;
        word-wrap: break-word;
        color: #1a1a1a;
      }
      table.bulletin td:empty::before {
        content: '\\00a0';
      }
      @media print {
        body { padding: 0; }
        table.bulletin { box-shadow: none; }
      }
    </style>
  `

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bulletin</title>
  ${css}
</head>
<body>
  <table class="bulletin">
    <colgroup>${colsHtml}</colgroup>
    <tbody>
      ${rows.join('\n')}
    </tbody>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Version simplifiée pour utilisation dans une div (sans <html>/<body>).
 * Utilisée pour l'affichage inline dans l'app.
 */
export async function renderExcelToHtmlFragment(
  buffer: Buffer,
  sheetName?: string
): Promise<string> {
  const fullHtml = await renderExcelToHtml(buffer, sheetName)
  const match = fullHtml.match(/<table[\s\S]*<\/table>/)
  return match ? match[0] : '<p>Erreur de rendu</p>'
}

/**
 * Extrait les données structurées (cellule par cellule) avec leurs styles.
 * Utilisé par l'export PDF pour générer un PDF fidèle.
 */
export interface ExcelCellData {
  content: string
  row: number
  col: number
  rowspan: number
  colspan: number
  fillColor?: [number, number, number]
  textColor?: [number, number, number]
  bold?: boolean
  italic?: boolean
  fontSize?: number
  halign?: 'left' | 'center' | 'right'
}

export async function extractExcelData(
  buffer: Buffer,
  sheetName?: string
): Promise<{ cells: ExcelCellData[]; rowCount: number; colCount: number }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as any)

  const ws =
    sheetName && wb.getWorksheet(sheetName)
      ? wb.getWorksheet(sheetName)!
      : wb.worksheets[0]

  if (!ws) {
    return { cells: [], rowCount: 0, colCount: 0 }
  }

  // Collecter les merges
  const coveredCells = new Set<string>()
  const mergeMap = new Map<string, { rowspan: number; colspan: number }>()

  if (ws.model?.merges) {
    for (const m of ws.model.merges) {
      if (typeof m === 'string') {
        const parsed = parseRange(m)
        if (parsed) {
          mergeMap.set(`${parsed.top}:${parsed.left}`, {
            rowspan: parsed.bottom - parsed.top + 1,
            colspan: parsed.right - parsed.left + 1,
          })
          for (let r = parsed.top; r <= parsed.bottom; r++) {
            for (let c = parsed.left; c <= parsed.right; c++) {
              if (r !== parsed.top || c !== parsed.left) {
                coveredCells.add(`${r}:${c}`)
              }
            }
          }
        }
      }
    }
  }

  const cells: ExcelCellData[] = []

  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    if (!row) continue

    for (let c = 1; c <= ws.columnCount; c++) {
      if (coveredCells.has(`${r}:${c}`)) continue

      const cell = row.getCell(c)
      const merge = mergeMap.get(`${r}:${c}`)

      let content = ''
      if (cell.value !== null && cell.value !== undefined) {
        const v = cell.value as any
        if (typeof v === 'object') {
          if (v.text) content = String(v.text)
          else if (v.richText) content = v.richText.map((rt: any) => String(rt.text)).join('')
          else if (v.result !== undefined) content = String(v.result)
          else if (v.hyperlink) content = String(v.text || v.hyperlink)
        } else {
          content = String(v)
        }
      }

      const data: ExcelCellData = {
        content: content.trim(),
        row: r,
        col: c,
        rowspan: merge?.rowspan || 1,
        colspan: merge?.colspan || 1,
      }

      const fill = cell.style?.fill as any
      if (
        fill &&
        fill.type === 'pattern' &&
        fill.pattern === 'solid' &&
        fill.fgColor?.argb &&
        fill.fgColor.argb !== 'FFFFFFFF' &&
        fill.fgColor.argb !== '00000000'
      ) {
        const argb = fill.fgColor.argb
        data.fillColor = [
          parseInt(argb.substring(2, 4), 16),
          parseInt(argb.substring(4, 6), 16),
          parseInt(argb.substring(6, 8), 16),
        ]
      }

      const font = cell.style?.font as any
      if (font) {
        if (font.bold) data.bold = true
        if (font.italic) data.italic = true
        if (font.size) data.fontSize = Math.min(font.size, 11)
        if (font.color?.argb && font.color.argb !== 'FF000000') {
          const argb = font.color.argb
          data.textColor = [
            parseInt(argb.substring(2, 4), 16),
            parseInt(argb.substring(4, 6), 16),
            parseInt(argb.substring(6, 8), 16),
          ]
        }
      }

      const align = cell.style?.alignment as any
      if (align?.horizontal) {
        data.halign = align.horizontal as 'left' | 'center' | 'right'
      }

      cells.push(data)
    }
  }

  return { cells, rowCount: ws.rowCount, colCount: ws.columnCount }
}
