import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { wipeInstitutionData } from '@/lib/seed-institution'

// ============================================================================
// DELETE /api/institutions/[id]/data
//
// Wipe ALL data belonging to ONE institution (preserving the Institution row
// itself AND the admin user so they can still log in). The institution is
// left empty, ready to receive new data (either via the per-institution
// seed endpoint or by manual creation).
//
// Auth:
//   - super_admin: always allowed (uses the [id] from the URL)
//   - admin: allowed only if their institutionId matches [id]
// ============================================================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ---- Auth guard ----
    const userRole = request.headers.get('x-user-role')
    const userId = request.headers.get('x-user-id')
    const institutionId = (await params).id

    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Accès refusé. Seul un admin ou un super admin peut effacer les données d\'une institution.' },
        { status: 403 }
      )
    }

    if (userRole === 'admin') {
      if (!userId) {
        return NextResponse.json(
          { error: 'Utilisateur non identifié.' },
          { status: 403 }
        )
      }
      const user = await db.user.findUnique({ where: { id: userId } })
      if (!user || user.institutionId !== institutionId) {
        return NextResponse.json(
          { error: 'Vous ne pouvez effacer que les données de votre propre institution.' },
          { status: 403 }
        )
      }
    }

    // ---- Find the institution ----
    const institution = await db.institution.findUnique({
      where: { id: institutionId },
    })
    if (!institution) {
      return NextResponse.json(
        { error: 'Institution introuvable.' },
        { status: 404 }
      )
    }

    // ---- Wipe this institution's data (preserve admin user) ----
    await wipeInstitutionData(institutionId, { preserveAdminUser: true })

    return NextResponse.json({
      message: `Toutes les données de l'institution « ${institution.name} » ont été effacées. L'institution et votre compte admin sont conservés.`,
    })
  } catch (error) {
    console.error('Clear institution data error:', error)
    return NextResponse.json(
      {
        error: 'Erreur lors de l\'effacement des données de l\'institution.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
