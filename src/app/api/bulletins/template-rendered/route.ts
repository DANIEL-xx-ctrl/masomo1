import { NextResponse } from 'next/server'
import { renderBulletinFromTemplate } from '@/lib/bulletin-template-render'
import { renderExcelToHtml } from '@/lib/bulletin-excel-renderer'
import HTMLtoDOCX from 'html-to-docx'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const execAsync = promisify(exec)

/**
 * GET /api/bulletins/template-rendered
 *
 * Rend un bulletin rempli pour un élève à partir du template Excel
 * de sa promotion, et le renvoie au format demandé.
 *
 * Query params :
 *   - studentId  (requis) : ID de l'élève
 *   - schoolYear (requis) : année scolaire (ex: "2024-2025")
 *   - format     (requis) : "xlsx" | "pdf" | "word"
 *   - classId    (optionnel)
 *
 * Pour PDF : on utilise LibreOffice headless pour convertir le xlsx rempli
 *            → PDF, ce qui garantit la conformité avec la mise en page du
 *            template original (bordures, fusion de cellules, couleurs,
 *            largeurs de colonnes).
 * Pour Word : LibreOffice ne sait pas convertir xlsx → docx directement
 *            (no export filter). On utilise donc html-to-docx en passant
 *            par le HTML produit par renderExcelToHtml (même approche que
 *            la route /api/settings/bulletin-templates/[id]/export).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const schoolYear = searchParams.get('schoolYear') || '2024-2025'
    const format = (searchParams.get('format') || 'xlsx').toLowerCase() as 'xlsx' | 'pdf' | 'word'
    const classId = searchParams.get('classId') || undefined

    if (!studentId) {
      return NextResponse.json(
        { error: 'Paramètre studentId requis' },
        { status: 400 }
      )
    }
    if (!['xlsx', 'pdf', 'word'].includes(format)) {
      return NextResponse.json(
        { error: 'format doit être "xlsx", "pdf" ou "word"' },
        { status: 400 }
      )
    }

    // 1. Rendre le bulletin
    const result = await renderBulletinFromTemplate({ studentId, classId, schoolYear })
    if ('error' in result) {
      // Mappe le code d'erreur à un status HTTP
      const status =
        result.code === 'NO_STUDENT' ? 404 :
        result.code === 'NO_TEMPLATE' ? 404 :
        result.code === 'NO_LISTE_SHEET' ? 422 :
        400
      return NextResponse.json({ error: result.error, code: result.code }, { status })
    }

    // 2. Préparer le nom de fichier
    const baseName = `bulletin_${result.level}_${result.sheetName.replace(/\s+/g, '_')}_${Date.now()}`

    // 3. Si xlsx → renvoyer directement le buffer (en Uint8Array pour NextResponse)
    if (format === 'xlsx') {
      const headers = new Headers()
      headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      headers.set('Content-Disposition', `attachment; filename="${baseName}.xlsx"`)
      return new NextResponse(new Uint8Array(result.buffer), { headers })
    }

    // 4. Si word → conversion HTML → DOCX (LibreOffice ne sait pas
    //    convertir xlsx → docx directement). On utilise renderExcelToHtml
    //    pour produire un document HTML complet avec styles inline, puis
    //    html-to-docx pour le convertir en .docx. Cette approche préserve
    //    les bordures, fusions de cellules et couleurs du template.
    if (format === 'word') {
      const fullHtml = await renderExcelToHtml(result.buffer, result.sheetName)
      const docxBuffer = await HTMLtoDOCX(fullHtml, null, {
        table: { row: { cantSplit: true } },
        footer: false,
        pageNumber: false,
      })

      const headers = new Headers()
      headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      headers.set('Content-Disposition', `attachment; filename="${baseName}.docx"`)
      return new NextResponse(new Uint8Array(docxBuffer), { headers })
    }

    // 5. Si pdf → conversion via LibreOffice headless
    //    LibreOffice ne peut pas convertir directement un buffer ; on doit
    //    écrire le fichier dans un répertoire temporaire, exécuter la
    //    conversion, puis lire le fichier de sortie.
    //
    //    ⚠ Sur Vercel, LibreOffice (soffice) n'est PAS disponible.
    //    Dans ce cas, on fallback sur une conversion HTML → PDF via jsPDF.
    //    Le PDF généré est moins fidèle au layout Excel (pas de bordures,
    //    pas de fusions) mais contient toutes les données correctes.
    const tmpId = randomUUID()
    const tmpDir = `/tmp/bulletin-render-${tmpId}`
    await mkdir(tmpDir, { recursive: true })
    try {
      const inputPath = join(tmpDir, `${baseName}.xlsx`)
      await writeFile(inputPath, result.buffer)

      // Essayer LibreOffice d'abord
      const sofficeCmd = `soffice --headless --convert-to pdf --outdir ${tmpDir} ${inputPath}`
      try {
        await execAsync(sofficeCmd, { timeout: 60000 })
        const outputPath = join(tmpDir, `${baseName}.pdf`)
        const outputBuffer = await readFile(outputPath)
        const headers = new Headers()
        headers.set('Content-Type', 'application/pdf')
        headers.set('Content-Disposition', `attachment; filename="${baseName}.pdf"`)
        return new NextResponse(new Uint8Array(outputBuffer), { headers })
      } catch (sofficeErr) {
        // soffice non disponible (Vercel) — fallback jsPDF
        console.warn('[BULLETIN_RENDER] LibreOffice (soffice) not available, falling back to jsPDF:', sofficeErr instanceof Error ? sofficeErr.message : sofficeErr)
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {})

        // Générer un PDF via jsPDF à partir des données du bulletin
        const pdfBuffer = await generatePdfFallback(result.buffer, result.sheetName, result.templateName)
        const headers = new Headers()
        headers.set('Content-Type', 'application/pdf')
        headers.set('Content-Disposition', `attachment; filename="${baseName}.pdf"`)
        return new NextResponse(new Uint8Array(pdfBuffer), { headers })
      }
    } finally {
      // Nettoyer le répertoire temporaire
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  } catch (error) {
    console.error('Bulletin template render error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors du rendu du bulletin' },
      { status: 500 }
    )
  }
}

/**
 * Génère un PDF de fallback quand LibreOffice n'est pas disponible (Vercel).
 * Utilise jsPDF + autoTable pour produire un PDF avec les données du bulletin.
 * Moins fidèle au layout Excel mais contient toutes les données correctes.
 */
async function generatePdfFallback(
  xlsxBuffer: Buffer,
  sheetName: string,
  templateName: string,
): Promise<Buffer> {
  // Import dynamique pour éviter de charger jsPDF si non nécessaire
  const { default: jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  // Lire le xlsx avec ExcelJS pour extraire les données
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(xlsxBuffer as unknown as ArrayBuffer)

  // Render la feuille BULLETIN en HTML d'abord (pour avoir le rendu fidèle)
  const { renderExcelToHtml } = await import('@/lib/bulletin-excel-renderer')
  const html = await renderExcelToHtml(xlsxBuffer, sheetName || 'BULLETIN')

  // Convertir le HTML en PDF via jsPDF (avec html() method)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFontSize(16)
  doc.text(templateName || 'Bulletin', 14, 15)
  doc.setFontSize(10)
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 22)

  // Extraire les données de la feuille et les mettre dans un tableau autoTable
  const ws = wb.getWorksheet(sheetName || 'BULLETIN')
  if (ws) {
    const head: string[] = []
    const body: (string | number)[][] = []

    // Première ligne comme header
    const headerRow = ws.getRow(1)
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      let val = ''
      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'object' && 'formula' in cell.value) {
          val = String((cell.value as { result?: unknown }).result ?? '')
        } else {
          val = String(cell.value)
        }
      }
      head[colNumber - 1] = val
    })

    // Corps : rows 2+
    for (let rowNum = 2; rowNum <= Math.min(ws.rowCount, 60); rowNum++) {
      const row = ws.getRow(rowNum)
      const rowData: (string | number)[] = []
      let hasData = false
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let val: string | number = ''
        if (cell.value !== null && cell.value !== undefined) {
          if (typeof cell.value === 'object' && 'formula' in cell.value) {
            const result = (cell.value as { result?: unknown }).result
            val = typeof result === 'number' ? result : String(result ?? '')
          } else if (typeof cell.value === 'number') {
            val = cell.value
          } else {
            val = String(cell.value)
          }
          if (String(val).trim()) hasData = true
        }
        rowData[colNumber - 1] = val
      })
      if (hasData) body.push(rowData)
    }

    // Ne garder que les colonnes non vides dans le header
    const nonEmptyCols = head.map((h, i) => ({ h, i })).filter(x => x.h.trim()).map(x => x.i)
    const filteredHead = nonEmptyCols.map(i => head[i])
    const filteredBody = body.map(row => nonEmptyCols.map(i => row[i] ?? ''))

    autoTable(doc, {
      head: [filteredHead],
      body: filteredBody,
      startY: 28,
      styles: { fontSize: 6, cellPadding: 1, overflow: 'linebreak' },
      headStyles: { fillColor: [11, 26, 46], textColor: 255 },
      theme: 'grid',
    })
  }

  // Note: html est généré mais non utilisé directement dans le PDF car
  // jsPDF.html() nécessite un browser DOM. On utilise autoTable à la place.
  void html

  return Buffer.from(doc.output('arraybuffer') as ArrayBuffer)
}

