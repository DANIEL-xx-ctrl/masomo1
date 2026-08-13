// ============================================================================
// Next.js Instrumentation Hook — Auto-seed + ensure SuperAdmin
// ----------------------------------------------------------------------------
// Runs ONCE when the Node.js server instance starts (before the first request).
//
// Two safety nets:
// 1. If the database has NO institutions, trigger the full seed (creates
//    3 demo institutions + SuperAdmin + users + students + grades + ...).
// 2. If the database has institutions but the SuperAdmin is missing (e.g.
//    user imported a partial DB), call /api/ensure-superadmin to recreate
//    the demo SuperAdmin account (superadmin@edugest.com / super123).
//
// This guarantees that a freshly-cloned/restored project is immediately
// usable with the known demo credentials, regardless of the DB state.
// ============================================================================

let seedRan = false

export async function register() {
  // Only run on the Node.js runtime (Prisma needs Node, not Edge).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Skip during `next build`.
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  // Guard against double execution in dev (HMR / fast refresh restarts).
  if (seedRan) return
  seedRan = true

  try {
    const { db } = await import('@/lib/db')

    const institutionCount = await db.institution.count()

    if (institutionCount === 0) {
      console.log(
        '[instrumentation] Base de données vide — exécution du seed automatique...'
      )
      const { POST } = await import('@/app/api/seed/route')
      const start = Date.now()
      const response = await POST()
      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data === 'object' && data && 'error' in data
            ? String((data as { error: unknown }).error)
            : 'Réponse seed non-OK'
        )
      }

      const stats = (data as { stats?: Record<string, number> }).stats
      const duration = ((Date.now() - start) / 1000).toFixed(1)
      console.log(
        `[instrumentation] Seed automatique terminé en ${duration}s — ` +
          (stats
            ? `${stats.institutions ?? 0} institution(s), ` +
              `${stats.users ?? 0} utilisateur(s), ` +
              `${stats.students ?? 0} élève(s), ` +
              `${stats.teachers ?? 0} enseignant(s), ` +
              `${stats.classes ?? 0} classe(s).`
            : 'terminé.')
      )
    } else {
      console.log(
        `[instrumentation] DB déjà peuplée (${institutionCount} institution(s)) — auto-seed ignoré.`
      )
    }

    // ---- Safety net 2: Ensure SuperAdmin exists with correct credentials ----
    // This handles the case where the DB has institutions but the SuperAdmin
    // is missing or has a wrong password (e.g. partial import, manual edit).
    const saCount = await db.superAdmin.count()
    if (saCount === 0) {
      console.log(
        '[instrumentation] SuperAdmin manquant — création du compte de démo...'
      )
      await db.superAdmin.create({
        data: {
          name: 'Super Administrateur',
          email: 'superadmin@edugest.com',
          password: 'super123',
          active: true,
        },
      })
      console.log(
        '[instrumentation] SuperAdmin créé : superadmin@edugest.com / super123'
      )
    } else {
      // Verify the demo SuperAdmin exists with the correct password
      const sa = await db.superAdmin.findUnique({
        where: { email: 'superadmin@edugest.com' },
      })
      if (!sa || sa.password !== 'super123' || !sa.active) {
        console.log(
          '[instrumentation] SuperAdmin de démo incorrect — correction...'
        )
        if (!sa) {
          await db.superAdmin.create({
            data: {
              name: 'Super Administrateur',
              email: 'superadmin@edugest.com',
              password: 'super123',
              active: true,
            },
          })
        } else {
          await db.superAdmin.update({
            where: { email: 'superadmin@edugest.com' },
            data: {
              password: 'super123',
              active: true,
              name: sa.name || 'Super Administrateur',
            },
          })
        }
        console.log(
          '[instrumentation] SuperAdmin corrigé : superadmin@edugest.com / super123'
        )
      }
    }
  } catch (error) {
    // Never crash the server because of a seed failure — log and continue.
    console.error(
      '[instrumentation] Échec du seed automatique:',
      error instanceof Error ? error.message : error
    )
  }
}
