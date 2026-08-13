// ============================================================================
// prepare-tauri-resources.mjs
//
// Runs BEFORE `tauri build` bundles the app. It:
//   1. Runs `bun run build` (Next.js standalone output → .next/standalone/)
//   2. Copies .next/standalone/ → src-tauri/resources/server/
//   3. Copies .next/static/ → src-tauri/resources/server/.next/static/
//   4. Copies public/ → src-tauri/resources/server/public/
//   5. Copies prisma/db/ → src-tauri/resources/server/prisma/db/ (SQLite database)
//
// The resulting src-tauri/resources/server/ is a self-contained Next.js app
// that can be launched with `node server.js` from inside the Tauri app.
// ============================================================================
import { execSync } from 'child_process'
import { cpSync, mkdirSync, existsSync, rmSync, renameSync } from 'fs'
import { join, resolve } from 'path'

const ROOT = resolve(import.meta.dirname, '..')
const STANDALONE_SRC = join(ROOT, '.next', 'standalone')
const STATIC_SRC = join(ROOT, '.next', 'static')
const PUBLIC_SRC = join(ROOT, 'public')
const DB_SRC = join(ROOT, 'db')  // database lives at db/custom.db (DATABASE_URL=file:./db/custom.db)
const RESOURCES_DIR = join(ROOT, 'src-tauri', 'resources')
const SERVER_DIR = join(RESOURCES_DIR, 'server')

console.log('=== Preparing Tauri resources (bundled Next.js server) ===')

// Step 1: Build Next.js (standalone)
if (!existsSync(STANDALONE_SRC)) {
  console.log('→ Running: bun run build (this may take a minute)...')
  execSync('bun run build', { cwd: ROOT, stdio: 'inherit' })
} else {
  console.log('→ .next/standalone already exists, skipping build (delete it to force rebuild)')
}

if (!existsSync(STANDALONE_SRC)) {
  console.error('✗ Build failed: .next/standalone not found')
  process.exit(1)
}

// Step 2: Clean and recreate the server resources directory
if (existsSync(SERVER_DIR)) {
  rmSync(SERVER_DIR, { recursive: true, force: true })
}
mkdirSync(SERVER_DIR, { recursive: true })

// Step 3: Copy the standalone server
console.log('→ Copying .next/standalone → src-tauri/resources/server/')
cpSync(STANDALONE_SRC, SERVER_DIR, { recursive: true })

// Step 4: Copy static assets into the server's .next/static
const serverStaticDir = join(SERVER_DIR, '.next', 'static')
if (existsSync(STATIC_SRC)) {
  console.log('→ Copying .next/static → server/.next/static/')
  cpSync(STATIC_SRC, serverStaticDir, { recursive: true })
}

// Step 5: Copy public assets into server/public
const serverPublicDir = join(SERVER_DIR, 'public')
if (existsSync(PUBLIC_SRC)) {
  console.log('→ Copying public/ → server/public/')
  cpSync(PUBLIC_SRC, serverPublicDir, { recursive: true })
}

// Step 6: Copy the SQLite database into server/db/
const serverDbDir = join(SERVER_DIR, 'db')
if (existsSync(DB_SRC)) {
  console.log('→ Copying db/ → server/db/')
  mkdirSync(serverDbDir, { recursive: true })
  cpSync(DB_SRC, serverDbDir, { recursive: true })
}

// Step 6b: Ensure the Prisma engine binary is present in the standalone output.
// Next.js standalone tracing sometimes misses the platform-specific Prisma
// engine (e.g. query_engine-windows.dll.node). We copy the ENTIRE
// node_modules/.prisma/client/ directory into the server's node_modules to
// guarantee the engine is available at runtime.
const prismaEngineSrc = join(ROOT, 'node_modules', '.prisma', 'client')
const prismaEngineDst = join(SERVER_DIR, 'node_modules', '.prisma', 'client')
if (existsSync(prismaEngineSrc)) {
  console.log('→ Copying Prisma client engine → server/node_modules/.prisma/client/')
  mkdirSync(join(SERVER_DIR, 'node_modules', '.prisma'), { recursive: true })
  cpSync(prismaEngineSrc, prismaEngineDst, { recursive: true })
} else {
  console.log('⚠ Warning: node_modules/.prisma/client not found — run `bun run db:generate` before building!')
}

// Step 6c: Copy @prisma/client runtime (needed for imports at runtime)
const prismaClientSrc = join(ROOT, 'node_modules', '@prisma', 'client')
const prismaClientDst = join(SERVER_DIR, 'node_modules', '@prisma', 'client')
if (existsSync(prismaClientSrc) && !existsSync(prismaClientDst)) {
  console.log('→ Copying @prisma/client → server/node_modules/@prisma/client/')
  mkdirSync(join(SERVER_DIR, 'node_modules', '@prisma'), { recursive: true })
  cpSync(prismaClientSrc, prismaClientDst, { recursive: true })
}

// Step 6d: Copy prisma/schema.prisma (needed by Prisma client at runtime
// for schema introspection in some code paths)
const prismaSchemaSrc = join(ROOT, 'prisma', 'schema.prisma')
const prismaSchemaDst = join(SERVER_DIR, 'prisma', 'schema.prisma')
if (existsSync(prismaSchemaSrc)) {
  console.log('→ Copying prisma/schema.prisma → server/prisma/')
  mkdirSync(join(SERVER_DIR, 'prisma'), { recursive: true })
  cpSync(prismaSchemaSrc, prismaSchemaDst)
}

// Step 7: Create a placeholder frontendDist (Tauri requires it even though
// we load from localhost:3000)
const placeholderDir = join(RESOURCES_DIR, 'placeholder')
if (!existsSync(placeholderDir)) {
  mkdirSync(placeholderDir, { recursive: true })
}

// Verify server.js exists
const serverJs = join(SERVER_DIR, 'server.js')
if (!existsSync(serverJs)) {
  console.error('✗ server.js not found in standalone output!')
  console.error('  Expected:', serverJs)
  process.exit(1)
}

console.log('')
console.log('✅ Tauri resources prepared:')
console.log('   Server dir:', SERVER_DIR)
console.log('   server.js: ✓')
console.log('   static:    ' + (existsSync(serverStaticDir) ? '✓' : '✗'))
console.log('   public:    ' + (existsSync(serverPublicDir) ? '✓' : '✗'))
console.log('   db:        ' + (existsSync(serverDbDir) ? '✓' : '✗'))
console.log('')
