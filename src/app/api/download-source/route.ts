import { NextResponse } from 'next/server'
import { ZipArchive } from 'archiver'
import { createWriteStream, readdirSync, statSync, readFileSync, existsSync } from 'fs'
import { join, relative, basename } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { pipeline } from 'stream/promises'

// Directories to include in the source ZIP
const INCLUDE_DIRS = ['src', 'prisma', 'public', 'scripts', 'mini-services']
// Specific files to include
const INCLUDE_FILES = [
  'package.json',
  'tsconfig.json',
  'next.config.ts',
  'tailwind.config.ts',
  'postcss.config.mjs',
  '.env.example',
  'README.md',
  'Caddyfile',
]
// Patterns to exclude
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  '__pycache__',
  '.DS_Store',
  'db/custom.db',
  'db/custom.db-journal',
  '*.log',
  '.zscripts',
  'tool-results',
  'agent-ctx',
]

function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => {
    if (pattern.startsWith('*')) {
      return filePath.endsWith(pattern.slice(1))
    }
    return filePath.includes(pattern)
  })
}

function walkDir(dir: string, baseDir: string, fileList: Array<{ path: string; fullPath: string }>) {
  if (!existsSync(dir)) return
  const items = readdirSync(dir)
  for (const item of items) {
    const fullPath = join(dir, item)
    const relPath = relative(baseDir, fullPath)
    if (shouldExclude(relPath) || shouldExclude(item)) continue
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      walkDir(fullPath, baseDir, fileList)
    } else if (stat.isFile()) {
      fileList.push({ path: relPath, fullPath })
    }
  }
}

export async function GET(request: Request) {
  try {
    // Auth check — only admin/super_admin can download source
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé. Seuls les administrateurs peuvent télécharger le code source.' },
        { status: 403 }
      )
    }

    const projectRoot = process.cwd()

    // Collect all files to include
    const files: Array<{ path: string; fullPath: string }> = []

    // Add specific files
    for (const file of INCLUDE_FILES) {
      const fullPath = join(projectRoot, file)
      if (existsSync(fullPath) && statSync(fullPath).isFile()) {
        files.push({ path: file, fullPath })
      }
    }

    // Add directories
    for (const dir of INCLUDE_DIRS) {
      const dirPath = join(projectRoot, dir)
      if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
        walkDir(dirPath, projectRoot, files)
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Aucun fichier source trouvé' },
        { status: 404 }
      )
    }

    // Create a temporary ZIP file
    const zipFileName = `edugest-source-${Date.now()}.zip`
    const zipPath = join(tmpdir(), `${randomUUID()}.zip`)
    const output = createWriteStream(zipPath)
    const archive = new ZipArchive({ zlib: { level: 9 } })

    const archiveFinished = new Promise<void>((resolve, reject) => {
      output.on('close', () => resolve())
      output.on('error', reject)
      archive.on('error', reject)
    })

    archive.pipe(output)

    // Add a README to the ZIP
    const readmeContent = `# EduGest — Code Source

## Description
Système de Gestion Scolaire — Application Next.js 16 complète
généré le ${new Date().toLocaleString('fr-FR')}

## Structure du projet
- **src/app/** — Routes App Router (pages + API routes)
- **src/components/** — Composants React (UI + modules)
- **src/lib/** — Utilitaires (API client, store, types, etc.)
- **prisma/** — Schéma de base de données Prisma
- **public/** — Assets statiques (PWA, icônes)
- **scripts/** — Scripts de seed et utilitaires

## Stack technique
- Next.js 16 (App Router)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Prisma ORM (SQLite)
- Zustand (state management)
- Framer Motion (animations)

## Installation
\`\`\`bash
bun install
bun run db:push
bun run dev
\`\`\`

## Comptes de démonstration
### École Internationale EduGest
- Admin: admin@ecole.com / admin123
- Enseignant: amadou.diallo@ecole.com / teacher123
- Élève: moussa.keita@ecole.com / student123
- Parent: parent@ecole.com / parent123
- Personnel: staff@ecole.com / staff123

### Lycée Test
- Admin: directeur@lycee-test.sn / lycee2024
- Enseignant: nfatou.sow@lycee-test.sn / prof2024
- Élève: moussa.niang@lycee-test.sn / eleve2024
- Parent: parent@lycee-test.sn / parent2024
- Personnel: surveillant@lycee-test.sn / staff2024

### Super Admin
- superadmin@edugest.com / super123

## Fichiers inclus: ${files.length}
`

    archive.append(readmeContent, { name: 'README-SOURCE.md' })

    // Add all collected files
    for (const file of files) {
      try {
        const content = readFileSync(file.fullPath)
        archive.append(content, { name: file.path })
      } catch {
        // Skip files that can't be read (binary, permissions, etc.)
      }
    }

    archive.finalize()
    await archiveFinished

    // Read the ZIP file and return it as a response
    const { readFile, unlink } = await import('fs/promises')
    const zipBuffer = await readFile(zipPath)

    // Clean up temp file
    unlink(zipPath).catch(() => {})

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Content-Length': zipBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error('Download source error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du ZIP: ' + (error instanceof Error ? error.message : 'unknown') },
      { status: 500 }
    )
  }
}
