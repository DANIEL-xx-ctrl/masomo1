import { NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readFile, stat } from 'node:fs/promises'

const execFileAsync = promisify(execFile)

/**
 * Roughly estimate the on-disk size (in bytes) of the files that will end up
 * in the archive. We use `du -sb` on the included directories and add the
 * sizes of the top-level config files. This is NOT the zipped size (which is
 * much smaller) — it's the raw size, used only for a UI hint like
 * "~5 MB brut". The actual zipped size is computed at download time.
 */
async function estimateRawSize(projectRoot: string): Promise<number> {
  const dirs = ['src', 'prisma', 'scripts', 'scripts-doc', 'mini-services', 'examples', 'public']
    .filter((p) => existsSync(join(projectRoot, p)))

  let total = 0
  try {
    if (dirs.length > 0) {
      const { stdout } = await execFileAsync(
        'du',
        ['-sb', ...dirs],
        { cwd: projectRoot, maxBuffer: 20 * 1024 * 1024 }
      )
      // `du -sb a b c` prints one line per arg: "<bytes>\t<path>"
      for (const line of stdout.split('\n')) {
        const m = line.match(/^(\d+)\t/)
        if (m) total += parseInt(m[1], 10)
      }
    }
  } catch {
    /* non-fatal */
  }

  // Add sizes of top-level config files included in the archive.
  const topFiles = [
    'package.json', 'package-lock.json', 'bun.lock', 'tsconfig.json', 'next.config.ts',
    'tailwind.config.ts', 'postcss.config.mjs', 'components.json',
    'eslint.config.mjs', 'next-env.d.ts', 'Caddyfile',
    'README.md', 'README-SOURCE.md', 'SOURCE-README.md', 'SETUP.md',
    'INSTALLATION-VSCODE.md', 'CHANGELOG.md', '.env.example', '.env',
    'db/custom.db', 'db/export_custom.sql',
  ]
  for (const p of topFiles) {
    try {
      const s = await stat(join(projectRoot, p))
      total += s.size
    } catch {
      /* ignore missing files */
    }
  }

  return total
}

/**
 * GET /api/download/source-code/meta
 *
 * Returns lightweight metadata about the source-code archive WITHOUT actually
 * generating the ZIP. Used by the Settings page to display the live file
 * count, estimated size and the last-modified time of the source tree so the
 * user can see at a glance that the download button reflects the current
 * state of the code.
 *
 * Security: same role guard as the download endpoint itself.
 */
export async function GET(request: Request) {
  const userRole = request.headers.get('x-user-role')
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return NextResponse.json(
      { error: 'Accès non autorisé. Réservé aux administrateurs.' },
      { status: 403 }
    )
  }

  const projectRoot = process.cwd()

  let fileCount = 0
  try {
    // Count files using `find` on directories + stat on top-level files.
    // We mirror the zip exclude patterns exactly so the count matches the
    // real archive: only TOP-LEVEL public/*.{zip,png,pdf,docx,mp4,txt} are
    // excluded — nested files (public/avatars/*.png etc.) ARE included.
    const dirs = ['src', 'prisma', 'scripts', 'scripts-doc', 'mini-services', 'examples', 'public']
      .filter((p) => existsSync(join(projectRoot, p)))

    const { stdout } = await execFileAsync(
      'find',
      dirs.concat([
        '-type', 'f',
        // Common excludes (apply everywhere)
        '!', '-path', '*/node_modules/*',
        '!', '-path', '*/.next/*',
        '!', '-path', '*/.git/*',
        '!', '-path', '*/video-assets/*',
        '!', '-name', '*.DS_Store',
        '!', '-name', '*.before-restore',
        '!', '-name', '*-shm',
        '!', '-name', '*-wal',
        // Zip excludes only top-level public/*.{zip,png,pdf,docx,mp4,txt},
        // BUT Info-ZIP's `*` matches across `/`, so public/*.png actually
        // excludes ALL pngs under public/ (including avatars/, uploads/...).
        // We mirror that exact behaviour here.
        '!', '(', '-path', 'public/*', '-a', '(', '-name', '*.zip', '-o', '-name', '*.png', '-o', '-name', '*.pdf', '-o', '-name', '*.docx', '-o', '-name', '*.mp4', '-o', '-name', '*.txt', ')', ')',
      ]),
      { cwd: projectRoot, maxBuffer: 20 * 1024 * 1024 }
    )
    const dirCount = stdout.split('\n').filter((l) => l.trim().length > 0).length

    // Top-level files (config + docs)
    const topFiles = [
      'package.json', 'package-lock.json', 'bun.lock', 'tsconfig.json', 'next.config.ts',
      'tailwind.config.ts', 'postcss.config.mjs', 'components.json',
      'eslint.config.mjs', 'next-env.d.ts', 'Caddyfile',
      'README.md', 'README-SOURCE.md', 'SOURCE-README.md', 'SETUP.md',
      'INSTALLATION-VSCODE.md', 'CHANGELOG.md', '.env.example', '.env',
      'db/custom.db', 'db/export_custom.sql',
    ].filter((p) => existsSync(join(projectRoot, p))).length

    fileCount = dirCount + topFiles
  } catch {
    /* non-fatal */
  }

  // Compute the last-modified time of the src tree (most recent mtime among
  // the source files) so the UI can show "dernière modification du code".
  let lastModified: string | null = null
  try {
    // `stat` on the src directory gives the directory mtime which updates
    // whenever a file is added/removed inside it — close enough for a UI hint.
    const s = await stat(join(projectRoot, 'src'))
    lastModified = s.mtime.toISOString()
  } catch {
    /* ignore */
  }

  // Read package.json version
  let version = '1.x'
  try {
    const pkgRaw = await readFile(join(projectRoot, 'package.json'), 'utf-8')
    const pkg = JSON.parse(pkgRaw)
    if (pkg.version) version = String(pkg.version)
  } catch {
    /* ignore */
  }

  // Rough raw-size estimate (sum of the file sizes on disk, before zip
  // compression). Used by the UI to display "~X MB brut".
  const rawSizeBytes = await estimateRawSize(projectRoot)

  const now = new Date()
  return NextResponse.json({
    fileCount,
    lastModified,
    version,
    generatedAt: now.toISOString(),
    rawSizeBytes,
    filename: `EduGest_Source_Complet_${
      now.toISOString().slice(0, 10).replace(/-/g, '')
    }.zip`,
  })
}

