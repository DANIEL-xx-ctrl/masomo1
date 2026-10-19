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
 *   - files[]:       Un ou plusieurs fichiers .xlsx (les bulletins par niveau)
 *   - avatars:       Fichier .zip (contenant les avatars, optionnel)
 *   - institutionId: ID de l'institution cible (obligatoire)
 *   - force:         'true' pour forcer la ré-exécution (optionnel)
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
    const force = formData.get('force') === 'true'

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Aucun fichier Excel fourni. Utilisez files[] ou file.' },
        { status: 400 }
      )
    }

    if (!institutionId) {
      return NextResponse.json(
        { error: 'Institution cible manquante.' },
        { status: 400 }
      )
    }

    // Vérifier que l'institution existe
    const institution = await db.institution.findUnique({
      where: { id: institutionId },
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
      institutionId,
      schoolYear: '2024-2025',
      force,
    })

    return NextResponse.json({
      success: true,
      message: `Seed terminé pour ${institution.name}`,
      stats: result,
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

