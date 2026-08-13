/**
 * ============================================
 *   📦 Script d'Export de Base de Données
 *   EduGest - Export SQLite vers SQLite
 * ============================================
 * 
 * Usage:
 *   bun run scripts/export-db.ts                    # Export complet vers db/export_custom.db
 *   bun run scripts/export-db.ts --output ma.db     # Export vers un fichier spécifique
 *   bun run scripts/export-db.ts --sql-only         # Génère seulement le fichier SQL
 *   bun run scripts/export-db.ts --tables Student,Teacher  # Exporter seulement certaines tables
 */

import { Database } from "bun:sqlite";
import { existsSync, unlinkSync, mkdirSync, statSync } from "fs";
import { dirname } from "path";

// ─── Configuration ──────────────────────────────────────────────
const SOURCE_DB = "/home/z/my-project/db/custom.db";
const DEFAULT_OUTPUT = "/home/z/my-project/db/export_custom.db";
const SQL_OUTPUT = "/home/z/my-project/db/export_custom.sql";

// ─── Parser les arguments ───────────────────────────────────────
const args = process.argv.slice(2);
let outputPath = DEFAULT_OUTPUT;
let sqlOnly = false;
let specificTables: string[] | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--output" && args[i + 1]) {
    outputPath = args[i + 1];
    i++;
  } else if (args[i] === "--sql-only") {
    sqlOnly = true;
  } else if (args[i] === "--tables" && args[i + 1]) {
    specificTables = args[i + 1].split(",").map(t => t.trim());
    i++;
  }
}

// ─── Fonctions utilitaires ──────────────────────────────────────

function log(emoji: string, msg: string) {
  console.log(`  ${emoji} ${msg}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// ─── Étape 1 : Lire la base source ─────────────────────────────
console.log("\n📦 ══════════════════════════════════════════════════");
console.log("   EXPORT DE LA BASE DE DONNÉES EDUGEST");
console.log("══════════════════════════════════════════════════════\n");

const sourceDb = new Database(SOURCE_DB, { readonly: true });

// Lister toutes les tables
const allTables = sourceDb.query(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name NOT LIKE 'sqlite_%' ORDER BY name"
).all() as { name: string }[];

const tablesToExport = specificTables 
  ? allTables.filter(t => specificTables!.includes(t.name))
  : allTables;

if (tablesToExport.length === 0) {
  console.log("❌ Aucune table trouvée à exporter !");
  process.exit(1);
}

log("📊", `Source: ${SOURCE_DB}`);
log("📊", `${tablesToExport.length} table(s) à exporter\n`);

// Collecter les stats
const tableStats: { name: string; count: number; columns: any[] }[] = [];
let totalRecords = 0;

for (const table of tablesToExport) {
  const count = (sourceDb.query(`SELECT COUNT(*) as cnt FROM "${table.name}"`).get() as any).cnt;
  const columns = sourceDb.query(`PRAGMA table_info("${table.name}")`).all();
  tableStats.push({ name: table.name, count, columns: columns as any[] });
  totalRecords += count;
  log("📋", `${table.name}: ${count} enregistrement(s), ${columns.length} colonne(s)`);
}

console.log(`\n  📊 Total: ${totalRecords} enregistrements dans ${tablesToExport.length} tables\n`);

// ─── Étape 2 : Générer le fichier SQL ──────────────────────────
console.log("🔧 Génération du fichier SQL...\n");

let sqlContent = `-- ============================================\n`;
sqlContent += `--   EduGest - Export Base de Données\n`;
sqlContent += `--   Date: ${new Date().toISOString()}\n`;
sqlContent += `--   Source: ${SOURCE_DB}\n`;
sqlContent += `--   Total: ${totalRecords} enregistrements\n`;
sqlContent += `-- ============================================\n\n`;
sqlContent += `PRAGMA foreign_keys = OFF;\n\n`;

for (const stat of tableStats) {
  // Création de la table
  const createTableSql = sourceDb.query(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='${stat.name}'`
  ).get() as any;
  
  sqlContent += `-- ─── Table: ${stat.name} (${stat.count} enregistrements) ───\n`;
  sqlContent += `DROP TABLE IF EXISTS "${stat.name}";\n`;
  sqlContent += `${createTableSql.sql};\n\n`;

  // Index
  const indexes = sourceDb.query(
    `SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='${stat.name}' AND sql IS NOT NULL`
  ).all() as any[];
  
  for (const idx of indexes) {
    sqlContent += `${idx.sql};\n`;
  }
  if (indexes.length > 0) sqlContent += `\n`;

  // Données
  if (stat.count > 0) {
    const colNames = stat.columns.map((c: any) => `"${c.name}"`).join(", ");
    const rows = sourceDb.query(`SELECT * FROM "${stat.name}"`).all() as any[];

    for (const row of rows) {
      const values = stat.columns.map((col: any) => {
        const val = row[col.name];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "number") return val.toString();
        // Échapper les guillemets dans les chaînes
        return `'${String(val).replace(/'/g, "''")}'`;
      }).join(", ");
      sqlContent += `INSERT INTO "${stat.name}" (${colNames}) VALUES (${values});\n`;
    }
    sqlContent += `\n`;
  }
}

sqlContent += `PRAGMA foreign_keys = ON;\n`;

// Assurer que le dossier existe
const outputDir = dirname(SQL_OUTPUT);
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

// Écrire le SQL
Bun.write(SQL_OUTPUT, sqlContent);
log("✅", `Fichier SQL généré: ${SQL_OUTPUT}`);
log("📄", `Taille: ${formatBytes(Buffer.byteLength(sqlContent))}`);

// ─── Étape 3 : Créer la nouvelle base SQLite ──────────────────
if (!sqlOnly) {
  console.log("\n🔨 Création de la nouvelle base de données...\n");
  
  // Supprimer l'ancien fichier s'il existe
  if (existsSync(outputPath)) {
    unlinkSync(outputPath);
    log("🗑️", `Ancien fichier supprimé: ${outputPath}`);
  }

  // S'assurer que le dossier existe
  const outDir = dirname(outputPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  // Créer la nouvelle base et exécuter le SQL
  const newDb = new Database(outputPath);
  newDb.exec("PRAGMA journal_mode = WAL;");
  newDb.exec(sqlContent);
  newDb.close();

  log("✅", `Nouvelle base créée: ${outputPath}`);
  log("📄", `Taille: ${formatBytes(statSync(outputPath).size)}`);

  // ─── Étape 4 : Vérification ─────────────────────────────────
  console.log("\n🔍 Vérification de l'intégrité...\n");
  
  const verifyDb = new Database(outputPath, { readonly: true });
  let allGood = true;

  for (const stat of tableStats) {
    const count = (verifyDb.query(`SELECT COUNT(*) as cnt FROM "${stat.name}"`).get() as any).cnt;
    const status = count === stat.count ? "✅" : "❌";
    if (count !== stat.count) allGood = false;
    log(status, `${stat.name}: ${count}/${stat.count} enregistrements`);
  }
  
  verifyDb.close();

  if (allGood) {
    console.log("\n🎉 ══════════════════════════════════════════════════");
    console.log("   EXPORT RÉUSSI - Toutes les données sont intactes !");
    console.log("══════════════════════════════════════════════════════\n");
    log("📁", `Base exportée: ${outputPath}`);
    log("📄", `Fichier SQL: ${SQL_OUTPUT}`);
    console.log("");
    log("💡", "Pour utiliser cette base dans un autre projet:");
    log("1️⃣", `Copiez ${outputPath} vers le dossier db/ du nouveau projet`);
    log("2️⃣", `Mettez à jour .env: DATABASE_URL="file:./db/custom.db"`);
    log("3️⃣", `Exécutez: npx prisma generate`);
  } else {
    console.log("\n⚠️  Certains enregistrements n'ont pas été exportés correctement !");
  }
} else {
  console.log("\n🎉 ══════════════════════════════════════════════════");
  console.log("   FICHIER SQL GÉNÉRÉ AVEC SUCCÈS !");
  console.log("══════════════════════════════════════════════════════\n");
  log("📄", `Fichier: ${SQL_OUTPUT}`);
  log("💡", "Pour importer dans une autre base SQLite:");
  log("1️⃣", `sqlite3 nouvelle_base.db < ${SQL_OUTPUT}`);
}

sourceDb.close();
