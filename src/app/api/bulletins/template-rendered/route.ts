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
    const tmpId = randomUUID()
    const tmpDir = `/tmp/bulletin-render-${tmpId}`
    await mkdir(tmpDir, { recursive: true })
    try {
      const inputPath = join(tmpDir, `${baseName}.xlsx`)
      await writeFile(inputPath, result.buffer)

      // soffice --headless --convert-to pdf --outdir <dir> <input>
      const sofficeCmd = `soffice --headless --convert-to pdf --outdir ${tmpDir} ${inputPath}`
      // Timeout 60s — la conversion ne devrait pas prendre plus de quelques secondes
      await execAsync(sofficeCmd, { timeout: 60000 })

      const outputPath = join(tmpDir, `${baseName}.pdf`)
      const outputBuffer = await readFile(outputPath)

      const headers = new Headers()
      headers.set('Content-Type', 'application/pdf')
      headers.set('Content-Disposition', `attachment; filename="${baseName}.pdf"`)
      return new NextResponse(new Uint8Array(outputBuffer), { headers })
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


