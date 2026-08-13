import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const classId = searchParams.get('classId')
    const trimester = searchParams.get('trimester')
    const schoolYear = searchParams.get('schoolYear')

    const where: Record<string, unknown> = {}

    if (studentId) where.studentId = studentId
    if (classId) where.classId = classId
    if (trimester) where.trimester = trimester
    if (schoolYear) where.schoolYear = schoolYear

    const bulletins = await db.bulletin.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            class: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ bulletins })
  } catch (error) {
    console.error('Get bulletins error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des bulletins' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { studentId, classId, trimester, schoolYear } = body

    if (!studentId || !trimester) {
      return NextResponse.json(
        { error: 'studentId et trimester requis' },
        { status: 400 }
      )
    }

    // Fetch all grades for this student in this trimester
    const grades = await db.grade.findMany({
      where: {
        studentId,
        trimester,
        schoolYear: schoolYear || '2024-2025',
      },
      include: {
        subject: true,
      },
    })

    if (grades.length === 0) {
      return NextResponse.json(
        { error: 'Aucune note trouvée pour ce trimestre' },
        { status: 404 }
      )
    }

    // Calculate weighted average
    let totalWeighted = 0
    let totalCoeff = 0

    for (const grade of grades) {
      const coeff = grade.subject.coefficient || 1
      totalWeighted += (grade.value / grade.maxValue) * 20 * coeff
      totalCoeff += coeff
    }

    const average = totalCoeff > 0 ? totalWeighted / totalCoeff : 0

    // Determine appreciation
    let appreciation = ''
    if (average >= 16) appreciation = 'Très bien'
    else if (average >= 14) appreciation = 'Bien'
    else if (average >= 12) appreciation = 'Assez bien'
    else if (average >= 10) appreciation = 'Passable'
    else appreciation = 'Insuffisant'

    // Calculate rank among classmates
    const classmates = await db.student.findMany({
      where: { classId: classId || undefined },
      select: { id: true },
    })

    const classmateIds = classmates.map((s) => s.id)

    // Get averages for all classmates
    const allGrades = await db.grade.findMany({
      where: {
        studentId: { in: classmateIds },
        trimester,
        schoolYear: schoolYear || '2024-2025',
      },
      include: { subject: true },
    })

    const studentAverages = new Map<string, { totalWeighted: number; totalCoeff: number }>()

    for (const g of allGrades) {
      const existing = studentAverages.get(g.studentId) || { totalWeighted: 0, totalCoeff: 0 }
      const coeff = g.subject.coefficient || 1
      existing.totalWeighted += (g.value / g.maxValue) * 20 * coeff
      existing.totalCoeff += coeff
      studentAverages.set(g.studentId, existing)
    }

    const averages: { studentId: string; average: number }[] = []
    studentAverages.forEach((val, key) => {
      averages.push({
        studentId: key,
        average: val.totalCoeff > 0 ? val.totalWeighted / val.totalCoeff : 0,
      })
    })

    averages.sort((a, b) => b.average - a.average)
    const rank = averages.findIndex((a) => a.studentId === studentId) + 1

    const bulletin = await db.bulletin.create({
      data: {
        studentId,
        classId,
        trimester,
        schoolYear: schoolYear || '2024-2025',
        average: Math.round(average * 100) / 100,
        rank: rank > 0 ? rank : null,
        appreciation,
        generatedAt: new Date().toISOString().split('T')[0],
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            class: true,
          },
        },
      },
    })

    return NextResponse.json({ bulletin }, { status: 201 })
  } catch (error) {
    console.error('Create bulletin error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du bulletin' },
      { status: 500 }
    )
  }
}
