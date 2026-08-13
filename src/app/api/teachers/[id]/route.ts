import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkAdminOrSuperAdmin } from '@/lib/auth-guards'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const teacher = await db.teacher.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, phone: true, active: true } },
        classes: {
          include: {
            class: true,
          },
        },
        schedules: {
          include: { class: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    })

    if (!teacher) {
      return NextResponse.json(
        { error: 'Enseignant non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json({ teacher })
  } catch (error) {
    console.error('Get teacher error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'enseignant" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const forbidden = checkAdminOrSuperAdmin(request)
    if (forbidden) return forbidden

    const { id } = await params
    const body = await request.json()
    const {
      firstName,
      lastName,
      subject,
      phone,
      qualification,
      hireDate,
      email,
      status,
      statusDate,
      image,
    } = body

    const existing = await db.teacher.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Enseignant non trouvé' },
        { status: 404 }
      )
    }

    // Règle métier : si le statut est "active", on efface statusDate.
    // Sinon (abandoned/migrated/deceased), on accepte la date fournie (ou la date du jour
    // si on passe en statut non-actif sans date explicite, ou on conserve l'ancienne date).
    let resolvedStatusDate: string | null = existing.statusDate
    const finalStatus = status || existing.status
    if (finalStatus === 'active') {
      resolvedStatusDate = null
    } else if (typeof statusDate === 'string' && statusDate.trim()) {
      resolvedStatusDate = statusDate.trim()
    } else if (!existing.statusDate) {
      // Statut non-actif mais aucune date fournie et aucune date existante -> date du jour
      resolvedStatusDate = new Date().toISOString().split('T')[0]
    }

    // Update the user's email if a new one is provided and differs from current.
    if (email && email !== existing.user.email) {
      const conflict = await db.user.findUnique({ where: { email } })
      if (conflict && conflict.id !== existing.user.id) {
        return NextResponse.json(
          { error: 'Cet email est déjà utilisé par un autre compte' },
          { status: 409 }
        )
      }
    }

    const teacher = await db.teacher.update({
      where: { id },
      data: {
        firstName,
        lastName,
        subject,
        phone,
        qualification,
        hireDate,
        status,
        statusDate: resolvedStatusDate,
        image,
      },
      include: {
        user: { select: { id: true, email: true, phone: true, active: true } },
      },
    })

    // Update the linked User record (name + email + phone).
    const userName =
      (teacher.firstName || existing.user.name?.split(' ')[0]) +
      ' ' +
      (teacher.lastName || '')
    await db.user.update({
      where: { id: existing.userId },
      data: {
        name: userName.trim(),
        ...(email ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
      },
    })

    return NextResponse.json({ teacher })
  } catch (error) {
    console.error('Update teacher error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'enseignant" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const forbidden = checkAdminOrSuperAdmin(request)
    if (forbidden) return forbidden

    const { id } = await params
    const body = await request.json()
    const { status, statusDate } = body

    const validStatuses = ['active', 'abandoned', 'migrated', 'deceased']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Statut invalide' },
        { status: 400 }
      )
    }

    const existing = await db.teacher.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Enseignant non trouvé' },
        { status: 404 }
      )
    }

    // Règle métier : si le statut devient "active", on efface statusDate.
    // Sinon, on prend la date fournie, sinon l'existante, sinon la date du jour.
    let resolvedStatusDate: string | null = existing.statusDate
    if (status === 'active') {
      resolvedStatusDate = null
    } else if (typeof statusDate === 'string' && statusDate.trim()) {
      resolvedStatusDate = statusDate.trim()
    } else if (!existing.statusDate) {
      resolvedStatusDate = new Date().toISOString().split('T')[0]
    }

    const teacher = await db.teacher.update({
      where: { id },
      data: { status, statusDate: resolvedStatusDate },
      include: {
        user: { select: { id: true, email: true, phone: true, active: true } },
      },
    })

    return NextResponse.json({ teacher })
  } catch (error) {
    console.error('Patch teacher status error:', error)
    return NextResponse.json(
      { error: "Erreur lors du changement de statut" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const forbidden = checkAdminOrSuperAdmin(request)
    if (forbidden) return forbidden

    const { id } = await params
    const existing = await db.teacher.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Enseignant non trouvé' },
        { status: 404 }
      )
    }

    // Delete related records first
    await db.classTeacher.deleteMany({ where: { teacherId: id } })
    await db.schedule.updateMany({
      where: { teacherId: id },
      data: { teacherId: null },
    })

    // Delete the teacher
    await db.teacher.delete({ where: { id } })

    // Delete the associated user
    await db.user.delete({ where: { id: existing.userId } })

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Delete teacher error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'enseignant" },
      { status: 500 }
    )
  }
}
