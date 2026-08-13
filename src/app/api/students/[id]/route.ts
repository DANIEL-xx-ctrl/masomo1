import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkAdminOrSuperAdmin } from '@/lib/auth-guards'

/**
 * Resolve the `statusDate` to persist for a student based on the requested
 * status and the date provided by the client.
 *
 * Business rules (mirrors the teachers API):
 *   - status = "active"             → statusDate is always cleared.
 *   - status = abandoned/migrated/  → use the explicit date if provided,
 *     deceased                        otherwise preserve the existing date,
 *                                     otherwise default to today's date.
 */
function resolveStatusDate(
  status: string | undefined,
  statusDate: string | undefined,
  existingDate: string | null = null,
): string | null {
  const finalStatus = status || 'active'
  if (finalStatus === 'active') {
    return null
  }
  if (typeof statusDate === 'string' && statusDate.trim()) {
    return statusDate.trim()
  }
  if (existingDate) {
    return existingDate
  }
  return new Date().toISOString().split('T')[0]
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const student = await db.student.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, phone: true, active: true } },
        class: true,
        grades: {
          include: { subject: true },
          orderBy: { date: 'desc' },
          take: 10,
        },
        attendances: {
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    })

    if (!student) {
      return NextResponse.json(
        { error: 'Étudiant non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json({ student })
  } catch (error) {
    console.error('Get student error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'étudiant' },
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
      dateOfBirth,
      gender,
      address,
      parentContact,
      classId,
      parentPhone,
      status,
      statusDate,
      image,
    } = body

    const existing = await db.student.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Étudiant non trouvé' },
        { status: 404 }
      )
    }

    // Resolve the status date according to the same business rules as the
    // teachers API (clear on active, default to today on non-active without
    // explicit date, preserve existing date otherwise).
    const resolvedStatusDate = resolveStatusDate(status, statusDate, existing.statusDate)

    const student = await db.student.update({
      where: { id },
      data: {
        firstName,
        lastName,
        dateOfBirth,
        gender,
        address,
        parentContact,
        classId: classId === '' ? null : classId,
        parentPhone,
        status,
        statusDate: resolvedStatusDate,
        image,
      },
      include: {
        user: { select: { id: true, email: true, phone: true, active: true } },
        class: true,
      },
    })

    // Also update the user name
    if (firstName || lastName) {
      await db.user.update({
        where: { id: existing.userId },
        data: {
          name: `${student.firstName} ${student.lastName}`,
        },
      })
    }

    return NextResponse.json({ student })
  } catch (error) {
    console.error('Update student error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'étudiant' },
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

    const existing = await db.student.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Étudiant non trouvé' },
        { status: 404 }
      )
    }

    // Resolve the status date: clear on active, preserve existing on non-active
    // (unless a new date is explicitly provided), default to today otherwise.
    const resolvedStatusDate = resolveStatusDate(status, statusDate, existing.statusDate)

    const student = await db.student.update({
      where: { id },
      data: { status, statusDate: resolvedStatusDate },
      include: {
        user: { select: { id: true, email: true, phone: true, active: true } },
        class: true,
      },
    })

    return NextResponse.json({ student })
  } catch (error) {
    console.error('Patch student status error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du changement de statut' },
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
    const existing = await db.student.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Étudiant non trouvé' },
        { status: 404 }
      )
    }

    // Delete related records first
    await db.grade.deleteMany({ where: { studentId: id } })
    await db.attendance.deleteMany({ where: { studentId: id } })
    await db.bulletin.deleteMany({ where: { studentId: id } })
    await db.payment.deleteMany({ where: { studentId: id } })

    // Delete the student
    await db.student.delete({ where: { id } })

    // Delete the associated user
    await db.user.delete({ where: { id: existing.userId } })

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Delete student error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'étudiant' },
      { status: 500 }
    )
  }
}
