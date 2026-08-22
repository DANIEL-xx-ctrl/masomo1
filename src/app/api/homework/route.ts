import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

export async function GET(request: Request) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const { searchParams } = new URL(request.url)
    const schoolYear = searchParams.get('schoolYear') || '2024-2025'
    const classId = searchParams.get('classId')
    const status = searchParams.get('status')
    const teacherId = searchParams.get('teacherId')
    const parentId = searchParams.get('parentId')
    const classIds = searchParams.get('classIds') // comma-separated class IDs for parent's children

    const where: Record<string, unknown> = { institutionId, schoolYear }
    if (classId) where.classId = classId
    if (status) where.status = status
    if (teacherId) where.teacherId = teacherId

    // Parent-specific: filter homework by classes of their children
    if (parentId) {
      const children = await db.student.findMany({
        where: { parentId },
        select: { classId: true },
      })
      const childClassIds = children.map(c => c.classId).filter(Boolean) as string[]
      if (childClassIds.length > 0) {
        where.classId = { in: childClassIds }
      } else {
        // Parent has no children with classes, return empty
        return NextResponse.json({ homeworks: [] })
      }
    } else if (classIds) {
      // Alternative: pass class IDs directly
      const ids = classIds.split(',').filter(Boolean)
      if (ids.length > 0) {
        where.classId = { in: ids }
      }
    }

    const homeworks = await db.homework.findMany({
      where,
      orderBy: { dueDate: 'desc' },
      include: {
        class: { select: { id: true, name: true, level: true, section: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { submissions: true } },
      },
    })

    return NextResponse.json({ homeworks })
  } catch (error) {
    console.error('Get homework error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des devoirs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const userRole = request.headers.get('x-user-role')
    // Super admin has full CRUD power on every page; admin & teacher can create homework
    if (userRole !== 'admin' && userRole !== 'teacher' && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, subjectId, classId, teacherId, dueDate, assignedDate, type, status, schoolYear } = body

    if (!title || !classId || !dueDate) {
      return NextResponse.json(
        { error: 'Titre, classe et date limite requis' },
        { status: 400 }
      )
    }

    const homework = await db.homework.create({
      data: {
        title,
        description: description || null,
        subjectId: subjectId || null,
        classId,
        teacherId: teacherId || null,
        dueDate,
        assignedDate: assignedDate || new Date().toISOString().split('T')[0],
        type: type || 'homework',
        status: status || 'active',
        schoolYear: schoolYear || '2024-2025',
        institutionId,
      },
      include: {
        class: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        subject: { select: { id: true, name: true } },
      },
    })

    // Send notifications for the new homework
    try {
      const className = homework.class?.name || ''
      const subjectName = homework.subject?.name || ''
      const dueDateFormatted = new Date(dueDate).toLocaleDateString('fr-FR')
      const notifMessage = `${title}${subjectName ? ` — ${subjectName}` : ''} (${className}), pour le ${dueDateFormatted}`

      // 1. Notify admin users
      const admins = await db.user.findMany({
        where: { institutionId, role: 'admin', active: true },
        select: { id: true },
      })
      if (admins.length > 0) {
        await db.notification.createMany({
          data: admins.map(admin => ({
            userId: admin.id,
            title: 'Nouveau devoir assigné',
            message: notifMessage,
            type: 'homework',
            category: 'homework',
            link: 'homework',
            linkParams: homework.id,
            icon: 'BookOpen',
            institutionId,
          })),
        })
      }

      // 1b. Notify the teacher who created the homework (if a teacherId is set)
      // Previously the teacher who assigned the homework never received a
      // notification, so nothing appeared in their bell — even though they
      // created the homework. We resolve the teacher's User.id and send
      // them a confirmation notification.
      // Fallback: if teacherId was not set in the body but the requester is
      // a teacher (x-user-id header), notify that teacher.
      let teacherUserIdToNotify: string | null = null
      if (homework.teacher?.id) {
        const teacherUser = await db.teacher.findUnique({
          where: { id: homework.teacher.id },
          select: { userId: true },
        })
        teacherUserIdToNotify = teacherUser?.userId || null
      } else {
        // No teacherId on the homework — use the requester's user id
        const requesterUserId = request.headers.get('x-user-id')
        if (requesterUserId && userRole === 'teacher') {
          teacherUserIdToNotify = requesterUserId
        }
      }
      if (teacherUserIdToNotify) {
        // Avoid duplicate if the teacher is also an admin (already notified above)
        const alreadyNotified = admins.some(a => a.id === teacherUserIdToNotify)
        if (!alreadyNotified) {
          await db.notification.create({
            data: {
              userId: teacherUserIdToNotify,
              title: 'Devoir créé avec succès',
              message: notifMessage,
              type: 'homework',
              category: 'homework',
              link: 'homework',
              linkParams: homework.id,
              icon: 'BookOpen',
              institutionId,
            },
          })
        }
      }

      // 2. Notify students in the class
      const studentsInClass = await db.student.findMany({
        where: { classId },
        include: { user: { select: { id: true, active: true } } },
      })
      const activeStudentUsers = studentsInClass.filter(s => s.user?.active)
      if (activeStudentUsers.length > 0) {
        await db.notification.createMany({
          data: activeStudentUsers.map(s => ({
            userId: s.user!.id,
            title: 'Nouveau devoir à rendre',
            message: notifMessage,
            type: 'homework',
            category: 'homework',
            link: 'homework',
            linkParams: homework.id,
            icon: 'BookOpen',
            institutionId,
          })),
        })
      }

      // 3. Notify parents of students in the class
      if (activeStudentUsers.length > 0) {
        const parentPhones = activeStudentUsers
          .map(s => s.parentPhone || s.parentContact)
          .filter(Boolean)

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
          if (parentUsers.length > 0) {
            await db.notification.createMany({
              data: parentUsers.map(p => ({
                userId: p.id,
                title: 'Devoir de votre enfant',
                message: notifMessage,
                type: 'homework',
                category: 'homework',
                link: 'homework',
                linkParams: homework.id,
                icon: 'BookOpen',
                institutionId,
              })),
            })
          }
        }
      }
    } catch (notifError) {
      console.error('Error creating homework notifications (non-blocking):', notifError)
      // Don't fail the homework creation if notifications fail
    }

    return NextResponse.json({ homework }, { status: 201 })
  } catch (error) {
    console.error('Create homework error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du devoir' },
      { status: 500 }
    )
  }
}
