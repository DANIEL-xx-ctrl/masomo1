import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { notifyUsers } from '@/lib/notifications'
import { CURRENT_SCHOOL_YEAR } from '@/lib/constants'
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

export async function GET(request: Request) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const { searchParams } = new URL(request.url)
    const schoolYear = searchParams.get('schoolYear') || CURRENT_SCHOOL_YEAR
    const classId = searchParams.get('classId')

    const events = await db.schoolEvent.findMany({
      where: { institutionId, schoolYear },
      orderBy: { date: 'asc' },
      include: {
        classes: {
          include: {
            class: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    // If classId is provided, filter events relevant to that class
    if (classId) {
      const filtered = events.filter(e => e.isGlobal || e.classes.some(ec => ec.classId === classId))
      return NextResponse.json({ events: filtered })
    }

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Get events error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des événements' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const forbidden = checkAdmin(request)
    if (forbidden) return forbidden

    const body = await request.json()
    const { title, description, date, endDate, type, schoolYear, isGlobal, classIds } = body

    if (!title || !date) {
      return NextResponse.json(
        { error: 'Titre et date requis' },
        { status: 400 }
      )
    }

    const validTypes = ['holiday', 'exam', 'meeting', 'celebration', 'deadline', 'other']
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type invalide. Types acceptés: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const global = isGlobal !== false // default true

    // If not global, classIds must be provided
    if (!global && (!classIds || classIds.length === 0)) {
      return NextResponse.json(
        { error: 'Sélectionnez au moins une classe pour un événement non-global' },
        { status: 400 }
      )
    }

    const event = await db.schoolEvent.create({
      data: {
        title,
        description: description || null,
        date,
        endDate: endDate || null,
        type: type || 'other',
        schoolYear: schoolYear || CURRENT_SCHOOL_YEAR,
        isGlobal: global,
        institutionId,
        classes: !global && classIds?.length > 0
          ? {
              create: classIds.map((cid: string) => ({ classId: cid })),
            }
          : undefined,
      },
      include: {
        classes: {
          include: {
            class: { select: { id: true, name: true } },
          },
        },
      },
    })

    // Notify all relevant users about the new school-calendar event.
    // Previously this only called notifyAdmins() which (a) never passed
    // institutionId so createMany silently failed, and (b) only reached
    // admins. Now we fan out to every active user of the institution so
    // the event shows up in everyone's notification bell badge.
    try {
      const eventDate = new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      const notifMessage = `${title} — prévu le ${eventDate}${description ? ` · ${description}` : ''}`
      const eventSchoolYear = schoolYear || CURRENT_SCHOOL_YEAR

      // Determine which user IDs should be notified.
      //  - Global event  → all active users in the institution
      //  - Class event    → admins/teachers/staff + students/parents of the
      //                     selected classes
      const recipientIds = new Set<string>()

      // Always include admins, teachers and staff of the institution
      const staffUsers = await db.user.findMany({
        where: {
          institutionId,
          active: true,
          role: { in: ['admin', 'teacher', 'staff'] },
        },
        select: { id: true },
      })
      staffUsers.forEach((u) => recipientIds.add(u.id))

      if (global) {
        // Global event: notify every active user (incl. students & parents)
        const allUsers = await db.user.findMany({
          where: { institutionId, active: true },
          select: { id: true },
        })
        allUsers.forEach((u) => recipientIds.add(u.id))
      } else if (classIds && classIds.length > 0) {
        // Class-specific: notify students in those classes + their parents
        const studentsInClasses = await db.student.findMany({
          where: { classId: { in: classIds } },
          include: { user: { select: { id: true, active: true } } },
        })

        // Students with an active user account
        studentsInClasses
          .filter((s) => s.user?.active)
          .forEach((s) => s.user && recipientIds.add(s.user.id))

        // Parents of those students (matched by phone)
        const parentPhones = studentsInClasses
          .map((s) => s.parentPhone || s.parentContact)
          .filter(Boolean) as string[]
        if (parentPhones.length > 0) {
          const parentUsers = await db.user.findMany({
            where: {
              institutionId,
              role: 'parent',
              active: true,
              phone: { in: parentPhones },
            },
            select: { id: true },
          })
          parentUsers.forEach((u) => recipientIds.add(u.id))
        }
      }

      await notifyUsers(Array.from(recipientIds), {
        title: 'Nouvel événement au calendrier',
        message: notifMessage,
        type: 'event',
        category: 'event',
        link: 'school-calendar',
        linkParams: event.id,
        icon: 'Calendar',
        institutionId,
        schoolYear: eventSchoolYear,
      })
    } catch (notifError) {
      console.error('Error creating event notifications (non-blocking):', notifError)
      // Don't fail the event creation if notifications fail
    }

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    console.error('Create event error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la création de l'événement" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const forbidden = checkAdmin(request)
    if (forbidden) return forbidden

    const body = await request.json()
    const { id, title, description, date, endDate, type, isGlobal, classIds } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID requis' },
        { status: 400 }
      )
    }

    const existing = await db.schoolEvent.findFirst({ where: { id, institutionId } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Événement non trouvé' },
        { status: 404 }
      )
    }

    const validTypes = ['holiday', 'exam', 'meeting', 'celebration', 'deadline', 'other']
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type invalide. Types acceptés: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const global = isGlobal !== false

    // If switching to non-global, classIds must be provided
    if (!global && (!classIds || classIds.length === 0)) {
      return NextResponse.json(
        { error: 'Sélectionnez au moins une classe pour un événement non-global' },
        { status: 400 }
      )
    }

    // If classIds are provided, replace existing class associations
    if (classIds !== undefined) {
      // Delete existing class associations
      await db.eventClass.deleteMany({ where: { eventId: id } })

      // Create new ones if not global
      if (!global && classIds.length > 0) {
        await db.eventClass.createMany({
          data: classIds.map((cid: string) => ({ eventId: id, classId: cid })),
        })
      }
    }

    const event = await db.schoolEvent.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(date !== undefined && { date }),
        ...(endDate !== undefined && { endDate: endDate || null }),
        ...(type !== undefined && { type }),
        ...(isGlobal !== undefined && { isGlobal: global }),
      },
      include: {
        classes: {
          include: {
            class: { select: { id: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json({ event })
  } catch (error) {
    console.error('Update event error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la modification de l'événement" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const forbidden = checkAdmin(request)
    if (forbidden) return forbidden

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID requis' },
        { status: 400 }
      )
    }

    const existing = await db.schoolEvent.findFirst({ where: { id, institutionId } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Événement non trouvé' },
        { status: 404 }
      )
    }

    await db.schoolEvent.delete({ where: { id } })

    return NextResponse.json({ message: 'Événement supprimé avec succès' })
  } catch (error) {
    console.error('Delete event error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'événement" },
      { status: 500 }
    )
  }
}
