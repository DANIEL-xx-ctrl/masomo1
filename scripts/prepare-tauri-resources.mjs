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
import { cpSync, mkdirSync, existsSync, rmSync, renameSync, statSync, chmodSync, writeFileSync } from 'fs'
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

// Step 6e: Copy the current Node.js binary into the server directory.
// This ensures the Tauri app does NOT depend on the user having Node.js
// installed. The bundled binary is used by main.rs to spawn `node server.js`.
// On Windows: node.exe (~70 MB). On macOS/Linux: node (~80-90 MB).
const nodeExeName = process.platform === 'win32' ? 'node.exe' : 'node'
const nodeBinDir = join(SERVER_DIR, 'node-bin')
const nodeBinDest = join(nodeBinDir, nodeExeName)
mkdirSync(nodeBinDir, { recursive: true })
console.log(`→ Copying Node.js binary → server/node-bin/${nodeExeName}`)
console.log(`   Source: ${process.execPath}`)
cpSync(process.execPath, nodeBinDest)
if (process.platform !== 'win32') {
  chmodSync(nodeBinDest, 0o755) // ensure executable on Unix
}
const nodeSizeMB = (statSync(nodeBinDest).size / 1024 / 1024).toFixed(1)
console.log(`   Node binary size: ${nodeSizeMB} MB`)

// Step 7: Create a placeholder frontendDist (Tauri requires it even though
// we load from localhost:3000). This MUST contain an index.html, otherwise
// `tauri build` fails with "no index.html in frontendDist".
const placeholderDir = join(RESOURCES_DIR, 'placeholder')
const placeholderIndex = join(placeholderDir, 'index.html')
mkdirSync(placeholderDir, { recursive: true })
if (!existsSync(placeholderIndex)) {
  console.log('→ Creating placeholder/index.html (loading screen)')
  writeFileSync(placeholderIndex, `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MASOMO - Démarrage...</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}
.c{max-width:560px;text-align:center}
.l{font-size:3rem;font-weight:800;color:#10b981;letter-spacing:-0.02em;margin-bottom:.5rem}
.s{font-size:1.1rem;color:#94a3b8;margin-bottom:2rem}
.spin{width:48px;height:48px;border:4px solid #1e293b;border-top-color:#10b981;border-radius:50%;animation:sp 1s linear infinite;margin:0 auto 2rem}
@keyframes sp{to{transform:rotate(360deg)}}
.e{display:none;margin-top:1.5rem;padding:1rem;background:#7f1d1d;border-radius:8px;color:#fecaca;font-size:.9rem;text-align:left}
</style>
</head>
<body>
<div class="c">
<div class="l">MASOMO</div>
<div class="s">Démarrage du serveur local...</div>
<div class="spin"></div>
<div class="e" id="err">Le serveur n'a pas pu démarrer. Vérifiez que Node.js est installé sur votre machine.</div>
</div>
<script>
setTimeout(function(){document.getElementById('err').style.display='block';document.querySelector('.spin').style.display='none';},15000);
</script>
</body>
</html>`)
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
console.log('   node-bin:  ' + (existsSync(nodeBinDest) ? `✓ (${nodeSizeMB} MB)` : '✗'))
console.log('')
