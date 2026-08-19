// ============================================================
// predev hook — runs `prisma db push` before `next dev`
// ------------------------------------------------------------
// Ensures the SQLite schema always matches schema.prisma. This is
// critical because the Message model gained four optional columns
// in v1.28.0 (attachmentUrl, attachmentType, attachmentName,
// attachmentSize). If a user restores the v1.28.x source over an
// OLDER database without running `bun run db:push` manually, the
// Prisma client (generated from the new schema) will try to write
// those columns and SQLite will throw "no such column: attachmentUrl"
// — which surfaces as a 500 error when sending messages.
//
// This hook runs `prisma db push` automatically on every `bun run dev`
// so the schema is always in sync. It is NON-BLOCKING on failure:
// if db push errors (e.g. the DB file is locked by another process),
// we print a warning and let `next dev` start anyway. The API routes
// have their own stale-schema fallback for the message create path.
//
// ============================================================
// v1.28.4 — AUTO-REPAIR .env
// ------------------------------------------------------------
// On some Windows machines, the `.env` file is not extracted from
// the ZIP (hidden file), or Prisma v6 does not auto-load it, causing:
//   "Environment variable not found: DATABASE_URL" (P1012)
// This hook now:
//   1. Parses `.env` manually (no external dependency).
//   2. Creates `.env` if it doesn't exist, with a default DATABASE_URL.
//   3. Appends DATABASE_URL to `.env` if the file exists but lacks it.
//   4. Creates the `db/` directory if missing (for SQLite file path).
//   5. Sets `process.env.DATABASE_URL` so Prisma always finds it.
// This guarantees `bun run dev` works on any fresh extraction.
// ============================================================

const { execFileSync } = require('child_process')
const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('fs')
const { join } = require('path')

const BLUE = '\x1b[34m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

function log(msg) {
  console.log(`${BLUE}[predev]${RESET} ${msg}`)
}

function warn(msg) {
  console.warn(`${YELLOW}[predev]${RESET} ${msg}`)
}

function ok(msg) {
  console.log(`${GREEN}[predev]${RESET} ${msg}`)
}

// ---- Constants ----
const CWD = process.cwd()
const ENV_PATH = join(CWD, '.env')
const DB_DIR = join(CWD, 'db')
const DEFAULT_DB_URL = 'file:./db/custom.db'

// ---- Parse a .env file content into a key→value object ----
// Handles:
//   - comments (# ...) and blank lines
//   - KEY=value, KEY="value", KEY='value'
//   - whitespace around key and value
//   - Windows (CRLF) and Unix (LF) line endings
function parseEnv(content) {
  const vars = {}
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    // Strip surrounding quotes (single or double)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    vars[key] = value
  }
  return vars
}

// ---- Ensure .env exists, has DATABASE_URL, and db/ dir exists ----
function ensureEnv() {
  let envContent = ''
  let envVars = {}

  // 1. Read existing .env
  if (existsSync(ENV_PATH)) {
    try {
      envContent = readFileSync(ENV_PATH, 'utf-8')
      envVars = parseEnv(envContent)
    } catch (e) {
      warn(`Impossible de lire .env (${e.message}). Création d'un fichier par défaut.`)
    }
  } else {
    log("Fichier .env introuvable. Création d'un fichier par défaut...")
  }

  // 2. If DATABASE_URL is missing, append it to the .env file
  if (!envVars.DATABASE_URL) {
    const lineToAppend = `DATABASE_URL="${DEFAULT_DB_URL}"`
    let newContent = envContent
    if (newContent && !newContent.endsWith('\n')) {
      newContent += '\n'
    }
    newContent += lineToAppend + '\n'

    try {
      writeFileSync(ENV_PATH, newContent, 'utf-8')
      ok(`DATABASE_URL configuré dans .env → ${DEFAULT_DB_URL}`)
    } catch (e) {
      warn(`Impossible d'écrire .env (${e.message}). Utilisation de la valeur par défaut en mémoire.`)
    }
    envVars.DATABASE_URL = DEFAULT_DB_URL
  }

  // 3. Ensure the db/ directory exists (SQLite file:./db/custom.db)
  if (!existsSync(DB_DIR)) {
    try {
      mkdirSync(DB_DIR, { recursive: true })
      ok('Dossier db/ créé.')
    } catch (e) {
      warn(`Impossible de créer le dossier db/ (${e.message}).`)
    }
  }

  // 4. Inject all .env vars into process.env.
  //    DATABASE_URL is ALWAYS overridden from .env because the shell
  //    environment may have a stale SQLite URL that doesn't match the
  //    project's Prisma provider (postgresql). All other vars are only
  //    set if not already present (shell env takes precedence).
  for (const [k, v] of Object.entries(envVars)) {
    if (k === 'DATABASE_URL') {
      // ALWAYS use the .env value for DATABASE_URL — the shell may have
      // a leftover SQLite URL from a different project context.
      process.env[k] = v
    } else if (process.env[k] === undefined) {
      process.env[k] = v
    }
  }

  // 5. Final safety net — always set DATABASE_URL
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = DEFAULT_DB_URL
  }
}

// ============================================================
// Main
// ============================================================

ensureEnv()

try {
  log('Synchronisation du schéma Prisma (db push)...')
  execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
    stdio: 'inherit',
    cwd: CWD,
    env: { ...process.env }, // Explicitly pass env (includes our DATABASE_URL)
    shell: process.platform === 'win32',
    timeout: 30_000,
  })
  ok('Schéma à jour. Démarrage du serveur de développement...')
} catch (err) {
  warn(
    'Impossible de synchroniser le schéma Prisma automatiquement : ' +
      (err.message || 'erreur inconnue')
  )
  warn(
    "Le serveur va démarrer quand même. Si l'envoi de messages échoue avec " +
      'une erreur de schéma, exécutez manuellement : `bun run db:push`'
  )
  // Exit 0 so `next dev` still starts — the API has a stale-schema
  // fallback for the critical message-send path.
  process.exit(0)
}
