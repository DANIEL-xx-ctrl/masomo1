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
 *
 * BUG FIX (issue 5): when the user switches to "primaire" while there are
 * already subjects (level='primaire') that have grades/homeworks attached,
 * the raw `db.subject.deleteMany({ where: { level: 'primaire' } })` fails
 * with a foreign-key violation (Grade.subjectId + Homework.subjectId →
 * Subject.id). To fix this, we delete the dependent rows first in a
 * transaction, then delete the subjects, then re-seed.
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

    // Fetch the current institution type to decide whether we need to
    // re-seed primary subjects (only when switching TO primaire).
    const currentInstitution = await db.institution.findUnique({
      where: { id: institutionId },
      select: { institutionType: true },
    })
    const previousType = currentInstitution?.institutionType || 'secondaire'

    await db.institution.update({
      where: { id: institutionId },
      data: { institutionType },
    })

    // If "primaire", pre-seed the RDC primary school subjects with maxima.
    // We ALWAYS delete old primary subjects first and re-seed fresh ones
    // so the degree field is properly set.
    let seededCount = 0
    if (institutionType === 'primaire') {
      // Collect the IDs of all existing primary subjects so we can safely
      // cascade-delete their dependent rows (Grade, Homework) before the
      // Subject.deleteMany() — otherwise Postgres throws a FK violation.
      const existingPrimarySubjects = await db.subject.findMany({
        where: { level: 'primaire' },
        select: { id: true },
      })
      const subjectIds = existingPrimarySubjects.map((s) => s.id)

      if (subjectIds.length > 0) {
        await db.$transaction([
          // 1. Delete all grades that point to these primary subjects.
          db.grade.deleteMany({ where: { subjectId: { in: subjectIds } } }),
          // 2. Delete all homeworks that point to these primary subjects.
          // Homework.subjectId is optional (String?) — deleting homeworks
          // is destructive but matches the user's intent when re-seeding
          // the primary curriculum.
          db.homework.deleteMany({ where: { subjectId: { in: subjectIds } } }),
          // 3. Now safe to delete the primary subjects themselves.
          db.subject.deleteMany({ where: { id: { in: subjectIds } } }),
        ])
      }

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
              title: s.title,
              subtitle: s.subtitle,
              domain: s.domain,
              degree: s.degree || null,
              level: 'primaire',
            },
          })
          seededCount++
        } catch {
          // Subject with this code may already exist (non-primary) — skip
        }
      }
    } else if (previousType === 'primaire' && institutionType !== 'primaire') {
      // Switching AWAY from primaire: keep the existing primary subjects
      // (they may have grades attached and deleting them would lose data)
      // but the institution's type has been updated above so the UI will
      // stop showing the primary-school curriculum. The admin can manually
      // delete unused primary subjects via the settings UI if desired.
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
