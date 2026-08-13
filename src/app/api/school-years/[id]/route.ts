import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkAdminOrSuperAdmin } from '@/lib/auth-guards'

// PATCH /api/school-years/[id]
// Met à jour une année scolaire. Si `isActive` passe à true, désactive les autres
// années de la même institution (transaction).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const forbidden = checkAdminOrSuperAdmin(request)
    if (forbidden) return forbidden

    const { id } = await params
    const body = await request.json()
    const { label, startDate, endDate, isActive } = body

    const existing = await db.schoolYear.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Année scolaire non trouvée' },
        { status: 404 }
      )
    }

    // Vérifie l'unicité du libellé s'il change
    if (label && label !== existing.label) {
      const conflict = await db.schoolYear.findUnique({ where: { label } })
      if (conflict) {
        return NextResponse.json(
          { error: 'Une année scolaire avec ce libellé existe déjà' },
          { status: 409 }
        )
      }
    }

    const willActivate = isActive === true && !existing.isActive

    const schoolYear = await db.$transaction(async (tx) => {
      if (willActivate) {
        // Désactive les autres années actives de la même institution (et les globales)
        const deactivateWhere: Record<string, unknown> = {
          isActive: true,
          id: { not: id },
        }
        if (existing.institutionId) {
          deactivateWhere.OR = [
            { institutionId: existing.institutionId },
            { institutionId: null },
          ]
        }
        await tx.schoolYear.updateMany({
          where: deactivateWhere,
          data: { isActive: false },
        })
      }

      return tx.schoolYear.update({
        where: { id },
        data: {
          ...(label !== undefined && { label }),
          ...(startDate !== undefined && { startDate }),
          ...(endDate !== undefined && { endDate }),
          ...(isActive !== undefined && { isActive }),
        },
      })
    })

    return NextResponse.json({ schoolYear })
  } catch (error) {
    console.error('Update school year error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'année scolaire' },
      { status: 500 }
    )
  }
}

// DELETE /api/school-years/[id]
// Supprime une année scolaire. Refuse si c'est la seule année active.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const forbidden = checkAdminOrSuperAdmin(request)
    if (forbidden) return forbidden

    const { id } = await params
    const existing = await db.schoolYear.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Année scolaire non trouvée' },
        { status: 404 }
      )
    }

    // Refuse la suppression si c'est la seule année active
    if (existing.isActive) {
      const activeCount = await db.schoolYear.count({ where: { isActive: true } })
      if (activeCount <= 1) {
        return NextResponse.json(
          { error: 'Impossible de supprimer la seule année scolaire active' },
          { status: 400 }
        )
      }
    }

    await db.schoolYear.delete({ where: { id } })

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Delete school year error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'année scolaire' },
      { status: 500 }
    )
  }
}
