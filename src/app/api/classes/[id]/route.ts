import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkAdminOrSuperAdmin } from '@/lib/auth-guards'
import { resolveInstitutionScope } from '@/lib/institution-scope'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ---- Strict institution isolation ----
    const scope = await resolveInstitutionScope(request)
    if (scope instanceof NextResponse) return scope

    const { id } = await params
    const cls = await db.class.findUnique({
      where: { id },
      include: {
        _count: { select: { students: true } },
        students: {
          include: {
            user: { select: { id: true, email: true, active: true } },
          },
          orderBy: { lastName: 'asc' },
        },
        teachers: {
          include: {
            teacher: {
              select: { id: true, firstName: true, lastName: true, subject: true, image: true, updatedAt: true },
            },
          },
        },
        schedules: {
          include: {
            teacher: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    })

    if (!cls) {
      return NextResponse.json(
        { error: 'Classe non trouvée' },
        { status: 404 }
      )
    }

    // ---- Ownership check: regular users can only access classes in their own institution ----
    // Super admin can access any class (when browsing or in overview).
    if (!scope.isSuperAdmin && cls.institutionId !== scope.institutionId) {
      return NextResponse.json(
        { error: 'Accès non autorisé à cette classe.' },
        { status: 403 }
      )
    }

    const classWithCount = {
      ...cls,
      studentCount: cls._count.students,
    }

    return NextResponse.json({ class: classWithCount })
  } catch (error) {
    console.error('Get class error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la classe' },
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

    // ---- Strict institution isolation ----
    const scope = await resolveInstitutionScope(request)
    if (scope instanceof NextResponse) return scope

    const { id } = await params
    const body = await request.json()
    const { name, level, section, capacity, room, schoolYear, teachers } = body

    const existing = await db.class.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Classe non trouvée' },
        { status: 404 }
      )
    }

    // ---- Ownership check ----
    if (!scope.isSuperAdmin && existing.institutionId !== scope.institutionId) {
      return NextResponse.json(
        { error: 'Accès non autorisé à cette classe.' },
        { status: 403 }
      )
    }

    const updatedClass = await db.class.update({
      where: { id },
      data: {
        name,
        level,
        section,
        capacity,
        room,
        schoolYear,
      },
    })

    // Update teacher assignments if provided
    if (teachers !== undefined) {
      // Remove existing assignments
      await db.classTeacher.deleteMany({ where: { classId: id } })
      // Create new assignments
      if (Array.isArray(teachers) && teachers.length > 0) {
        await db.classTeacher.createMany({
          data: teachers.map((t: { teacherId: string; subject: string }) => ({
            classId: id,
            teacherId: t.teacherId,
            subject: t.subject || '',
          })),
        })
      }
    }

    return NextResponse.json({ class: updatedClass })
  } catch (error) {
    console.error('Update class error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la classe' },
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

    // ---- Strict institution isolation ----
    const scope = await resolveInstitutionScope(request)
    if (scope instanceof NextResponse) return scope

    const { id } = await params
    const existing = await db.class.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Classe non trouvée' },
        { status: 404 }
      )
    }

    // ---- Ownership check ----
    if (!scope.isSuperAdmin && existing.institutionId !== scope.institutionId) {
      return NextResponse.json(
        { error: 'Accès non autorisé à cette classe.' },
        { status: 403 }
      )
    }

    // Delete related records
    await db.classTeacher.deleteMany({ where: { classId: id } })
    await db.schedule.deleteMany({ where: { classId: id } })

    // Unlink students from this class
    await db.student.updateMany({
      where: { classId: id },
      data: { classId: null },
    })

    // Delete the class
    await db.class.delete({ where: { id } })

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Delete class error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la classe' },
      { status: 500 }
    )
  }
}
