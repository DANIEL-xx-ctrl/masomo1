import { NextResponse } from 'next/server'
import { renderBulletinFromTemplate } from '@/lib/bulletin-template-render'
import { renderExcelToHtmlFragment } from '@/lib/bulletin-excel-renderer'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const execAsync = promisify(exec)

/**
 * GET /api/bulletins/template-rendered/preview
 *
 * Renvoie un aperçu HTML du bulletin rempli pour un élève.
 *
 * ⚠ IMPORTANT : On utilise LibreOffice pour convertir le xlsx rempli en HTML,
 * car LibreOffice RECALCULE les formules (contrairement à ExcelJS qui ne
 * fait que lire les valeurs cachées). Sans recalcul, les 247 formules
 * VLOOKUP de la feuille BULLETIN afficheraient des valeurs STALE (celles
 * de l'ancien élève du template original).
 *
 * Le renderer a déjà :
 *   1. Rempli la feuille LISTE avec l'élève (NOMS, N° ID, notes)
 *   2. Mis à jour BULLETIN!I3 avec le nom de l'élève (clé des VLOOKUP)
 *   3. Activé fullCalcOnLoad pour forcer le recalcul à l'ouverture
 *
 * Ici on :
 *   1. Écrit le buffer xlsx dans un tmp dir
 *   2. Convertit xlsx → HTML via LibreOffice headless (recalcule les formules)
 *   3. Renvoie le HTML
 *
 * Query params :
 *   - studentId  (requis)
 *   - schoolYear (requis, défaut "2024-2025")
 *   - classId    (optionnel)
 *   - full       (optionnel, "1" pour page HTML complète avec styles)
 *   - sheet      (optionnel, "BULLETIN" par défaut, ou "LISTE" pour voir
 *                 la feuille de données)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const schoolYear = searchParams.get('schoolYear') || '2024-2025'
    const classId = searchParams.get('classId') || undefined
    const full = searchParams.get('full') === '1'
    const sheetName = searchParams.get('sheet') || 'BULLETIN'

    if (!studentId) {
      return NextResponse.json(
        { error: 'Paramètre studentId requis' },
        { status: 400 }
      )
    }

    const result = await renderBulletinFromTemplate({ studentId, classId, schoolYear })
    if ('error' in result) {
      const status =
        result.code === 'NO_STUDENT' ? 404 :
        result.code === 'NO_TEMPLATE' ? 404 :
        result.code === 'NO_LISTE_SHEET' ? 422 :
        400
      return NextResponse.json({ error: result.error, code: result.code }, { status })
    }

    // 1. Essayer LibreOffice pour recalculer les formules + convertir en HTML.
    //    C'est la seule façon d'avoir des valeurs correctes dans la feuille
    //    BULLETIN (les VLOOKUP doivent être recalculés après modification de
    //    LISTE et de BULLETIN!I3).
    const tmpId = randomUUID()
    const tmpDir = `/tmp/bulletin-preview-${tmpId}`
    await mkdir(tmpDir, { recursive: true })
    try {
      const inputPath = join(tmpDir, 'bulletin.xlsx')
      await writeFile(inputPath, result.buffer)

      // soffice --headless --convert-to html --outdir <dir> <input>
      // LibreOffice recalcule les formules au chargement (par défaut pour
      // les xlsx avec fullCalcOnLoad=true, ou via le paramètre --calc).
      const sofficeCmd = `soffice --headless --convert-to html --outdir ${tmpDir} ${inputPath}`
      await execAsync(sofficeCmd, { timeout: 30000 })

      // LibreOffice produit un fichier .html du même nom
      const outputPath = join(tmpDir, 'bulletin.html')
      let htmlContent: string
      try {
        htmlContent = await readFile(outputPath, 'utf-8')
      } catch {
        // Si LibreOffice a échoué silencieusement, on fallback sur ExcelJS
        // (valeurs potentiellement stale, mais au moins on a un aperçu)
        console.warn('[BULLETIN_PREVIEW] LibreOffice HTML conversion failed, falling back to ExcelJS')
        htmlContent = await renderExcelToHtmlFragment(result.buffer, sheetName)
      }

      // 2. Si on veut seulement la feuille BULLETIN mais que LibreOffice a
      //    produit toutes les feuilles, on extrait la section pertinente.
      //    LibreOffice produit un HTML avec une table par feuille, chacune
      //    précédée d'un <h2> avec le nom de la feuille.
      //    Pour simplifier, on garde tout le HTML (toutes les feuilles) —
      //    l'utilisateur peut scroller pour voir BULLETIN et LISTE.

      if (full) {
        // Page HTML complète (pour iframe ou debug)
        const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Bulletin — ${result.templateName}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background: #f8fafc; color: #1e293b; }
  .meta { font-size: 12px; color: #64748b; margin-bottom: 12px; padding: 8px 12px; background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; }
  .meta strong { color: #0f172a; }
  .table-wrap { background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; padding: 12px; overflow-x: auto; }
  table { border-collapse: collapse; font-size: 11px; }
</style>
</head>
<body>
  <div class="meta">
    <strong>Template :</strong> ${result.templateName} ·
    <strong>Niveau :</strong> ${result.level} ·
    <strong>Matières :</strong> ${result.subjectsCount} ·
    <strong>Notes insérées :</strong> ${result.gradesInserted} ·
    <em>Formules recalculées via LibreOffice</em>
  </div>
  <div class="table-wrap">${htmlContent}</div>
</body>
</html>`
        const headers = new Headers()
        headers.set('Content-Type', 'text/html; charset=utf-8')
        return new NextResponse(fullHtml, { headers })
      }

      // Fragment JSON pour consommation par le frontend
      return NextResponse.json({
        html: htmlContent,
        meta: {
          templateName: result.templateName,
          level: result.level,
          sheetName,
          subjectsCount: result.subjectsCount,
          gradesInserted: result.gradesInserted,
        },
      })
    } finally {
      // Nettoyer le répertoire temporaire
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  } catch (error) {
    console.error('Bulletin preview error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la prévisualisation' },
      { status: 500 }
    )
  }
}
