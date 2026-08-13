import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const subjects = await db.subject.findMany({
      include: {
        _count: {
          select: { grades: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const subjectsWithCount = subjects.map((subject) => ({
      ...subject,
      gradeCount: subject._count.grades,
    }))

    return NextResponse.json({ subjects: subjectsWithCount })
  } catch (error) {
    console.error('Get subjects error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des matières' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, code, coefficient } = body

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Nom et code requis' },
        { status: 400 }
      )
    }

    const existingSubject = await db.subject.findUnique({
      where: { code },
    })

    if (existingSubject) {
      return NextResponse.json(
        { error: 'Une matière avec ce code existe déjà' },
        { status: 409 }
      )
    }

    const subject = await db.subject.create({
      data: {
        name,
        code,
        coefficient: coefficient || 1,
      },
    })

    return NextResponse.json({ subject }, { status: 201 })
  } catch (error) {
    console.error('Create subject error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la matière' },
      { status: 500 }
    )
  }
}
