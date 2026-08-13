import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import JSZip from 'jszip'

interface DownloadRequest {
  paths?: string[]
  // Optional: 'zip' (default) or 'manifest' (just the inventory JSON)
  mode?: 'zip' | 'manifest'
}

const COMPONENTS_ROOT = path.join(process.cwd(), 'src', 'components')

// Safety: ensure a relative path stays inside the components root
function safeResolve(relPath: string): string | null {
  if (!relPath || typeof relPath !== 'string') return null
  // Reject absolute paths and parent traversal
  if (path.isAbsolute(relPath) || relPath.includes('..')) return null
  const resolved = path.resolve(COMPONENTS_ROOT, relPath)
  const rel = path.relative(COMPONENTS_ROOT, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  // Only allow .ts / .tsx
  if (!/\.(tsx|ts)$/.test(rel)) return null
  return resolved
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DownloadRequest
    const mode = body.mode ?? 'zip'

    // Resolve the list of files to include
    let files: Array<{ relPath: string; absPath: string }> = []

    if (body.paths && Array.isArray(body.paths) && body.paths.length > 0) {
      // User-selected subset
      for (const p of body.paths) {
        const abs = safeResolve(p)
        if (!abs) continue
        try {
          const stat = await fs.stat(abs)
          if (stat.isFile()) {
            files.push({ relPath: p, absPath: abs })
          }
        } catch {
          // skip missing file
        }
      }
    } else {
      // Default: include ALL components (recursive walk)
      files = await collectAllComponents()
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Aucun composant à télécharger' },
        { status: 400 }
      )
    }

    // Manifest mode: return JSON inventory (names + sizes) without zipping
    if (mode === 'manifest') {
      const manifest = await Promise.all(
        files.map(async (f) => {
          const stat = await fs.stat(f.absPath)
          return {
            relativePath: f.relPath,
            sizeBytes: stat.size,
            lastModified: stat.mtime.toISOString(),
          }
        })
      )
      return NextResponse.json({
        count: manifest.length,
        files: manifest.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
      })
    }

    // ZIP mode: build a ZIP archive containing the selected component files
    const zip = new JSZip()
    let totalSize = 0

    for (const f of files) {
      try {
        const content = await fs.readFile(f.absPath)
        totalSize += content.length
        // Preserve folder structure inside the ZIP (under "components/")
        zip.file(`components/${f.relPath}`, content)
      } catch {
        // skip unreadable
      }
    }

    // Add a small README manifest inside the ZIP
    const readmeLines = [
      '# Inventaire des composants téléchargés',
      `Date: ${new Date().toISOString()}`,
      `Nombre de fichiers: ${files.length}`,
      `Taille totale (non compressée): ${formatBytes(totalSize)}`,
      '',
      '## Fichiers inclus',
      ...files
        .map((f) => f.relPath)
        .sort()
        .map((p) => `- components/${p}`),
    ]
    zip.file('README.md', readmeLines.join('\n'))

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `composants-edugest-${timestamp}.zip`

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
    console.error('Component download error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du téléchargement des composants' },
      { status: 500 }
    )
  }
}

async function collectAllComponents(): Promise<
  Array<{ relPath: string; absPath: string }>
> {
  const out: Array<{ relPath: string; absPath: string }> = []

  async function walk(dirAbs: string, dirRel: string) {
    let entries: import('fs').Dirent[]
    try {
      entries = await fs.readdir(dirAbs, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const fullAbs = path.join(dirAbs, entry.name)
      const fullRel = dirRel ? `${dirRel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
        await walk(fullAbs, fullRel)
      } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
        if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue
        out.push({ relPath: fullRel, absPath: fullAbs })
      }
    }
  }

  await walk(COMPONENTS_ROOT, '')
  return out
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o'
  const k = 1024
  const units = ['o', 'Ko', 'Mo', 'Go']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
