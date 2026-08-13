// Prisma seed script — runs the same logic as /api/seed route
// Usage: bun run prisma/seed.ts  (or: bun run db:seed)
//
// IMPORTANT (auto-seed policy):
//   The seed runs ONLY when the database has no records (fresh install).
//   If the database already contains data (institutions, users, students, ...),
//   the seed is skipped automatically to preserve existing data.
//
//   To force a full re-seed (wipe + repopulate), run:
//     FORCE_SEED=1 bun run prisma/seed.ts
//   or trigger the /api/seed route explicitly from the UI.
import { POST } from '../src/app/api/seed/route'
import { db } from '../src/lib/db'

async function isDatabaseEmpty(): Promise<boolean> {
  // Check the main entity tables. If any has records, we consider the DB non-empty.
  const counts = await Promise.all([
    db.institution.count(),
    db.user.count(),
    db.student.count(),
    db.teacher.count(),
    db.class.count(),
  ])
  const total = counts.reduce((sum, n) => sum + n, 0)
  return total === 0
}

async function main() {
  console.log('=== Démarrage du seed EduGest ===')

  // Auto-skip when the database already has data (unless FORCE_SEED=1)
  const force = process.env.FORCE_SEED === '1' || process.env.FORCE_SEED === 'true'
  if (!force) {
    try {
      const empty = await isDatabaseEmpty()
      if (!empty) {
        console.log('ℹ️  Base de données non vide — seed ignoré pour préserver les données existantes.')
        console.log('   (Pour forcer le seed, lancer: FORCE_SEED=1 bun run prisma/seed.ts)')
        process.exit(0)
      }
      console.log('✓ Base de données vide — exécution du seed...')
    } catch (e) {
      // If the count query fails (e.g. table not yet created), fall through to
      // running the seed — prisma db push will have created the tables first.
      console.warn('  [seed] vérification de l\'état de la base impossible:', (e as Error).message)
      console.log('  [seed] exécution du seed par défaut...')
    }
  } else {
    console.log('⚠️  FORCE_SEED=1 — seed forcé (les données existantes seront écrasées).')
  }

  const response = await POST()
  const data = await response.json()
  if (!response.ok) {
    console.error('Seed échoué:', data)
    process.exit(1)
  }
  console.log('✓ Seed terminé avec succès !')
  console.log(JSON.stringify(data, null, 2))
}

main().catch((e) => {
  console.error('Seed erreur:', e)
  process.exit(1)
})
