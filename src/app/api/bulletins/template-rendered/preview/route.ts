import { NextResponse } from 'next/server'
import { renderBulletinFromTemplate } from '@/lib/bulletin-template-render'
import { renderExcelToHtmlFragment } from '@/lib/bulletin-excel-renderer'

/**
 * GET /api/bulletins/template-rendered/preview
 *
 * Renvoie un aperçu HTML (fragment, sans <html>/<body>) du bulletin
 * rempli pour un élève. Utilisé par la page Bulletin pour afficher
 * le résultat avant export.
 *
 * Query params :
 *   - studentId  (requis)
 *   - schoolYear (requis, défaut "2024-2025")
 *   - classId    (optionnel)
 *   - full       (optionnel, "1" pour page HTML complète avec styles)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const schoolYear = searchParams.get('schoolYear') || '2024-2025'
    const classId = searchParams.get('classId') || undefined
    const full = searchParams.get('full') === '1'

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

    // Convertir le xlsx en HTML fragment — renderExcelToHtmlFragment renvoie
    // un <table> avec styles inline (couleurs, bordures, merges) qui
    // reproduit fidèlement la feuille LISTE du template.
    const htmlFragment = await renderExcelToHtmlFragment(result.buffer, result.sheetName)

    if (full) {
      // Page HTML complète (pour iframe ou debug)
      const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Bulletin — feuille ${result.sheetName}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background: #f8fafc; color: #1e293b; }
  .meta { font-size: 12px; color: #64748b; margin-bottom: 12px; padding: 8px 12px; background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; }
  .meta strong { color: #0f172a; }
  .table-wrap { background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; padding: 12px; overflow-x: auto; }
  table { border-collapse: collapse; font-size: 11px; }
  table.bulletin { width: 100%; }
</style>
</head>
<body>
  <div class="meta">
    <strong>Template :</strong> ${result.templateName} ·
    <strong>Niveau :</strong> ${result.level} ·
    <strong>Feuille :</strong> ${result.sheetName} ·
    <strong>Matières :</strong> ${result.subjectsCount} ·
    <strong>Notes insérées :</strong> ${result.gradesInserted}
  </div>
  <div class="table-wrap">${htmlFragment}</div>
</body>
</html>`
      const headers = new Headers()
      headers.set('Content-Type', 'text/html; charset=utf-8')
      return new NextResponse(fullHtml, { headers })
    }

    // Fragment JSON pour consommation par le frontend
    return NextResponse.json({
      html: htmlFragment,
      meta: {
        templateName: result.templateName,
        level: result.level,
        sheetName: result.sheetName,
        subjectsCount: result.subjectsCount,
        gradesInserted: result.gradesInserted,
      },
    })
  } catch (error) {
    console.error('Bulletin preview error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la prévisualisation' },
      { status: 500 }
    )
  }
}
