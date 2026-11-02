import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

/**
 * GET /api/bulletins/templates-by-level
 *
 * Liste les templates bulletins disponibles (par niveau) pour
 * l'institution courante. Utilisé par la page Bulletin pour :
 *   - afficher une liste des niveaux qui ont un template
 *   - prévenir l'utilisateur si sa classe n'a pas de template
 *
 * Résolution de l'institution (par ordre de priorité) :
 *   1. Query param `institutionId` (explicite)
 *   2. Header `x-institution-id` (envoyé par la page Bulletins)
 *   3. Lookup DB depuis `x-user-id` header (institution de l'utilisateur)
 *   4. Fallback : première institution active (super_admin sans institution active)
 *
 * Ce mécanisme est le même que celui de /api/settings/bulletin-templates
 * (page Paramètres → Institution) — ça garantit que la page Bulletins voit
 * exactement les mêmes templates que la page Paramètres.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const queryInstitutionId = searchParams.get('institutionId')

    // 1. Priorité au query param explicite
    // 2. Sinon, résolution via headers → user → fallback première institution active
    const institutionId = queryInstitutionId || await getInstitutionIdWithFallback(request)

    const templates = await db.bulletinTemplate.findMany({
      where: { institutionId },
      orderBy: [{ level: 'asc' }],
      select: {
        id: true,
        name: true,
        level: true,
        fileName: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ templates, institutionId })
  } catch (error) {
    console.error('List templates by level error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des templates' },
      { status: 500 }
    )
  }
}
