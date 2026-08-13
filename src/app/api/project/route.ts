import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// ---------- Configuration: what to include / exclude ----------

const PROJECT_ROOT = process.cwd()

// Directories that are NEVER included (build artifacts, deps, secrets, tooling)
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  '.turbo',
  '.cache',
  'dist',
  'build',
  'out',
  'test-results',
  'tool-results',
  'agent-ctx',
  '.zscripts',
  'skills',
  'upload',
  '.vscode',
  '.idea',
  '.vercel',
  'coverage',
  '__pycache__',
])

// Subdirectories (by relative path prefix) that contain user-generated content
// or runtime data — NOT source code. Excluded from the source download.
const EXCLUDED_PATH_PREFIXES = [
  'public/uploads/',
  'public/avatars/',
  'public/announcements/',
]

function hasExcludedPrefix(relPath: string): boolean {
  return EXCLUDED_PATH_PREFIXES.some((p) => relPath.startsWith(p))
}

// File patterns (by basename or extension) that are NEVER included
function isExcludedFile(baseName: string): boolean {
  // Secrets
  if (/^\.env(\..*)?$/.test(baseName)) return true
  // Database files (including SQLite auxiliary files: .db-shm, .db-wal, .db.before-restore, etc.)
  if (/\.(db|sqlite|sqlite3)([.-].*)?$/i.test(baseName)) return true
  // Build info / lockfiles / pid / logs
  if (/\.(tsbuildinfo|pid|log)$/.test(baseName)) return true
  if (/\.(lock|lockb)$/.test(baseName)) return true
  // OS junk
  if (baseName === '.DS_Store' || baseName === 'Thumbs.db') return true
  // Existing backup ZIPs at the root of public/
  if (/\.zip$/i.test(baseName)) return true
  return false
}

// Root-level file extensions to EXCLUDE (screenshots, docs dumped in root)
const EXCLUDED_ROOT_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.pdf',
  '.docx',
  '.doc',
  '.xls',
  '.xlsx',
  '.zip',
  '.7z',
  '.rar',
  '.gz',
  '.mp4',
  '.mp3',
  '.webm',
])

// Directories at the project root that we WILL include (everything else under root
// that is a directory and not in EXCLUDED_DIRS is also walked, but this list acts
// as documentation + a positive filter for clarity).
const INCLUDED_ROOT_DIRS = new Set([
  'src',
  'prisma',
  'public',
  'scripts',
  'mini-services',
  'examples',
  'db',
])

// Root-level config / script files we WILL include
function isIncludedRootFile(baseName: string): boolean {
  // package.json, tsconfig.json, etc.
  if (/\.(json|ts|tsx|js|jsx|mjs|cjs)$/.test(baseName)) return true
  // Config files without extension or with custom
  const configFiles = new Set([
    '.gitignore',
    '.env.example',
    '.npmrc',
    '.prettierrc',
    '.eslintrc',
    '.eslintrc.json',
    '.eslintrc.js',
    '.eslintrc.cjs',
    'Caddyfile',
    'README',
    'README.md',
    'SETUP.md',
    'Dockerfile',
    'docker-compose.yml',
    'components.json',
    'next.config.ts',
    'next.config.js',
    'next.config.mjs',
    'postcss.config.js',
    'postcss.config.mjs',
    'tailwind.config.ts',
    'tailwind.config.js',
  ])
  if (configFiles.has(baseName)) return true
  // Shell scripts
  if (/\.(sh|bash)$/.test(baseName)) return true
  // Makefile
  if (baseName === 'Makefile') return true
  // MD / TXT docs
  if (/\.(md|txt)$/.test(baseName)) return true
  // YAML / TOML config
  if (/\.(ya?ml|toml|ini)$/.test(baseName)) return true
  return false
}

// ---------- Types ----------

interface ProjectFile {
  relativePath: string
  absolutePath: string
  sizeBytes: number
  lastModified: string
}

interface ProjectInventory {
  files: ProjectFile[]
  totalFiles: number
  totalSize: number
  totalSizeFormatted: string
  byTopDir: Record<string, { count: number; size: number }>
  excludedDirs: string[]
  inventoriedAt: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o'
  const k = 1024
  const units = ['o', 'Ko', 'Mo', 'Go']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

// ---------- Walker ----------

async function collectProjectFiles(): Promise<ProjectFile[]> {
  const files: ProjectFile[] = []

  async function walk(dirAbs: string, dirRel: string) {
    let entries: import('fs').Dirent[]
    try {
      entries = await fs.readdir(dirAbs, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      // Skip excluded directories entirely
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue
        // Skip hidden directories except specific ones
        if (entry.name.startsWith('.') && entry.name !== '..') continue
        const fullAbs = path.join(dirAbs, entry.name)
        const fullRel = dirRel ? `${dirRel}/${entry.name}` : entry.name
        // Skip user-content subdirectories (public/uploads/, etc.)
        if (hasExcludedPrefix(fullRel + '/')) continue
        await walk(fullAbs, fullRel)
      } else if (entry.isFile()) {
        const baseName = entry.name

        // Apply file-level exclusion
        if (isExcludedFile(baseName)) continue

        const fullRel = dirRel ? `${dirRel}/${entry.name}` : entry.name
        // Skip user-content files (e.g. inside public/uploads/)
        if (hasExcludedPrefix(fullRel)) continue

        // If at the project root, apply stricter inclusion filter
        if (dirRel === '') {
          // Exclude root-level screenshots/docs by extension
          const ext = path.extname(baseName).toLowerCase()
          if (EXCLUDED_ROOT_EXTENSIONS.has(ext)) continue
          // Only include whitelisted root files
          if (!isIncludedRootFile(baseName)) continue
        }

        const fullAbs = path.join(dirAbs, entry.name)
        try {
          const stat = await fs.stat(fullAbs)
          files.push({
            relativePath: fullRel,
            absolutePath: fullAbs,
            sizeBytes: stat.size,
            lastModified: stat.mtime.toISOString(),
          })
        } catch {
          // skip unreadable
        }
      }
    }
  }

  await walk(PROJECT_ROOT, '')
  return files
}

// ---------- GET: inventory ----------

export async function GET() {
  try {
    const files = await collectProjectFiles()

    // Group by top-level dir
    const byTopDir: Record<string, { count: number; size: number }> = {}
    for (const f of files) {
      const top = f.relativePath.includes('/')
        ? f.relativePath.split('/')[0]
        : '(racine)'
      if (!byTopDir[top]) byTopDir[top] = { count: 0, size: 0 }
      byTopDir[top].count += 1
      byTopDir[top].size += f.sizeBytes
    }

    const totalSize = files.reduce((s, f) => s + f.sizeBytes, 0)

    const inventory: ProjectInventory = {
      files: files.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
      totalFiles: files.length,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      byTopDir,
      excludedDirs: Array.from(EXCLUDED_DIRS).sort(),
      inventoriedAt: new Date().toISOString(),
    }

    return NextResponse.json(inventory)
  } catch (error) {
    console.error('Project inventory error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'inventaire du projet" },
      { status: 500 }
    )
  }
}
