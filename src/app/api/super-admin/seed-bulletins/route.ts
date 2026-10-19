import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runBulletinSeed } from '@/lib/bulletin-seed'

/**
 * POST /api/super-admin/seed-bulletins
 *
 * Importe massivement des élèves + notes depuis un ou plusieurs fichiers
 * Excel (.xlsx) au format MASOMO RDC primaire, et optionnellement un zip
 * d'avatars.
 *
 * PERMISSION : RÉSERVÉ au Super Administrateur (super_admin).
 *
 * Body (multipart/form-data) :
 *   - files[]:          Un ou plusieurs fichiers .xlsx (les bulletins par niveau)
 *   - avatars:          Fichier .zip (contenant les avatars, optionnel)
 *   - institutionId:    ID de l'institution cible (optionnel si adminUserCode fourni)
 *   - adminUserCode:    Code utilisateur de l'admin dont on veut cibler l'institution
 *                       (ex: "ADM-006" → Institut Technique de Bamenda)
 *   - force:            'true' pour forcer la ré-exécution (optionnel)
 *
 * Si ni institutionId ni adminUserCode n'est fourni, la route cherche
 * l'admin "ADM-006" par défaut.
 *
 * Année scolaire ciblée : 2024-2025 (codée en dur)
 * Trimestres : tous (1er, 2eme, 3eme) — détection automatique depuis l'Excel
 */
export async function POST(request: NextRequest) {
  try {
    // ──────────────────────────────────────────────────────────────
    // PERMISSION : seul super_admin peut exécuter le seed
    // ──────────────────────────────────────────────────────────────
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'super_admin') {
      return NextResponse.json(
        {
          error:
            'Accès refusé. Seul le Super Administrateur peut exécuter le seed des bulletins.',
        },
        { status: 403 }
      )
    }

    // ──────────────────────────────────────────────────────────────
    // Parsing du body multipart
    // ──────────────────────────────────────────────────────────────
    const formData = await request.formData()

    // Récupérer un ou plusieurs fichiers Excel
    const fileEntries = formData.getAll('files')
    const files: Array<{ name: string; buffer: Buffer }> = []

    for (const entry of fileEntries) {
      if (entry instanceof File) {
        const buffer = Buffer.from(await entry.arrayBuffer())
        files.push({ name: entry.name, buffer })
      }
    }

    // Compatibilité : si pas de "files[]", essayer "file" (singulier)
    if (files.length === 0) {
      const singleFile = formData.get('file')
      if (singleFile instanceof File) {
        files.push({
          name: singleFile.name,
          buffer: Buffer.from(await singleFile.arrayBuffer()),
        })
      }
    }

    const avatars = formData.get('avatars') as File | null
    const institutionId = formData.get('institutionId') as string | null
    const adminUserCode = formData.get('adminUserCode') as string | null
    const force = formData.get('force') === 'true'

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Aucun fichier Excel fourni. Utilisez files[] ou file.' },
        { status: 400 }
      )
    }

    // ──────────────────────────────────────────────────────────────
    // Résolution de l'institution cible
    //   Priorité :
    //     1. institutionId explicite
    //     2. adminUserCode fourni → lookup institution
    //     3. adminUserCode par défaut : "ADM-006"
    // ──────────────────────────────────────────────────────────────
    let targetInstitutionId = institutionId
    let resolvedAdminCode: string | null = null

    if (!targetInstitutionId) {
      // Si adminUserCode non fourni, utiliser ADM-006 par défaut
      const codeToLookup = adminUserCode || 'ADM-006'
      resolvedAdminCode = codeToLookup

      const admin = await db.user.findFirst({
        where: {
          userCode: codeToLookup,
          role: 'admin',
        },
        select: {
          id: true,
          name: true,
          email: true,
          userCode: true,
          institutionId: true,
          institution: { select: { id: true, name: true } },
        },
      })

      if (!admin) {
        return NextResponse.json(
          {
            error: `Admin avec le code "${codeToLookup}" introuvable. Vérifiez le code ou fournissez un institutionId explicite.`,
          },
          { status: 404 }
        )
      }

      if (!admin.institutionId || !admin.institution) {
        return NextResponse.json(
          {
            error: `L'admin "${codeToLookup}" (${admin.name}) n'est associé à aucune institution.`,
          },
          { status: 400 }
        )
      }

      targetInstitutionId = admin.institution.id
    }

    // Vérifier que l'institution existe
    const institution = await db.institution.findUnique({
      where: { id: targetInstitutionId },
      select: { id: true, name: true },
    })
    if (!institution) {
      return NextResponse.json(
        { error: 'Institution introuvable.' },
        { status: 404 }
      )
    }

    // ──────────────────────────────────────────────────────────────
    // Lecture du buffer des avatars
    // ──────────────────────────────────────────────────────────────
    const avatarsBuffer = avatars
      ? Buffer.from(await avatars.arrayBuffer())
      : null

    // ──────────────────────────────────────────────────────────────
    // Exécution du seed
    // ──────────────────────────────────────────────────────────────
    const result = await runBulletinSeed(files, avatarsBuffer, {
      institutionId: targetInstitutionId,
      schoolYear: '2024-2025',
      force,
    })

    return NextResponse.json({
      success: true,
      message: `Seed terminé pour ${institution.name}${
        resolvedAdminCode ? ` (institution de l'admin ${resolvedAdminCode})` : ''
      }`,
      stats: result,
      targetInstitution: {
        id: institution.id,
        name: institution.name,
      },
    })
  } catch (error) {
    console.error('[super-admin/seed-bulletins] error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de l'exécution du seed.",
      },
      { status: 500 }
    )
  }
}
