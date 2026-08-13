import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkAdminOrSuperAdmin } from '@/lib/auth-guards'
import { resolveInstitutionScope, requireInstitutionScope } from '@/lib/institution-scope'

// GET /api/school-years
// Renvoie toutes les années scolaires, éventuellement filtrées par institution.
// - Regular users: voient uniquement les années de LEUR institution (+ les globales).
// - Super admin (browsing): voit les années de l'institution consultée (+ globales).
// - Super admin (overview): voit toutes les années (y compris des autres institutions).
export async function GET(request: Request) {
  try {
    // ---- Strict institution isolation ----
    const scope = await resolveInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId

    const where: Record<string, unknown> = {}
    if (institutionId) {
      // On inclut les années de l'institution ET les années globales (institutionId null)
      where.OR = [{ institutionId }, { institutionId: null }]
    }

    const schoolYears = await db.schoolYear.findMany({
      where,
      orderBy: { label: 'asc' },
    })

    return NextResponse.json({ schoolYears })
  } catch (error) {
    console.error('Get school years error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des années scolaires' },
      { status: 500 }
    )
  }
}

// POST /api/school-years
// Crée une nouvelle année scolaire. Si `isActive` est true, désactive toutes les
// autres années de la même institution (transaction). Réservé aux admins.
export async function POST(request: Request) {
  try {
    const forbidden = checkAdminOrSuperAdmin(request)
    if (forbidden) return forbidden

    const body = await request.json()
    const { label, startDate, endDate, isActive } = body

    if (!label || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Libellé, date de début et date de fin requis' },
        { status: 400 }
      )
    }

    // Vérifie l'unicité du libellé
    const existing = await db.schoolYear.findUnique({ where: { label } })
    if (existing) {
      return NextResponse.json(
        { error: 'Une année scolaire avec ce libellé existe déjà' },
        { status: 409 }
      )
    }

    // ---- Strict institution isolation ----
    // L'année scolaire est créée dans l'institution du caller (regular users)
    // ou dans l'institution consultée (super admin). Le body `institutionId`
    // n'est plus confiance — seul le scope serveur fait foi.
    const scope = await requireInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const resolvedInstId = scope.institutionId

    const shouldBeActive = isActive ?? false

    // Transaction : si on active cette année, désactiver les autres de la même institution
    const schoolYear = await db.$transaction(async (tx) => {
      if (shouldBeActive) {
        const deactivateWhere: Record<string, unknown> = { isActive: true }
        if (resolvedInstId) {
          deactivateWhere.OR = [
            { institutionId: resolvedInstId },
            { institutionId: null },
          ]
        }
        await tx.schoolYear.updateMany({
          where: deactivateWhere,
          data: { isActive: false },
        })
      }

      return tx.schoolYear.create({
        data: {
          label,
          startDate,
          endDate,
          isActive: shouldBeActive,
          institutionId: resolvedInstId,
        },
      })
    })

    return NextResponse.json({ schoolYear }, { status: 201 })
  } catch (error) {
    console.error('Create school year error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'année scolaire' },
      { status: 500 }
    )
  }
}
