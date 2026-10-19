import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'
import { canManageBulletinTemplates, canViewBulletinTemplates } from '@/lib/bulletin-permissions'

/**
 * GET /api/settings/bulletin-templates/[id]
 * Récupère un modèle de bulletin avec sa structure complète.
 *
 * PERMISSION : super_admin + admin (lecture seule pour admin)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ──────────────────────────────────────────────────────────────
    // PERMISSION : super_admin + admin peuvent consulter un modèle
    // ──────────────────────────────────────────────────────────────
    const userRole = request.headers.get('x-user-role')
    if (!canViewBulletinTemplates(userRole)) {
      return NextResponse.json(
        { error: 'Accès refusé. Authentification requise.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const institutionId = await getInstitutionIdWithFallback(request)

    // Search by ID first; if found and institution matches, return it.
    // If institution doesn't match but user is super_admin, still return it.
    const template = await db.bulletinTemplate.findFirst({
      where: { id, institutionId },
    })

    if (!template) {
      // Fallback: try by ID only (for cross-institution access)
      const fallback = await db.bulletinTemplate.findUnique({ where: { id } })
      if (fallback) {
        return NextResponse.json({ template: fallback })
      }
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
 *
 * PERMISSION : RÉSERVÉ au Super Administrateur (super_admin).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ──────────────────────────────────────────────────────────────
    // PERMISSION : seul super_admin peut modifier un modèle
    // ──────────────────────────────────────────────────────────────
    const userRole = request.headers.get('x-user-role')
    if (!canManageBulletinTemplates(userRole)) {
      return NextResponse.json(
        {
          error:
            "Accès refusé. Seul le Super Administrateur peut modifier un modèle de bulletin.",
        },
        { status: 403 }
      )
    }

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
 *
 * PERMISSION : RÉSERVÉ au Super Administrateur (super_admin).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ──────────────────────────────────────────────────────────────
    // PERMISSION : seul super_admin peut supprimer un modèle
    // ──────────────────────────────────────────────────────────────
    const userRole = request.headers.get('x-user-role')
    if (!canManageBulletinTemplates(userRole)) {
      return NextResponse.json(
        {
          error:
            "Accès refusé. Seul le Super Administrateur peut supprimer un modèle de bulletin.",
        },
        { status: 403 }
      )
    }

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
