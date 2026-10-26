import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { resolveInstitutionScope } from '@/lib/institution-scope'

export async function GET(request: Request) {
  try {
    // Determine the institution type so we can filter subjects by level.
    // When the institution is "primaire", we show subjects with level="primaire"
    // (the RDC pre-seeded subjects with maxima). For "secondaire"/"universite"
    // we show all subjects that are NOT tagged as "primaire".
    const scope = await resolveInstitutionScope(request)
    const institutionId = scope?.institutionId

    let institutionType = 'secondaire'
    if (institutionId) {
      const inst = await db.institution.findUnique({
        where: { id: institutionId },
        select: { institutionType: true },
      })
      institutionType = inst?.institutionType || 'secondaire'
    }

    // Build the where clause based on institution type:
    // - primaire: show subjects with level="primaire" OR level=null (legacy subjects)
    // - secondaire/universite: show subjects with level != "primaire" (includes null/legacy)
    const where = institutionType === 'primaire'
      ? { OR: [{ level: 'primaire' }, { level: null }] }
      : { OR: [{ level: { not: 'primaire' } }, { level: null }] }

    const subjects = await db.subject.findMany({
      where,
      include: {
        _count: {
          select: { grades: true },
        },
      },
      // Tri hiérarchique : titre → sous-titre → matière
      orderBy: [{ title: 'asc' }, { subtitle: 'asc' }, { name: 'asc' }],
    })

    const subjectsWithCount = subjects.map((subject) => ({
      ...subject,
      gradeCount: subject._count.grades,
    }))

    return NextResponse.json({ subjects: subjectsWithCount, institutionType })
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
    const { name, code, coefficient, title, subtitle, domain, degree, level, maxTJ, maxEX, maxTRIM, maxAnnuel } = body

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
        title: title ?? null,
        subtitle: subtitle ?? null,
        // Si domain n'est pas fourni mais title l'est, on utilise title comme domain (compatibilité arrière)
        domain: domain ?? title ?? null,
        degree: degree ?? null,
        level: level ?? null,
        maxTJ: maxTJ ?? null,
        maxEX: maxEX ?? null,
        maxTRIM: maxTRIM ?? null,
        maxAnnuel: maxAnnuel ?? null,
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
