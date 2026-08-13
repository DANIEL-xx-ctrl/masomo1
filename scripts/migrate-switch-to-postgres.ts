// ============================================================================
// migrate-switch-to-postgres.ts — Bascule schema.prisma de sqlite → postgresql
// ----------------------------------------------------------------------------
// Sauvegarde le schema.prisma actuel (avec provider="sqlite") dans
// prisma/schema.prisma.sqlite.bak, puis remplace provider="sqlite"
// par provider="postgresql".
//
// Usage : bun run migrate:switch-to-postgres
// ============================================================================

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const SCHEMA_PATH = join(process.cwd(), 'prisma', 'schema.prisma')
const BACKUP_PATH = join(process.cwd(), 'prisma', 'schema.prisma.sqlite.bak')

function main() {
  console.log('=== Bascule SQLite → PostgreSQL ===\n')

  if (!existsSync(SCHEMA_PATH)) {
    throw new Error(`Schema introuvable : ${SCHEMA_PATH}`)
  }

  const original = readFileSync(SCHEMA_PATH, 'utf8')

  // Sauvegarde
  writeFileSync(BACKUP_PATH, original)
  console.log(`✓ Sauvegarde : ${BACKUP_PATH}`)

  // Vérifie le provider actuel
  const sqliteMatch = original.match(/provider\s*=\s*"sqlite"/)
  if (!sqliteMatch) {
    const pgMatch = original.match(/provider\s*=\s*"postgresql"/)
    if (pgMatch) {
      console.log('ℹ️  Le schema utilise DÉJÀ postgresql. Rien à faire.')
      return
    }
    throw new Error('Impossible de trouver `provider = "sqlite"` dans schema.prisma')
  }

  // Remplace sqlite → postgresql
  const updated = original.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"')
  writeFileSync(SCHEMA_PATH, updated)
  console.log(`✓ schema.prisma mis à jour : provider = "postgresql"`)
  console.log('\nProchaines étapes :')
  console.log('  1. Mettez à jour .env avec DATABASE_URL="postgresql://..."')
  console.log('  2. bun run db:push   (crée les tables sur Postgres)')
  console.log('  3. bun run migrate:import  (réinjecte les données SQLite)')
}

try {
  main()
} catch (e) {
  console.error('❌ Erreur :', (e as Error).message)
  process.exit(1)
}
