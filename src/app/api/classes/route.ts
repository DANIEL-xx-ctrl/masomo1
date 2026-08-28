import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkAdminOrSuperAdmin } from '@/lib/auth-guards'
import { resolveInstitutionScope, requireInstitutionScope } from '@/lib/institution-scope'
import { getTeacherClassIds } from '@/lib/teacher-classes'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolYear = searchParams.get('schoolYear')

    // ---- Strict institution isolation ----
    // Regular users see ONLY their own institution's classes. Super admin
    // sees the browsed institution's classes, or ALL classes when in overview
    // mode (institutionId = null → no filter).
    const scope = await resolveInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId
    const role = scope.role
    const userId = scope.userId

    const where: Record<string, unknown> = {}
    if (schoolYear) where.schoolYear = schoolYear
    if (institutionId) where.institutionId = institutionId

    // ---- Teacher scoping ----
    // A teacher should only see the classes they are assigned to (via the
    // ClassTeacher join table). Admin and super_admin see all classes in the
    // institution. This prevents a teacher from viewing/modifying classes
    // they don't teach.
    if (role === 'teacher' && userId) {
      const teacherClassIds = await getTeacherClassIds(userId, schoolYear)
      if (teacherClassIds.length > 0) {
        where.id = { in: teacherClassIds }
      } else {
        // Teacher has no class assignments — return empty
        return NextResponse.json({ classes: [] })
      }
    }

    const classes = await db.class.findMany({
      where,
      include: {
        _count: {
          select: { students: true },
        },
        teachers: {
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                subject: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const classesWithCount = classes.map((cls) => ({
      ...cls,
      studentCount: cls._count.students,
    }))

    return NextResponse.json({ classes: classesWithCount })
  } catch (error) {
    console.error('Get classes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des classes' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const forbidden = checkAdminOrSuperAdmin(request)
    if (forbidden) return forbidden

    // ---- Strict institution isolation ----
    // The new class is created in the caller's institution (for regular users)
    // or in the browsed institution (for super admin). Super admin MUST be
    // browsing an institution to create a class — they can't create a class
    // in "overview" mode.
    const scope = await requireInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId

    const body = await request.json()
    const { name, level, section, capacity, schoolYear, room, teachers } = body

    if (!name || !level) {
      return NextResponse.json(
        { error: 'Nom et niveau requis' },
        { status: 400 }
      )
    }

    // ---- Per-institution + per-schoolYear uniqueness ----
    // A class name must be unique WITHIN an institution AND within a school
    // year. This allows the same class name (e.g. "6ème A") to be created
    // again each new school year with different students — the schoolYear
    // distinguishes them. Two different institutions can also share a name.
    const effectiveSchoolYear = schoolYear || '2024-2025'
    const existingClass = await db.class.findFirst({
      where: { name, institutionId, schoolYear: effectiveSchoolYear },
    })

    if (existingClass) {
      return NextResponse.json(
        {
          error:
            `Une classe avec ce nom existe déjà pour l'année scolaire ${effectiveSchoolYear}. ` +
            'Vous pouvez créer une classe du même nom pour une autre année scolaire.',
        },
        { status: 409 }
      )
    }

    const newClass = await db.class.create({
      data: {
        name,
        level,
        section,
        capacity: capacity || 30,
        schoolYear: effectiveSchoolYear,
        room,
        institutionId: institutionId!,
      },
    })

    // Create teacher assignments if provided
    if (teachers && Array.isArray(teachers) && teachers.length > 0) {
      await db.classTeacher.createMany({
        data: teachers.map((t: { teacherId: string; subject: string }) => ({
          classId: newClass.id,
          teacherId: t.teacherId,
          subject: t.subject || '',
        })),
      })
    }

    return NextResponse.json({ class: newClass }, { status: 201 })
  } catch (error) {
    console.error('Create class error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la classe' },
      { status: 500 }
    )
  }
}
