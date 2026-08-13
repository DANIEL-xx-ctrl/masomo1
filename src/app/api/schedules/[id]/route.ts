import { db } from '@/lib/db'
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const forbidden = checkAdmin(request)
    if (forbidden) return forbidden

    const { id } = await params
    const body = await request.json()
    const { classId, teacherId, subject, dayOfWeek, startTime, endTime, room } = body

    if (!classId || !subject || dayOfWeek === undefined || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'classId, subject, dayOfWeek, startTime et endTime requis' },
        { status: 400 }
      )
    }

    const existing = await db.schedule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Créneau non trouvé' },
        { status: 404 }
      )
    }

    const schedule = await db.schedule.update({
      where: { id },
      data: {
        classId,
        teacherId: teacherId || null,
        subject,
        dayOfWeek: parseInt(String(dayOfWeek)),
        startTime,
        endTime,
        room: room || null,
      },
      include: {
        class: true,
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            subject: true,
          },
        },
      },
    })

    return NextResponse.json({ schedule })
  } catch (error) {
    console.error('Update schedule error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la modification du créneau" },
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

    const { id } = await params

    const existing = await db.schedule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Créneau non trouvé' },
        { status: 404 }
      )
    }

    await db.schedule.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete schedule error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du créneau' },
      { status: 500 }
    )
  }
}
