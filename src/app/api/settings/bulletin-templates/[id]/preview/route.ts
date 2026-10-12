import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'
import { renderExcelToHtml, renderExcelToHtmlFragment } from '@/lib/bulletin-excel-renderer'

/**
 * GET /api/settings/bulletin-templates/[id]/preview
 * Retourne le bulletin rendu en HTML fidèle à l'Excel original.
 *
 * Query params:
 *   - format=full   → page HTML complète (avec <html>, <head>, <style>)
 *   - format=fragment → juste le <table> (pour intégration inline)
 *   - sheet=BULLETIN → nom de la feuille à rendre (défaut: BULLETIN ou 1ère)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const institutionId = await getInstitutionIdWithFallback(request)
    const format = (request.nextUrl.searchParams.get('format') || 'full').toLowerCase()
    const sheet = request.nextUrl.searchParams.get('sheet') || undefined

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

    // Récupérer le fichier Excel original
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

    const buffer = Buffer.from(mediaFile.data, 'base64')

    if (format === 'fragment') {
      const html = await renderExcelToHtmlFragment(buffer, sheet)
      return new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const html = await renderExcelToHtml(buffer, sheet)
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('[bulletin-templates] preview error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

