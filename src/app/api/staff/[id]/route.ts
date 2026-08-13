import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const { id } = await params
    const staff = await db.staff.findFirst({
      where: { id, user: { institutionId } },
      include: {
        user: { select: { id: true, email: true, phone: true, active: true, userCode: true } },
      },
    })

    if (!staff) {
      return NextResponse.json(
        { error: 'Membre du personnel non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json({ staff })
  } catch (error) {
    console.error('Get staff error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du membre du personnel' },
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

    const institutionId = await getInstitutionIdWithFallback(request)
    const { id } = await params
    const body = await request.json()
    const {
      firstName,
      lastName,
      phone,
      email,
      fonction,
      image,
    } = body

    const existing = await db.staff.findFirst({ where: { id, user: { institutionId } } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Membre du personnel non trouvé' },
        { status: 404 }
      )
    }

    const staff = await db.staff.update({
      where: { id },
      data: {
        firstName,
        lastName,
        phone,
        email,
        fonction,
        image,
      },
      include: {
        user: { select: { id: true, email: true, phone: true, active: true, userCode: true } },
      },
    })

    // Also update the user name and email
    if (firstName || lastName || email !== undefined) {
      await db.user.update({
        where: { id: existing.userId },
        data: {
          ...(firstName || lastName ? { name: `${staff.firstName} ${staff.lastName}` } : {}),
          ...(phone !== undefined && { phone }),
          ...(email !== undefined && email && { email }),
        },
      })
    }

    return NextResponse.json({ staff })
  } catch (error) {
    console.error('Update staff error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du membre du personnel' },
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
    const existing = await db.staff.findFirst({ where: { id, user: { institutionId } } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Membre du personnel non trouvé' },
        { status: 404 }
      )
    }

    // Delete the staff record
    await db.staff.delete({ where: { id } })

    // Delete the associated user
    await db.user.delete({ where: { id: existing.userId } })

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Delete staff error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du membre du personnel' },
      { status: 500 }
    )
  }
}
