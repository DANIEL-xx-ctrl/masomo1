import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'
import { getTeacherClassIds, getTeacherIdFromUserId } from '@/lib/teacher-classes'
import { resolveSubjectId } from '@/lib/subject-resolve'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const { id } = await params
    const homework = await db.homework.findFirst({
      where: { id, institutionId },
      include: {
        class: { select: { id: true, name: true, level: true, section: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        subject: { select: { id: true, name: true, code: true } },
        submissions: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { student: { lastName: 'asc' } },
        },
      },
    })

    if (!homework) {
      return NextResponse.json({ error: 'Devoir non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ homework })
  } catch (error) {
    console.error('Get homework error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const userRole = request.headers.get('x-user-role')
    const headerUserId = request.headers.get('x-user-id')
    // Super admin has full CRUD power on every page; admin & teacher can edit homework
    if (userRole !== 'admin' && userRole !== 'teacher' && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { title, description, subjectId, subjectName, classId, teacherId, dueDate, assignedDate, type, status, fileUrl, fileName } = body

    const existing = await db.homework.findFirst({ where: { id, institutionId } })
    if (!existing) {
      return NextResponse.json({ error: 'Devoir non trouvé' }, { status: 404 })
    }

    // ---- Teacher ownership check ----
    // A teacher can only modify homework they created (existing.teacherId
    // matches their Teacher.id) OR homework for a class they are currently
    // assigned to. They cannot modify homework from other teachers in
    // classes they don't teach.
    if (userRole === 'teacher' && headerUserId) {
      const ownTeacherId = await getTeacherIdFromUserId(headerUserId)
      const teacherClassIds = await getTeacherClassIds(headerUserId)
      const isOwner = ownTeacherId && existing.teacherId === ownTeacherId
      const isOwnClass = existing.classId && teacherClassIds.includes(existing.classId)
      if (!isOwner && !isOwnClass) {
        return NextResponse.json(
          { error: 'Vous ne pouvez modifier que vos propres devoirs ou les devoirs de vos classes.' },
          { status: 403 }
        )
      }
      // If changing the classId, the teacher must own the target class too
      if (classId && classId !== existing.classId && !teacherClassIds.includes(classId)) {
        return NextResponse.json(
          { error: 'Vous ne pouvez déplacer ce devoir que vers une de vos classes.' },
          { status: 403 }
        )
      }
    }

    // Resolve the subject when either subjectId or a free-text subjectName
    // is provided. If both are undefined we leave the existing subject
    // untouched.
    let updateData: Record<string, unknown> = {}
    if (subjectId !== undefined || subjectName !== undefined) {
      const finalSubjectId = await resolveSubjectId(subjectId, subjectName)
      updateData.subjectId = finalSubjectId
    }
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description || null
    if (classId !== undefined) updateData.classId = classId
    if (teacherId !== undefined) updateData.teacherId = teacherId || null
    if (dueDate !== undefined) updateData.dueDate = dueDate
    if (assignedDate !== undefined) updateData.assignedDate = assignedDate
    if (type !== undefined) updateData.type = type
    if (status !== undefined) updateData.status = status
    if (fileUrl !== undefined) updateData.fileUrl = fileUrl || null
    if (fileName !== undefined) updateData.fileName = fileName || null

    const homework = await db.homework.update({
      where: { id },
      data: updateData,
      include: {
        class: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        subject: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ homework })
  } catch (error) {
    console.error('Update homework error:', error)
    return NextResponse.json({ error: 'Erreur lors de la modification' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const userRole = request.headers.get('x-user-role')
    const headerUserId = request.headers.get('x-user-id')
    // Super admin has full CRUD power on every page; admin & teacher can delete homework
    if (userRole !== 'admin' && userRole !== 'teacher' && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = await params
    const existing = await db.homework.findFirst({ where: { id, institutionId } })
    if (!existing) {
      return NextResponse.json({ error: 'Devoir non trouvé' }, { status: 404 })
    }

    // ---- Teacher ownership check ----
    // A teacher can only delete homework they created or homework for a
    // class they are assigned to.
    if (userRole === 'teacher' && headerUserId) {
      const ownTeacherId = await getTeacherIdFromUserId(headerUserId)
      const teacherClassIds = await getTeacherClassIds(headerUserId)
      const isOwner = ownTeacherId && existing.teacherId === ownTeacherId
      const isOwnClass = existing.classId && teacherClassIds.includes(existing.classId)
      if (!isOwner && !isOwnClass) {
        return NextResponse.json(
          { error: 'Vous ne pouvez supprimer que vos propres devoirs ou les devoirs de vos classes.' },
          { status: 403 }
        )
      }
    }

    await db.homework.delete({ where: { id } })
    return NextResponse.json({ message: 'Devoir supprimé avec succès' })
  } catch (error) {
    console.error('Delete homework error:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
