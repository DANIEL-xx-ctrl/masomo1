import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

// Check if the user is admin or super admin (super admin has full CRUD power
// on every page, across all institutions)
function checkAdmin(request: Request): NextResponse | null {
  const userRole = request.headers.get('x-user-role')
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return NextResponse.json(
      { error: 'Accès non autorisé. Seul un administrateur peut effectuer cette action.' },
      { status: 403 }
    )
  }
  return null
}

// Helper: attach computed `children` to a parent
// Uses the real Student.parentId relation (a parent may be in charge of several students)
async function withChildren<T extends { id: string; firstName: string; lastName: string; phone: string | null }>(
  parent: T,
  institutionId: string
): Promise<T & { children: Awaited<ReturnType<typeof db.student.findMany>> }> {
  const children = await db.student.findMany({
    where: {
      parentId: parent.id,
      user: { institutionId },
    },
    include: { class: true },
  })
  return { ...parent, children }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const { id } = await params
    const parent = await db.parent.findFirst({
      where: { id, user: { institutionId } },
      include: {
        user: {
          select: { id: true, email: true, phone: true, active: true, userCode: true },
        },
      },
    })

    if (!parent) {
      return NextResponse.json(
        { error: 'Parent non trouvé' },
        { status: 404 }
      )
    }

    // Attach computed children
    const enriched = await withChildren(parent, institutionId)

    return NextResponse.json({ data: enriched })
  } catch (error) {
    console.error('Get parent error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du parent' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const forbidden = checkAdmin(request)
    if (forbidden) return forbidden

    const { id } = await params
    const body = await request.json()
    const {
      firstName,
      lastName,
      phone,
      address,
      image,
      childrenIds,
    } = body

    const institutionId = await getInstitutionIdWithFallback(request)
    const existing = await db.parent.findFirst({ where: { id, user: { institutionId } } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Parent non trouvé' },
        { status: 404 }
      )
    }

    const parent = await db.parent.update({
      where: { id },
      data: {
        firstName,
        lastName,
        phone,
        address,
        image,
      },
      include: {
        user: {
          select: { id: true, email: true, phone: true, active: true, userCode: true, avatar: true },
        },
      },
    })

    // Also update the user name and avatar
    if (firstName || lastName || image !== undefined) {
      await db.user.update({
        where: { id: existing.userId },
        data: {
          ...(firstName || lastName ? { name: `${parent.firstName} ${parent.lastName}` } : {}),
          ...(image !== undefined ? { avatar: image || null } : {}),
        },
      })
    }

    // ---- Re-link children (students) to this parent ----
    // childrenIds is the FULL desired list of children for this parent.
    // We compute the diff: unassign removed students, assign added ones,
    // and also steal students that were previously assigned to another parent
    // (so a student always has at most one parent — last write wins).
    if (Array.isArray(childrenIds)) {
      const desired = childrenIds.filter(Boolean) as string[]

      // Students currently assigned to this parent (within institution)
      const currentChildren = await db.student.findMany({
        where: { parentId: id, user: { institutionId } },
        select: { id: true },
      })
      const currentIds = currentChildren.map((s) => s.id)

      const toRemove = currentIds.filter((sid) => !desired.includes(sid))
      const toAdd = desired.filter((sid) => !currentIds.includes(sid))

      const parentName = `${parent.firstName} ${parent.lastName}`
      const parentPhone = phone || parent.phone || null

      // Unlink removed children
      if (toRemove.length > 0) {
        await db.student.updateMany({
          where: { id: { in: toRemove }, user: { institutionId } },
          data: { parentId: null, parentContact: null, parentPhone: null },
        })
      }

      // Link added children (steal from any previous parent if needed)
      if (toAdd.length > 0) {
        await db.student.updateMany({
          where: { id: { in: toAdd }, user: { institutionId } },
          data: {
            parentId: id,
            parentContact: parentName,
            parentPhone: parentPhone,
          },
        })
      }
    }

    // Attach computed children
    const enriched = await withChildren(parent, institutionId)

    return NextResponse.json({ data: enriched })
  } catch (error) {
    console.error('Update parent error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du parent' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const forbidden = checkAdmin(request)
    if (forbidden) return forbidden

    const institutionId = await getInstitutionIdWithFallback(request)
    const { id } = await params
    const existing = await db.parent.findFirst({ where: { id, user: { institutionId } } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Parent non trouvé' },
        { status: 404 }
      )
    }

    // Delete the parent record first
    await db.parent.delete({ where: { id } })

    // Delete the associated user (cascade should handle it, but be safe)
    try {
      await db.user.delete({ where: { id: existing.userId } })
    } catch {
      // User may already be deleted by cascade
    }

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Delete parent error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du parent' },
      { status: 500 }
    )
  }
}
