import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkAdminOrSuperAdmin } from '@/lib/auth-guards'
import { resolveInstitutionScope, requireInstitutionScope } from '@/lib/institution-scope'

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

    const where: Record<string, unknown> = {}
    if (schoolYear) where.schoolYear = schoolYear
    if (institutionId) where.institutionId = institutionId

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

    // ---- Per-institution uniqueness ----
    // A class name only needs to be unique WITHIN an institution. Two
    // different institutions are allowed to each have a class called "1A",
    // "6ème A", etc. The check is therefore scoped by `institutionId` so
    // that creating "1A" in institution B is NOT blocked by an existing
    // "1A" that belongs to institution A.
    const existingClass = await db.class.findFirst({
      where: { name, institutionId },
    })

    if (existingClass) {
      return NextResponse.json(
        {
          error:
            'Une classe avec ce nom existe déjà dans votre établissement. ' +
            'Les autres établissements peuvent avoir une classe du même nom, ' +
            'mais le nom doit être unique au sein de votre établissement.',
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
        schoolYear: schoolYear || '2024-2025',
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
