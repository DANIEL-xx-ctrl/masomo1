// ============================================================================
// migrate-import.ts — Importe les JSON exportés vers PostgreSQL (Neon-safe)
// ----------------------------------------------------------------------------
// À exécuter APRÈS :
//   1. `bun run migrate:switch-to-postgres` (bascule schema.prisma → postgresql)
//   2. Mise à jour de .env avec DATABASE_URL=postgresql://...
//   3. `bun run db:push` (crée les tables sur Postgres)
//
// Puis : `bun run migrate:import` pour réinjecter toutes les données SQLite.
//
// PROBLÈME CONNU :
//   - Neon (via le pooler) REFUSE `SET session_replication_role = 'replica'`
//     → les contraintes FK restent ACTIVES pendant l'import.
//   - SQLite n'enforce pas les FK par défaut → l'export contient souvent des
//     enregistrements ORPHELINS (qui référencent des IDs inexistants).
//   - Postgres rejette ces orphelins → erreur P2003.
//
// SOLUTION :
//   1. Importer dans un ordre respectant les dépendances FK (parents avant enfants).
//   2. Pour chaque table, FILTRER en mémoire les lignes dont les FK pointent
//      vers des IDs inexistants (orphelins). On garde un Set<string> des IDs
//      valides pour chaque table parent.
//   3. Logger les orphelins skippés (compte + exemples).
//   4. createMany({ skipDuplicates: true }) → idempotent.
// ============================================================================

import { db } from '../src/lib/db'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const IN_DIR = join(process.cwd(), 'db', 'migration-data')

// Ordre d'import respectant les dépendances FK (parents avant enfants).
const IMPORT_ORDER = [
  'SuperAdmin',
  'Institution',
  'SchoolYear',
  'User',
  'UserSession',
  'Parent',
  'Teacher',
  'Staff',
  'Class',
  'Subject',
  'Student',
  'ClassTeacher',
  'Grade',
  'Schedule',
  'Payment',
  'Attendance',
  'Bulletin',
  'Homework',
  'HomeworkSubmission',
  'Announcement',
  'Message',
  'SchoolConfig',
  'Notification',
  'SchoolEvent',
  'EventClass',
  'MediaFile',
] as const

// Définition des FK par table : { champLocal: tableParent }
// Les champs nullables sont filtrés seulement si la valeur est non-null.
type FkMap = Record<string, string>
const FK_DEPS: Record<string, FkMap> = {
  UserSession:        { userId: 'User' },
  Parent:             { userId: 'User' },
  Teacher:            { userId: 'User' },
  Staff:              { userId: 'User' },
  Student:            { userId: 'User', classId: 'Class', parentId: 'Parent' },
  Class:              { institutionId: 'Institution' },
  ClassTeacher:       { classId: 'Class', teacherId: 'Teacher' },
  Grade:              { studentId: 'Student', subjectId: 'Subject', classId: 'Class', teacherId: 'Teacher' },
  Schedule:           { classId: 'Class', teacherId: 'Teacher' },
  Payment:            { studentId: 'Student' },
  Attendance:         { studentId: 'Student' },
  Bulletin:           { studentId: 'Student', classId: 'Class' },
  Homework:           { classId: 'Class', teacherId: 'Teacher', subjectId: 'Subject', institutionId: 'Institution' },
  HomeworkSubmission: { homeworkId: 'Homework', studentId: 'Student' },
  Announcement:       { authorId: 'User' },
  Message:            { senderId: 'User', receiverId: 'User' },
  SchoolConfig:       { institutionId: 'Institution' },
  Notification:       { userId: 'User' },
  SchoolYear:         { institutionId: 'Institution' },
  EventClass:         { eventId: 'SchoolEvent', classId: 'Class' },
  MediaFile:          { institutionId: 'Institution' },
}

// Sets d'IDs valides par table (remplis au fur et à mesure de l'import).
const validIds: Record<string, Set<string>> = {}

function rowId(row: any): string | undefined {
  return row?.id ?? row?._id ?? undefined
}

// Vérifie si une ligne respecte toutes ses FK (en mémoire).
// Retourne { ok: boolean, missingFk: string }
function checkFk(model: string, row: any): { ok: boolean; missingFk: string } {
  const deps = FK_DEPS[model]
  if (!deps) return { ok: true, missingFk: '' }
  for (const [field, parentTable] of Object.entries(deps)) {
    const value = row?.[field]
    if (value === null || value === undefined || value === '') continue // champ nullable
    const parentSet = validIds[parentTable]
    if (!parentSet || !parentSet.has(String(value))) {
      return { ok: false, missingFk: `${model}.${field} → ${parentTable}.id (${value})` }
    }
  }
  return { ok: true, missingFk: '' }
}

async function importTable(name: string): Promise<{ imported: number; skipped: number; total: number }> {
  const fileName = `${name}.json`
  const filePath = join(IN_DIR, fileName)

  if (!existsSync(filePath)) {
    console.log(`  ⊘ ${name.padEnd(25)} aucun fichier — ignoré`)
    return { imported: 0, skipped: 0, total: 0 }
  }

  const rows: any[] = JSON.parse(readFileSync(filePath, 'utf8'))
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`  ⊘ ${name.padEnd(25)} 0 lignes — ignoré`)
    return { imported: 0, skipped: 0, total: 0 }
  }

  // Filtrer les orphelins (FK cassées)
  const deps = FK_DEPS[name]
  let skipped = 0
  const kept: any[] = []
  if (deps) {
    for (const row of rows) {
      const { ok, missingFk } = checkFk(name, row)
      if (ok) {
        kept.push(row)
      } else {
        skipped++
        if (skipped <= 3) {
          console.log(`    ↳ orphelin skippé : ${missingFk} (id=${rowId(row) ?? '?'})`)
        }
      }
    }
    if (skipped > 3) {
      console.log(`    ↳ ... et ${skipped - 3} autre(s) orphelin(s) skippé(s)`)
    }
  } else {
    kept.push(...rows)
  }

  if (kept.length === 0) {
    console.log(`  ⊘ ${name.padEnd(25)} 0/${rows.length} (tous orphelins ou vides)`)
    return { imported: 0, skipped, total: rows.length }
  }

  try {
    // @ts-expect-error — accès dynamique au modèle Prisma
    const result = await (db[name] as { createMany: (args: { data: any[]; skipDuplicates: boolean }) => Promise<{ count: number }> }).createMany({
      data: kept,
      skipDuplicates: true,
    })
    const imported = result.count

    // Enregistrer les IDs importés dans le Set (pour les FK des tables enfants)
    if (!validIds[name]) validIds[name] = new Set()
    for (const row of kept) {
      const id = rowId(row)
      if (id) validIds[name].add(String(id))
    }

    const skipNote = skipped > 0 ? ` (${skipped} orphelin(s) skippé(s))` : ''
    console.log(`  ✓ ${name.padEnd(25)} ${String(imported).padStart(6)}/${rows.length}${skipNote}`)
    return { imported, skipped, total: rows.length }
  } catch (e) {
    const msg = (e as Error).message.split('\n')[0]
    console.error(`  ✗ ${name.padEnd(25)} ERREUR : ${msg}`)
    return { imported: 0, skipped, total: rows.length }
  }
}

async function main() {
  console.log('=== Import JSON → PostgreSQL (Neon-safe, FK-filtering) ===\n')

  if (!existsSync(IN_DIR)) {
    throw new Error(`Dossier introuvable : ${IN_DIR}\nExécutez d'abord : bun run migrate:export`)
  }

  // Pré-charger les IDs existants dans Postgres (au cas où une partie aurait déjà été importée)
  // pour que les FK des tables enfants restent valides.
  console.log('Pré-chargement des IDs existants depuis Postgres...\n')
  let totalExisting = 0
  for (const model of IMPORT_ORDER) {
    try {
      // @ts-expect-error — accès dynamique
      const rows = await (db[model] as { findMany: (args: { select: { id: boolean } }) => Promise<Array<{ id: string }>> }).findMany({ select: { id: true } })
      validIds[model] = new Set(rows.map((r) => String(r.id)))
      totalExisting += validIds[model].size
      if (validIds[model].size > 0) {
        console.log(`  ↳ ${model.padEnd(25)} ${String(validIds[model].size).padStart(6)} IDs existants`)
      }
    } catch {
      // Modèle sans champ id (rare) — on ignore
    }
  }
  console.log('')

  // DÉTECTION DE CONFLIT : si la base contient déjà beaucoup de données,
  // il y a un risque de conflit d'IDs/uniques avec l'import. On alerte.
  if (totalExisting > 0) {
    console.log(`⚠️  ATTENTION : La base Postgres contient DÉJÀ ${totalExisting} enregistrements.`)
    console.log('   Si ces données proviennent d\'un import précédent avec des IDs DIFFÉRENTS,')
    console.log('   vos nouvelles lignes risquent d\'être skippées (skipDuplicates) ou rejetées')
    console.log('   par les contraintes uniques (email, password).')
    console.log('')
    console.log('   → Si vous voulez REMPLACER les données existantes, VIDEZ d\'abord la base :')
    console.log('       bun run db:wipe')
    console.log('   → Si vous voulez AJOUTER aux données existantes (IDs différents), continuez.')
    console.log('')
  }

  let totalImported = 0
  let totalSkipped = 0
  const summary: Array<{ model: string; imported: number; skipped: number; total: number }> = []

  for (const name of IMPORT_ORDER) {
    const result = await importTable(name)
    totalImported += result.imported
    totalSkipped += result.skipped
    summary.push({ model: name, ...result })
  }

  // DÉTECTION POST-IMPORT : si on a skippé beaucoup d'orphelins ET que la base
  // avait déjà des données, c'est probablement le scénario de conflit d'IDs.
  if (totalSkipped > 50 && totalExisting > 0) {
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`⚠️  ALERTE : ${totalSkipped} orphelins skippés sur une base qui contenait déjà ${totalExisting} enregistrements.`)
    console.log('   Cause probable : la base contient des données d\'un import PRÉCÉDENT')
    console.log('   avec des IDs DIFFÉRENTS de votre export JSON actuel.')
    console.log('')
    console.log('   SOLUTION : videz la base puis réimportez :')
    console.log('     bun run db:wipe     # supprime toutes les lignes existantes')
    console.log('     bun run migrate:import   # import propre sur base vide')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }

  console.log(`\n✅ Import terminé : ${totalImported} lignes importées, ${totalSkipped} orphelins skippés.`)
  console.log('\nRésumé :')
  for (const s of summary) {
    // ✓ = tout est OK (tout importé, OU tout déjà présent en base, OU table vide)
    // ⚠ = partiel (orphelins skippés ou erreurs)
    // ✗ = rien importé alors qu'il y avait des données à importer
    const alreadyInDb = validIds[s.model]?.size ?? 0
    const present = s.imported + alreadyInDb
    const status = present >= s.total || s.total === 0 ? '✓'
      : s.imported === 0 && s.skipped === 0 ? '✗'
      : '⚠'
    const skip = s.skipped > 0 ? ` (orph:${s.skipped})` : ''
    const note = s.imported === 0 && alreadyInDb > 0 ? ` (déjà en base: ${alreadyInDb})` : ''
    console.log(`  ${status} ${s.model.padEnd(25)} ${String(s.imported).padStart(6)}/${s.total}${skip}${note}`)
  }
}

main()
  .catch((e) => {
    console.error('❌ Erreur import :', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
