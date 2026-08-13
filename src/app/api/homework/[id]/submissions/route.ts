import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const submissions = await db.homeworkSubmission.findMany({
      where: { homeworkId: id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { student: { lastName: 'asc' } },
    })

    return NextResponse.json({ submissions })
  } catch (error) {
    console.error('Get submissions error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { studentId, content, status } = body

    if (!studentId) {
      return NextResponse.json({ error: 'ID élève requis' }, { status: 400 })
    }

    // Check homework exists
    const homework = await db.homework.findUnique({ where: { id } })
    if (!homework) {
      return NextResponse.json({ error: 'Devoir non trouvé' }, { status: 404 })
    }

    const submission = await db.homeworkSubmission.upsert({
      where: {
        homeworkId_studentId: { homeworkId: id, studentId },
      },
      create: {
        homeworkId: id,
        studentId,
        content: content || null,
        status: status || 'submitted',
        submittedAt: new Date().toISOString(),
      },
      update: {
        content: content !== undefined ? content : undefined,
        status: status || 'submitted',
        submittedAt: new Date().toISOString(),
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json({ submission }, { status: 201 })
  } catch (error) {
    console.error('Create submission error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
