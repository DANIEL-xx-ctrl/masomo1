import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getTeacherClassIds, getTeacherIdFromUserId } from '@/lib/teacher-classes'

/**
 * Guard helper: when the caller is a teacher, verify they own the grade
 * they are trying to modify. A teacher "owns" a grade when:
 *   - the grade's classId is one of the teacher's assigned classes, OR
 *   - the grade was recorded by that teacher (grade.teacherId matches).
 *
 * Returns `null` when access is granted, or a 403 NextResponse otherwise.
 */
async function guardTeacherOwnership(
  request: Request,
  grade: { classId: string | null; teacherId: string | null },
  schoolYear: string | undefined,
): Promise<NextResponse | null> {
  const role = request.headers.get('x-user-role') || ''
  const userId = request.headers.get('x-user-id') || ''
  if (role !== 'teacher' || !userId) return null // admins/super_admins bypass

  const teacherClassIds = await getTeacherClassIds(userId, schoolYear)
  const ownTeacherId = await getTeacherIdFromUserId(userId)

  const ownsByClass = grade.classId ? teacherClassIds.includes(grade.classId) : false
  const ownsByTeacher = !!(ownTeacherId && grade.teacherId === ownTeacherId)

  if (!ownsByClass && !ownsByTeacher) {
    return NextResponse.json(
      { error: "Vous ne pouvez modifier que les notes de vos propres classes." },
      { status: 403 }
    )
  }
  return null
}

function resolveSchoolYear(request: Request): string | undefined {
  const fromHeader = request.headers.get('x-school-year')
  return fromHeader || undefined
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { value, maxValue, type, comment, date } = body

    const existing = await db.grade.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Note introuvable' }, { status: 404 })
    }

    const schoolYear = resolveSchoolYear(request) || existing.schoolYear
    const forbidden = await guardTeacherOwnership(request, existing, schoolYear)
    if (forbidden) return forbidden

    const updated = await db.grade.update({
      where: { id },
      data: {
        ...(value !== undefined ? { value: parseFloat(String(value)) } : {}),
        ...(maxValue !== undefined ? { maxValue: parseFloat(String(maxValue)) } : {}),
        ...(type ? { type } : {}),
        ...(comment !== undefined ? { comment } : {}),
        ...(date ? { date } : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        subject: true,
      },
    })

    return NextResponse.json({ grade: updated })
  } catch (error) {
    console.error('Update grade error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification de la note' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.grade.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Note introuvable' }, { status: 404 })
    }

    const schoolYear = resolveSchoolYear(request) || existing.schoolYear
    const forbidden = await guardTeacherOwnership(request, existing, schoolYear)
    if (forbidden) return forbidden

    await db.grade.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete grade error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la note' },
      { status: 500 }
    )
  }
}
