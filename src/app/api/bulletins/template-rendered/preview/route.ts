import { NextResponse } from 'next/server'
import { renderBulletinFromTemplate } from '@/lib/bulletin-template-render'
import { renderExcelToHtmlFragment, renderExcelToHtml } from '@/lib/bulletin-excel-renderer'

/**
 * GET /api/bulletins/template-rendered/preview
 *
 * Renvoie un aperçu HTML du bulletin rempli pour un élève.
 *
 * ⚠ IMPORTANT : On utilise ExcelJS (pas LibreOffice) pour convertir le xlsx
 * en HTML. C'est volontaire pour que ça fonctionne sur Vercel où LibreOffice
 * (soffice) n'est PAS installé.
 *
 * Le renderer a déjà recalculé les formules VLOOKUP en JavaScript (fonction
 * `recalculateBulletinFormulas`) — donc les valeurs affichées dans le HTML
 * sont correctes même sans recalcul par LibreOffice.
 *
 * Le renderer a déjà :
 *   1. Rempli la feuille LISTE avec l'élève (NOMS, N° ID, notes)
 *   2. Mis à jour BULLETIN!I3 avec le nom de l'élève (clé des VLOOKUP)
 *   3. Recalculé les 247 VLOOKUP en JS (valeurs `.result` à jour)
 *   4. Activé fullCalcOnLoad pour Excel/LibreOffice desktop
 *
 * Query params :
 *   - studentId  (requis)
 *   - schoolYear (requis, défaut "2024-2025")
 *   - classId    (optionnel)
 *   - full       (optionnel, "1" pour page HTML complète avec styles)
 *   - sheet      (optionnel, "BULLETIN" par défaut, ou "LISTE")
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

    // Convertir le xlsx en HTML avec ExcelJS (pas LibreOffice — fonctionne
    // sur Vercel). Le renderer a déjà recalculé les VLOOKUP, donc les valeurs
    // affichées sont correctes.
    //
    // On rend la feuille BULLETIN par défaut (le bulletin visuel avec les
    // calculs), pas la feuille LISTE (qui est juste la grille de données).
    let htmlFragment: string
    try {
      htmlFragment = await renderExcelToHtmlFragment(result.buffer, sheetName)
    } catch (renderErr) {
      console.error('[BULLETIN_PREVIEW] ExcelJS render failed for sheet', sheetName, ':', renderErr)
      // Fallback : essayer la feuille LISTE si BULLETIN échoue
      try {
        htmlFragment = await renderExcelToHtmlFragment(result.buffer, result.sheetName)
      } catch (fallbackErr) {
        console.error('[BULLETIN_PREVIEW] Fallback render also failed:', fallbackErr)
        return NextResponse.json(
          { error: 'Impossible de générer l\'aperçu HTML du bulletin' },
          { status: 500 }
        )
      }
    }

    if (full) {
      // Page HTML complète (pour iframe ou debug)
      const fullHtml = await renderExcelToHtml(result.buffer, sheetName)
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
        sheetName,
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
