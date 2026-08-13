// ============================================================================
// db-wipe.ts — Vide TOUTES les tables PostgreSQL (Neon) dans le bon ordre FK
// ----------------------------------------------------------------------------
// À exécuter AVANT migrate:import quand la base Neon contient déjà des données
// d'un import précédent (avec des IDs différents) et qu'on veut repartir de zéro.
//
// Usage : bun run db:wipe
//
// ATTENTION : Cette opération est IRRÉVERSIBLE. Toutes les données sont supprimées.
// ============================================================================

import { db } from '../src/lib/db'
import { Prisma } from '@prisma/client'

// Ordre inverse des dépendances FK : on supprime les enfants avant les parents.
const WIPE_ORDER = [
  'EventClass',
  'HomeworkSubmission',
  'Homework',
  'Notification',
  'Message',
  'Announcement',
  'Bulletin',
  'Attendance',
  'Payment',
  'Schedule',
  'Grade',
  'ClassTeacher',
  'Student',
  'Subject',
  'Class',
  'Staff',
  'Teacher',
  'Parent',
  'UserSession',
  'User',
  'SchoolConfig',
  'SchoolEvent',
  'SchoolYear',
  'MediaFile',
  'Institution',
  'SuperAdmin',
] as const

async function main() {
  console.log('=== WIPE PostgreSQL (Neon) ===\n')
  console.log('⚠️  ATTENTION : toutes les données vont être SUPPRIMÉES.\n')

  // Tenter de désactiver les FK (Neon pooler peut refuser — on continue quand même)
  let fkDisabled = false
  try {
    await db.$executeRawUnsafe(`SET session_replication_role = 'replica'`)
    console.log('✓ Contraintes FK désactivées (mode replica).\n')
    fkDisabled = true
  } catch (e) {
    console.warn('  ⚠️  Désactivation FK impossible (Neon pooler).')
    console.warn('     → On supprime dans l\'ordre inverse des FK.\n')
  }

  const summary: Array<{ model: string; deleted: number }> = []
  let totalDeleted = 0

  for (const name of WIPE_ORDER) {
    try {
      // @ts-expect-error — accès dynamique au modèle Prisma
      const result = await (db[name] as { deleteMany: (args?: { where?: unknown }) => Promise<{ count: number }> }).deleteMany({})
      const count = result.count
      totalDeleted += count
      summary.push({ model: name, deleted: count })
      const mark = count > 0 ? '🗑' : '⊘'
      console.log(`  ${mark} ${name.padEnd(25)} ${String(count).padStart(6)} lignes supprimées`)
    } catch (e) {
      const msg = (e as Error).message.split('\n')[0]
      console.error(`  ✗ ${name.padEnd(25)} ERREUR : ${msg}`)
      summary.push({ model: name, deleted: 0 })
    }
  }

  // Réactiver les FK si elles avaient été désactivées
  if (fkDisabled) {
    try {
      await db.$executeRawUnsafe(`SET session_replication_role = 'origin'`)
      console.log('\n✓ Contraintes FK réactivées (mode origin).')
    } catch (e) {
      console.warn('  ⚠️  Impossible de réactiver les FK :', (e as Error).message.split('\n')[0])
    }
  }

  // Réinitialiser les séquences Postgres (pour que les AUTOINCREMENT repartent de 0)
  // Prisma utilise cuid() par défaut, donc pas strictement nécessaire, mais c'est plus propre.
  try {
    // Récupère toutes les séquences et les réinitialise
    await db.$executeRawUnsafe(`
      SELECT setval(pg_get_serial_sequence('"' || table_name || '"', column_name), 1, false)
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_default LIKE 'nextval%'
    `)
    console.log('✓ Séquences Postgres réinitialisées.')
  } catch {
    // Ignorer — pas critique
  }

  console.log(`\n✅ Wipe terminé : ${totalDeleted} lignes supprimées au total.`)
  console.log('\nVous pouvez maintenant lancer : bun run migrate:import')
}

main()
  .catch((e) => {
    console.error('❌ Erreur wipe :', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
