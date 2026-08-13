/**
 * clean-db.ts
 * ----------------------------------------------------------------------------
 * Auto-réparateur de base SQLite pour EduGest.
 *
 * Corrige définitivement l'erreur "database disk image is malformed" (SQLite
 * error 11) qui survient quand un fichier .db a été partiellement écrit, copié
 * pendant une transaction, ou transféré via un canal non binaire.
 *
 * Comportement :
 *   1. Localise la base SQLite déclarée dans DATABASE_URL (file:./xxx.db).
 *   2. Si le fichier n'existe pas -> rien à faire (fresh start via prisma).
 *   3. Si le fichier existe -> ouvre en lecture seule avec bun:sqlite et lance
 *      `PRAGMA integrity_check;`.
 *   4. Si l'intégrité est OK -> on préserve la base (données conservées).
 *   5. Si l'intégrité est KO -> on supprime le .db, le -wal et le -shm pour
 *      forcer une recréation propre par `prisma db push`.
 *
 * Aucune dépendance externe : utilise uniquement `bun:sqlite` et `node:fs`.
 * Lancé automatiquement avant `prisma db push` via le script `predev`.
 * ----------------------------------------------------------------------------
 */
import { Database } from "bun:sqlite";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

function resolveDbPath(): string | null {
  const raw = process.env.DATABASE_URL ?? "file:./db/custom.db";
  const stripped = raw.replace(/^file:/, "");
  // Résout par rapport au cwd (racine du projet)
  return resolve(process.cwd(), stripped);
}

function integrityCheck(dbPath: string): { ok: boolean; message: string } {
  try {
    // Ouvrir en lecture seule pour ne rien altérer
    const db = new Database(dbPath, { readonly: true });
    try {
      const stmt = db.prepare("PRAGMA integrity_check;");
      const rows = stmt.all() as Array<{ integrity_check?: string }>;
      const first = rows[0]?.integrity_check ?? "unknown";
      return { ok: first === "ok", message: String(first) };
    } finally {
      db.close();
    }
  } catch (e) {
    return { ok: false, message: `open-failed: ${(e as Error).message}` };
  }
}

function deleteDbFiles(dbPath: string): void {
  const dir = dirname(dbPath);
  const base = dbPath; // ex: /abs/db/custom.db
  for (const candidate of [
    base,
    `${base}-wal`,
    `${base}-shm`,
    `${base}-journal`,
  ]) {
    if (existsSync(candidate)) {
      try {
        rmSync(candidate, { force: true });
        console.log(`  [clean-db] supprimé: ${candidate}`);
      } catch (e) {
        console.warn(`  [clean-db] impossible de supprimer ${candidate}: ${(e as Error).message}`);
      }
    }
  }
  // S'assurer que le dossier existe
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* noop */
    }
  }
}

function main(): void {
  console.log("──────────────────────────────────────────────────────────");
  console.log("  clean-db : vérification d'intégrité de la base SQLite");
  console.log("──────────────────────────────────────────────────────────");

  const dbPath = resolveDbPath();
  if (!dbPath) {
    console.log("  [clean-db] DATABASE_URL non résolvable, abandon.");
    return;
  }
  console.log(`  [clean-db] chemin cible: ${dbPath}`);

  if (!existsSync(dbPath)) {
    console.log("  [clean-db] base inexistante -> fresh start (prisma créera la base).");
    return;
  }

  const { ok, message } = integrityCheck(dbPath);
  if (ok) {
    console.log("  [clean-db] intégrité OK -> base préservée, données conservées.");
    return;
  }

  console.warn(`  [clean-db] intégrité KO -> "${message}"`);
  console.warn("  [clean-db] suppression de la base corrompue pour recréation propre...");
  deleteDbFiles(dbPath);
  console.log("  [clean-db] base corrompue supprimée. prisma db push recréera une base saine.");
  console.log("──────────────────────────────────────────────────────────");
}

main();
