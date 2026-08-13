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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const schoolYear = searchParams.get('schoolYear')

    const where: Record<string, unknown> = {}

    if (classId) where.classId = classId
    if (schoolYear) where.class = { schoolYear }

    const schedules = await db.schedule.findMany({
      where,
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
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })

    return NextResponse.json({ schedules })
  } catch (error) {
    console.error('Get schedules error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des emplois du temps' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const forbidden = checkAdmin(request)
    if (forbidden) return forbidden

    const body = await request.json()
    const { classId, teacherId, subject, dayOfWeek, startTime, endTime, room } = body

    if (!classId || !subject || dayOfWeek === undefined || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'classId, subject, dayOfWeek, startTime et endTime requis' },
        { status: 400 }
      )
    }

    const schedule = await db.schedule.create({
      data: {
        classId,
        teacherId,
        subject,
        dayOfWeek: parseInt(String(dayOfWeek)),
        startTime,
        endTime,
        room,
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

    return NextResponse.json({ schedule }, { status: 201 })
  } catch (error) {
    console.error('Create schedule error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la création de l'emploi du temps" },
      { status: 500 }
    )
  }
}
