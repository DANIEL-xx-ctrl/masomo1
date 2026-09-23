import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { resolveInstitutionScope } from '@/lib/institution-scope'

/**
 * GET /api/settings/institution-type
 * Returns the current institution type + available options.
 */
export async function GET(request: Request) {
  try {
    const scope = await resolveInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId

    const institution = await db.institution.findUnique({
      where: { id: institutionId || '' },
      select: { id: true, name: true, institutionType: true },
    })

    if (!institution) {
      return NextResponse.json({ error: 'Institution non trouvée' }, { status: 404 })
    }

    return NextResponse.json({
      institution: {
        id: institution.id,
        name: institution.name,
        institutionType: institution.institutionType || 'secondaire',
      },
      types: [
        { value: 'primaire', label: 'École Primaire' },
        { value: 'secondaire', label: 'École Secondaire' },
        { value: 'universite', label: 'Université' },
      ],
    })
  } catch (error) {
    console.error('Get institution type error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/settings/institution-type
 * Body: { institutionType: "primaire" | "secondaire" | "universite" }
 * Updates the institution type. If "primaire" is selected, pre-seeds the
 * RDC primary school subjects with maxima if they don't exist yet.
 */
export async function PATCH(request: Request) {
  try {
    const scope = await resolveInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId

    if (!institutionId) {
      return NextResponse.json({ error: 'Institution non trouvée' }, { status: 404 })
    }

    const body = await request.json()
    const { institutionType } = body

    const validTypes = ['primaire', 'secondaire', 'universite']
    if (!validTypes.includes(institutionType)) {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    }

    await db.institution.update({
      where: { id: institutionId },
      data: { institutionType },
    })

    // If "primaire", pre-seed the RDC primary school subjects with maxima
    // (only if they don't already exist — we check by code prefix).
    let seededCount = 0
    if (institutionType === 'primaire') {
      const existing = await db.subject.count({
        where: { level: 'primaire' },
      })
      if (existing === 0) {
        const { PRIMARY_SUBJECTS } = await import('@/lib/primary-subjects')
        for (const s of PRIMARY_SUBJECTS) {
          try {
            await db.subject.create({
              data: {
                name: s.name,
                code: s.code,
                coefficient: s.coefficient || 1,
                maxTJ: s.maxTJ,
                maxEX: s.maxEX,
                maxTRIM: s.maxTRIM,
                maxAnnuel: s.maxAnnuel,
                domain: s.domain,
                degree: s.degree || null,
                level: 'primaire',
              },
            })
            seededCount++
          } catch {
            // Subject with this code may already exist — skip
          }
        }
      }
    }

    return NextResponse.json({
      message: `Type d'institution mis à jour : ${institutionType}`,
      institutionType,
      seededSubjects: seededCount,
    })
  } catch (error) {
    console.error('Update institution type error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

