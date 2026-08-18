import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'
import { generateUserCode, ROLE_PREFIX } from '@/lib/user-code'

// POST /api/users/ensure-codes
// Backfills userCode for every user who doesn't have one yet.
// Admin (scoped to their institution) or super_admin (all institutions).
//
// This is idempotent: running it multiple times only assigns codes to users
// who are still missing one. Users with an existing code are left untouched.
//
// Returns a summary: { total, updated, skipped, byRole: { ELV: 5, ENS: 2, ... } }
export async function POST(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé. Seul un administrateur peut générer les identifiants.' },
        { status: 403 }
      )
    }

    // For regular admins, scope to their own institution.
    // For super_admin, getInstitutionIdWithFallback returns their browsed
    // institution OR the first active institution. To truly backfill ALL
    // users across all institutions, super_admin should pass ?all=1.
    const { searchParams } = new URL(request.url)
    const allInstitutions = searchParams.get('all') === '1' && userRole === 'super_admin'

    let institutionScope: string | undefined
    if (!allInstitutions) {
      institutionScope = await getInstitutionIdWithFallback(request)
    }

    // Find all users missing a userCode (or with an empty one).
    const whereClause: Record<string, unknown> = {
      OR: [{ userCode: null }, { userCode: '' }],
    }
    if (institutionScope) {
      whereClause.institutionId = institutionScope
    }

    const usersWithoutCode = await db.user.findMany({
      where: whereClause,
      select: { id: true, role: true, institutionId: true, name: true },
      orderBy: { createdAt: 'asc' }, // oldest first → lowest numbers
    })

    // Group by role + institution so we can assign sequential numbers
    // efficiently. We process users in order, calling generateUserCode for
    // each one (the function queries the DB each time, but since we process
    // sequentially the newly-assigned codes will be counted).
    let updated = 0
    let skipped = 0
    const byRole: Record<string, number> = {}
    const errors: { userId: string; name: string; error: string }[] = []

    for (const u of usersWithoutCode) {
      try {
        const code = await generateUserCode(u.role, u.institutionId)
        await db.user.update({
          where: { id: u.id },
          data: { userCode: code },
        })
        updated++
        const prefix = ROLE_PREFIX[u.role] || 'USR'
        byRole[prefix] = (byRole[prefix] || 0) + 1
      } catch (err) {
        // If a single user fails (e.g. unique constraint race), continue
        // with the rest rather than failing the whole batch.
        skipped++
        errors.push({
          userId: u.id,
          name: u.name,
          error: err instanceof Error ? err.message : 'Erreur inconnue',
        })
      }
    }

    return NextResponse.json({
      message:
        updated > 0
          ? `${updated} identifiant(s) généré(s) avec succès.`
          : 'Tous les utilisateurs ont déjà un identifiant.',
      total: usersWithoutCode.length,
      updated,
      skipped,
      byRole,
      ...(errors.length > 0 ? { errors: errors.slice(0, 10) } : {}),
    })
  } catch (error) {
    console.error('Ensure userCodes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération des identifiants.' },
      { status: 500 }
    )
  }
}
