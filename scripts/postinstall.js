// ============================================================================
// Resilient postinstall hook — runs `prisma generate` without breaking install
// ----------------------------------------------------------------------------
// On Windows, `prisma generate` can fail with EPERM when the Prisma engine DLL
// (query_engine-windows.dll.node) is locked by another process — typically:
//   - VSCode's TypeScript language server
//   - A running `next dev` server
//   - Another Node process that loaded the DLL
//
// Without this hook, `bun install` aborts with exit code 1 and the user is
// stuck. Instead, we:
//   1. Try `prisma generate` up to 3 times (with a 1s pause between attempts)
//   2. If it still fails, print a friendly, actionable message and EXIT 0
//      so `bun install` completes successfully. The user can then run
//      `bun run db:generate` manually once they've closed VSCode / Node.
//
// Works on Windows, macOS, and Linux. Uses only Node built-ins + child_process.
// ============================================================================

const { execFileSync } = require('child_process')
const { existsSync, rmSync } = require('fs')
const path = require('path')

const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 1000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function runPrismaGenerate() {
  // Use the same package manager that's running the install.
  // `npx prisma generate` is the most universal fallback.
  const args = ['prisma', 'generate']
  execFileSync('npx', args, {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: process.platform === 'win32',
  })
}

// On Windows, leftover .tmp files in node_modules/.prisma/client/ can block
// the rename. Clean them up before retrying.
function cleanPrismaTmpFiles() {
  const prismaClientDir = path.join(
    process.cwd(),
    'node_modules',
    '.prisma',
    'client'
  )
  if (!existsSync(prismaClientDir)) return
  try {
    const fs = require('fs')
    const entries = fs.readdirSync(prismaClientDir)
    for (const entry of entries) {
      if (entry.endsWith('.tmp') || /\.tmp[A-Fa-f0-9]+$/.test(entry)) {
        try {
          rmSync(path.join(prismaClientDir, entry), { force: true })
        } catch {
          /* ignore individual file removal failures */
        }
      }
    }
  } catch {
    /* ignore directory listing failures */
  }
}

async function main() {
  const isWindows = process.platform === 'win32'

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      runPrismaGenerate()
      if (attempt > 1) {
        console.log(
          `[postinstall] Prisma client generated successfully (attempt ${attempt}).`
        )
      }
      return
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isEperm =
        /EPERM/i.test(msg) ||
        /operation not permitted/i.test(msg) ||
        /query_engine.*\.dll/i.test(msg)

      if (attempt < MAX_ATTEMPTS) {
        console.warn(
          `[postinstall] Prisma generate failed (attempt ${attempt}/${MAX_ATTEMPTS}).` +
            (isEperm ? ' Detected a locked DLL (EPERM).' : '') +
            ' Retrying in 1s...'
        )
        if (isWindows) cleanPrismaTmpFiles()
        await sleep(RETRY_DELAY_MS)
        continue
      }

      // Final failure — print actionable message and exit 0 so install completes.
      console.warn('')
      console.warn('==============================================')
      console.warn('  Prisma generate failed — non-blocking error')
      console.warn('==============================================')
      console.warn('')
      if (isEperm) {
        console.warn(
          'Cause: A Windows process is holding the Prisma engine DLL locked.'
        )
        console.warn('')
        console.warn('To fix this, do ONE of the following:')
        console.warn('')
        console.warn('  Option A — Recommended (quick):')
        console.warn('    1. Close VSCode entirely (or kill the TS language server)')
        console.warn('    2. Kill any running Node/Next.js dev servers:')
        console.warn('         taskkill /F /IM node.exe')
        console.warn('    3. Then generate the Prisma client manually:')
        console.warn('         bun run db:generate')
        console.warn('')
        console.warn('  Option B — Skip the postinstall entirely:')
        console.warn('    1. Delete node_modules and reinstall with --ignore-scripts:')
        console.warn('         rmdir /S /Q node_modules')
        console.warn('         bun install --ignore-scripts')
        console.warn('    2. Then run the Prisma generation manually:')
        console.warn('         bun run db:generate')
        console.warn('')
        console.warn(
          'NOTE: The database (db/custom.db) and .env are already in place,'
        )
        console.warn(
          '      so once `bun run db:generate` succeeds, you can run `bun run dev`.'
        )
      } else {
        console.warn('Error:', msg)
        console.warn('')
        console.warn('Run manually:  bun run db:generate')
      }
      console.warn('')
      console.warn(
        '[postinstall] Exiting 0 so `bun install` completes successfully.'
      )
      console.warn(
        '[postinstall] The app will NOT run until `bun run db:generate` succeeds.'
      )
      console.warn('')
      // Exit 0 — DO NOT fail the install. The user just needs to run db:generate.
      process.exit(0)
    }
  }
}

main().catch(() => process.exit(0))
