import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionId, getInstitutionIdWithFallback } from '@/lib/api-auth'
import { parseBulletinExcel, detectLevel, levelLabel } from '@/lib/bulletin-parser'
import { canManageBulletinTemplates, canViewBulletinTemplates } from '@/lib/bulletin-permissions'

/**
 * GET /api/settings/bulletin-templates
 * Liste tous les modèles de bulletins d'une institution.
 *
 * PERMISSION : super_admin + admin (lecture seule pour admin)
 */
export async function GET(request: NextRequest) {
  try {
    // ──────────────────────────────────────────────────────────────
    // PERMISSION : super_admin + admin peuvent lister les modèles
    // ──────────────────────────────────────────────────────────────
    const userRole = request.headers.get('x-user-role')
    if (!canViewBulletinTemplates(userRole)) {
      return NextResponse.json(
        { error: 'Accès refusé. Authentification requise.' },
        { status: 403 }
      )
    }

    const institutionId = await getInstitutionIdWithFallback(request)
    const templates = await db.bulletinTemplate.findMany({
      where: { institutionId },
      orderBy: [{ level: 'asc' }],
      select: {
        id: true,
        name: true,
        level: true,
        fileName: true,
        mediaFileId: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('[bulletin-templates] GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/settings/bulletin-templates
 * Upload d'un nouveau modèle de bulletin (multipart/form-data).
 * Champs: file (xlsx), name (optionnel), level (optionnel — auto-détecté).
 *
 * PERMISSION : RÉSERVÉ au Super Administrateur (super_admin).
 * Les administrateurs d'établissement (admin) peuvent uniquement
 * visualiser et exporter les modèles existants.
 */
export async function POST(request: NextRequest) {
  try {
    // ──────────────────────────────────────────────────────────────
    // PERMISSION : seul super_admin peut uploader / créer un modèle
    // Les administrateurs d'établissement peuvent uniquement visualiser
    // et exporter les modèles existants.
    // ──────────────────────────────────────────────────────────────
    const userRole = request.headers.get('x-user-role')
    if (!canManageBulletinTemplates(userRole)) {
      return NextResponse.json(
        {
          error:
            'Accès refusé. Seul le Super Administrateur peut uploader ou créer des modèles de bulletins. ' +
            "Les administrateurs d'établissement peuvent uniquement les visualiser et les exporter.",
        },
        { status: 403 }
      )
    }

    console.log('[bulletin-templates] POST: starting upload...')
    // Use fallback so super_admin without active institution still works
    // (defaults to first active institution)
    let institutionId = await getInstitutionId(request)
    console.log('[bulletin-templates] POST: getInstitutionId returned:', institutionId)
    if (!institutionId) {
      institutionId = await getInstitutionIdWithFallback(request)
      console.log('[bulletin-templates] POST: fallback institutionId:', institutionId)
    }
    if (!institutionId) {
      return NextResponse.json(
        { error: 'Institution non trouvée. Connectez-vous en tant qu\'admin.' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const customName = (formData.get('name') as string | null) || ''
    const customLevel = (formData.get('level') as string | null) || ''

    console.log('[bulletin-templates] POST: file received:', file?.name, 'size:', file?.size)

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    // Vérifier l'extension
    const fileName = file.name
    if (!fileName.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'Format non supporté. Utilisez un fichier .xlsx' },
        { status: 400 }
      )
    }

    // Vérifier la taille (max 4 Mo)
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Le fichier dépasse 4 Mo' },
        { status: 400 }
      )
    }

    // Lire le buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parser la structure du bulletin
    const structure = parseBulletinExcel(buffer, fileName)

    // Déterminer le niveau
    const level = customLevel ? parseInt(customLevel, 10) : structure.meta.level || 1
    const name = customName || levelLabel(level)

    // Vérifier s'il existe déjà un modèle pour ce niveau → on remplace
    const existing = await db.bulletinTemplate.findFirst({
      where: { institutionId, level },
    })

    // Stocker le fichier en base (MediaFile)
    const base64 = buffer.toString('base64')
    let mediaFile
    if (existing?.mediaFileId) {
      // Mettre à jour le MediaFile existant
      mediaFile = await db.mediaFile.update({
        where: { id: existing.mediaFileId },
        data: {
          filename: fileName,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          data: base64,
          size: file.size,
        },
      })
    } else {
      mediaFile = await db.mediaFile.create({
        data: {
          filename: fileName,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          data: base64,
          size: file.size,
          institutionId,
        },
      })
    }

    let template
    if (existing) {
      template = await db.bulletinTemplate.update({
        where: { id: existing.id },
        data: {
          name,
          level,
          fileName,
          mediaFileId: mediaFile.id,
          structure: structure as any,
        },
      })
    } else {
      template = await db.bulletinTemplate.create({
        data: {
          institutionId,
          name,
          level,
          fileName,
          mediaFileId: mediaFile.id,
          structure: structure as any,
        },
      })
    }

    return NextResponse.json({
      template,
      message: existing
        ? `Modèle "${name}" mis à jour avec succès`
        : `Modèle "${name}" uploadé avec succès`,
    })
  } catch (error) {
    console.error('[bulletin-templates] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
