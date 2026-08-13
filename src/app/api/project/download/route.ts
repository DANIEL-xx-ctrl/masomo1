import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import JSZip from 'jszip'

const PROJECT_ROOT = process.cwd()

// ---------- Exclusion config (mirrors /api/project/route.ts) ----------

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

function isExcludedFile(baseName: string): boolean {
  if (/^\.env(\..*)?$/.test(baseName)) return true
  // Database files (including SQLite auxiliary files: .db-shm, .db-wal, .db.before-restore, etc.)
  if (/\.(db|sqlite|sqlite3)([.-].*)?$/i.test(baseName)) return true
  if (/\.(tsbuildinfo|pid|log)$/.test(baseName)) return true
  if (/\.(lock|lockb)$/.test(baseName)) return true
  if (baseName === '.DS_Store' || baseName === 'Thumbs.db') return true
  // Existing backup ZIPs (e.g. inside public/)
  if (/\.zip$/i.test(baseName)) return true
  return false
}

const EXCLUDED_ROOT_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp',
  '.pdf', '.docx', '.doc', '.xls', '.xlsx',
  '.zip', '.7z', '.rar', '.gz',
  '.mp4', '.mp3', '.webm',
])

function isIncludedRootFile(baseName: string): boolean {
  if (/\.(json|ts|tsx|js|jsx|mjs|cjs)$/.test(baseName)) return true
  const configFiles = new Set([
    '.gitignore', '.env.example', '.npmrc', '.prettierrc',
    '.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs',
    'Caddyfile', 'README', 'README.md', 'SETUP.md',
    'Dockerfile', 'docker-compose.yml',
    'components.json',
    'next.config.ts', 'next.config.js', 'next.config.mjs',
    'postcss.config.js', 'postcss.config.mjs',
    'tailwind.config.ts', 'tailwind.config.js',
  ])
  if (configFiles.has(baseName)) return true
  if (/\.(sh|bash)$/.test(baseName)) return true
  if (baseName === 'Makefile') return true
  if (/\.(md|txt)$/.test(baseName)) return true
  if (/\.(ya?ml|toml|ini)$/.test(baseName)) return true
  return false
}

async function collectProjectFiles(): Promise<Array<{ relPath: string; absPath: string; sizeBytes: number }>> {
  const files: Array<{ relPath: string; absPath: string; sizeBytes: number }> = []

  async function walk(dirAbs: string, dirRel: string) {
    let entries: import('fs').Dirent[]
    try {
      entries = await fs.readdir(dirAbs, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue
        if (entry.name.startsWith('.') && entry.name !== '..') continue
        const fullAbs = path.join(dirAbs, entry.name)
        const fullRel = dirRel ? `${dirRel}/${entry.name}` : entry.name
        if (hasExcludedPrefix(fullRel + '/')) continue
        await walk(fullAbs, fullRel)
      } else if (entry.isFile()) {
        const baseName = entry.name
        if (isExcludedFile(baseName)) continue

        const fullRel = dirRel ? `${dirRel}/${entry.name}` : entry.name
        if (hasExcludedPrefix(fullRel)) continue

        if (dirRel === '') {
          const ext = path.extname(baseName).toLowerCase()
          if (EXCLUDED_ROOT_EXTENSIONS.has(ext)) continue
          if (!isIncludedRootFile(baseName)) continue
        }

        const fullAbs = path.join(dirAbs, entry.name)
        try {
          const stat = await fs.stat(fullAbs)
          files.push({ relPath: fullRel, absPath: fullAbs, sizeBytes: stat.size })
        } catch {
          // skip
        }
      }
    }
  }

  await walk(PROJECT_ROOT, '')
  return files
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o'
  const k = 1024
  const units = ['o', 'Ko', 'Mo', 'Go']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export async function POST() {
  try {
    const files = await collectProjectFiles()

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Aucun fichier à télécharger' },
        { status: 400 }
      )
    }

    const zip = new JSZip()
    let totalSize = 0

    // Add each file to the ZIP preserving structure
    for (const f of files) {
      try {
        const content = await fs.readFile(f.absPath)
        totalSize += content.length
        // Place all files under a project root folder in the ZIP
        zip.file(`edugest-source/${f.relPath}`, content)
      } catch {
        // skip unreadable
      }
    }

    // Add a README manifest
    const byTopDir: Record<string, { count: number; size: number }> = {}
    for (const f of files) {
      const top = f.relPath.includes('/') ? f.relPath.split('/')[0] : '(racine)'
      if (!byTopDir[top]) byTopDir[top] = { count: 0, size: 0 }
      byTopDir[top].count += 1
      byTopDir[top].size += f.sizeBytes
    }

    const readmeLines = [
      '# Code source du projet EduGest',
      '',
      `Date de téléchargement: ${new Date().toISOString()}`,
      `Nombre de fichiers: ${files.length}`,
      `Taille totale (non compressée): ${formatBytes(totalSize)}`,
      '',
      '## Répartition par dossier de premier niveau',
      '',
      '| Dossier | Fichiers | Taille |',
      '| --- | ---: | ---: |',
      ...Object.entries(byTopDir)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([dir, info]) => `| ${dir} | ${info.count} | ${formatBytes(info.size)} |`),
      '',
      '## Dossiers exclus (dépendances, build, secrets, outils)',
      '',
      ...Array.from(EXCLUDED_DIRS).sort().map((d) => `- ${d}/`),
      '',
      '## Fichiers exclus',
      '',
      '- `.env` et variantes (secrets)',
      '- `*.db`, `*.db-journal`, `*.sqlite*` (bases de données)',
      '- `*.lock`, `*.lockb` (lockfiles)',
      '- `*.tsbuildinfo`, `*.pid`, `*.log` (artifacts)',
      '- Screenshots et documents binaires à la racine (`*.png`, `*.pdf`, `*.docx`…)',
      '',
      '## Pour restaurer le projet',
      '',
      '1. Décompressez cette archive',
      '2. Exécutez `bun install` pour réinstaller les dépendances',
      '3. Exécutez `bun run db:push` pour créer la base SQLite',
      '4. Exécutez `bun run dev` pour démarrer le serveur',
      '',
    ]
    zip.file('README.md', readmeLines.join('\n'))

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `edugest-source-${timestamp}.zip`

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipBuffer.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Project source download error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du téléchargement du code source' },
      { status: 500 }
    )
  }
}
