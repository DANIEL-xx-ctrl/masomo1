import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

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
    // Super admin has full CRUD power on every page; admin & teacher can edit homework
    if (userRole !== 'admin' && userRole !== 'teacher' && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { title, description, subjectId, classId, teacherId, dueDate, assignedDate, type, status } = body

    const existing = await db.homework.findFirst({ where: { id, institutionId } })
    if (!existing) {
      return NextResponse.json({ error: 'Devoir non trouvé' }, { status: 404 })
    }

    const homework = await db.homework.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(subjectId !== undefined && { subjectId: subjectId || null }),
        ...(classId !== undefined && { classId }),
        ...(teacherId !== undefined && { teacherId: teacherId || null }),
        ...(dueDate !== undefined && { dueDate }),
        ...(assignedDate !== undefined && { assignedDate }),
        ...(type !== undefined && { type }),
        ...(status !== undefined && { status }),
      },
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
    // Super admin has full CRUD power on every page
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = await params
    const existing = await db.homework.findFirst({ where: { id, institutionId } })
    if (!existing) {
      return NextResponse.json({ error: 'Devoir non trouvé' }, { status: 404 })
    }

    await db.homework.delete({ where: { id } })
    return NextResponse.json({ message: 'Devoir supprimé avec succès' })
  } catch (error) {
    console.error('Delete homework error:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
