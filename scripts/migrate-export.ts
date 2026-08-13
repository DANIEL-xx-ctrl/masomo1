// ============================================================================
// migrate-export.ts — Exporte toutes les tables SQLite vers des fichiers JSON
// ----------------------------------------------------------------------------
// À exécuter AVANT de basculer sur PostgreSQL :
//   bun run migrate:export
//
// Produit : db/migration-data/<ModelName>.json pour chaque modèle Prisma.
// Ces fichiers seront réimportés vers PostgreSQL par migrate-import.ts.
// ============================================================================

import { db } from '../src/lib/db'
import { Prisma } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT_DIR = join(process.cwd(), 'db', 'migration-data')

async function main() {
  console.log('=== Export SQLite → JSON ===\n')
  mkdirSync(OUT_DIR, { recursive: true })

  // Liste tous les modèles du Datamodel Prisma dans l'ordre du schema.
  // On utilise le DMMF pour ne rien oublier.
  const models = Prisma.dmmf.datamodel.models

  console.log(`${models.length} modèles détectés.`)

  let totalRows = 0
  const summary: Array<{ model: string; count: number }> = []

  for (const model of models) {
    const name = model.name
    // @ts-expect-error — accès dynamique au modèle Prisma
    const rows = await (db[name] as { findMany: () => Promise<unknown[]> }).findMany()
    const filePath = join(OUT_DIR, `${name}.json`)
    writeFileSync(filePath, JSON.stringify(rows, null, 2))
    totalRows += rows.length
    summary.push({ model: name, count: rows.length })
    console.log(`  ✓ ${name.padEnd(25)} ${String(rows.length).padStart(6)} lignes  → ${filePath}`)
  }

  writeFileSync(
    join(OUT_DIR, '_summary.json'),
    JSON.stringify({ exportedAt: new Date().toISOString(), totalRows, summary }, null, 2)
  )

  console.log(`\n✅ Export terminé : ${totalRows} lignes réparties sur ${models.length} tables.`)
  console.log(`   Dossier : ${OUT_DIR}`)
}

main()
  .catch((e) => {
    console.error('❌ Erreur export :', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
