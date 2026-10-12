import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

/**
 * GET /api/settings/bulletin-templates/[id]
 * Récupère un modèle de bulletin avec sa structure complète.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const institutionId = await getInstitutionIdWithFallback(request)

    const template = await db.bulletinTemplate.findFirst({
      where: { id, institutionId },
    })

    if (!template) {
      return NextResponse.json({ error: 'Modèle non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('[bulletin-templates] GET [id] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PUT /api/settings/bulletin-templates/[id]
 * Met à jour les métadonnées d'un modèle (name, level) OU la structure
 * (envoyer `structure` dans le body pour mettre à jour les données parsées).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const institutionId = await getInstitutionIdWithFallback(request)

    const template = await db.bulletinTemplate.findFirst({
      where: { id, institutionId },
    })

    if (!template) {
      return NextResponse.json({ error: 'Modèle non trouvé' }, { status: 404 })
    }

    const body = await request.json()

    // Mettre à jour la structure (modification du bulletin directement)
    if (body.structure) {
      const updated = await db.bulletinTemplate.update({
        where: { id },
        data: { structure: body.structure as any },
      })
      return NextResponse.json({ template: updated })
    }

    // Mettre à jour name/level
    const data: { name?: string; level?: number } = {}
    if (body.name) data.name = String(body.name)
    if (body.level) data.level = parseInt(body.level, 10) || template.level

    const updated = await db.bulletinTemplate.update({
      where: { id },
      data,
    })

    return NextResponse.json({ template: updated })
  } catch (error) {
    console.error('[bulletin-templates] PUT [id] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/bulletin-templates/[id]
 * Supprime un modèle de bulletin (et son MediaFile associé).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const institutionId = await getInstitutionIdWithFallback(request)

    const template = await db.bulletinTemplate.findFirst({
      where: { id, institutionId },
    })

    if (!template) {
      return NextResponse.json({ error: 'Modèle non trouvé' }, { status: 404 })
    }

    // Supprimer le MediaFile associé
    if (template.mediaFileId) {
      await db.mediaFile.deleteMany({ where: { id: template.mediaFileId } }).catch(() => {})
    }

    await db.bulletinTemplate.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[bulletin-templates] DELETE [id] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
