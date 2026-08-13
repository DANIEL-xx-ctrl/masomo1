import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

interface ComponentInfo {
  name: string
  fileName: string
  relativePath: string
  category: 'ui' | 'modules' | 'root'
  sizeBytes: number
  sizeFormatted: string
  lines: number
  lastModified: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o'
  const k = 1024
  const units = ['o', 'Ko', 'Mo', 'Go']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function categorize(relPath: string): ComponentInfo['category'] {
  const normalized = relPath.replace(/\\/g, '/')
  if (normalized.startsWith('ui/')) return 'ui'
  if (normalized.startsWith('modules/')) return 'modules'
  return 'root'
}

async function walkDir(
  dirAbs: string,
  dirRel: string,
  acc: ComponentInfo[]
): Promise<void> {
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
      // Skip non-component folders
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      await walkDir(fullAbs, fullRel, acc)
    } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
      // Only .ts / .tsx files; skip test/spec files
      if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue

      try {
        const stat = await fs.stat(fullAbs)
        const content = await fs.readFile(fullAbs, 'utf-8')
        const lines = content.split('\n').length
        acc.push({
          name: entry.name.replace(/\.(tsx|ts)$/, ''),
          fileName: entry.name,
          relativePath: fullRel,
          category: categorize(fullRel),
          sizeBytes: stat.size,
          sizeFormatted: formatBytes(stat.size),
          lines,
          lastModified: stat.mtime.toISOString(),
        })
      } catch {
        // skip unreadable file
      }
    }
  }
}

export async function GET() {
  try {
    const rootAbs = path.join(process.cwd(), 'src', 'components')
    const components: ComponentInfo[] = []
    await walkDir(rootAbs, '', components)

    // Sort: by category, then by name
    const categoryOrder: Record<ComponentInfo['category'], number> = {
      ui: 0,
      modules: 1,
      root: 2,
    }
    components.sort((a, b) => {
      const c = categoryOrder[a.category] - categoryOrder[b.category]
      if (c !== 0) return c
      return a.name.localeCompare(b.name)
    })

    const totalSize = components.reduce((sum, c) => sum + c.sizeBytes, 0)
    const totalLines = components.reduce((sum, c) => sum + c.lines, 0)

    const byCategory = {
      ui: components.filter((c) => c.category === 'ui').length,
      modules: components.filter((c) => c.category === 'modules').length,
      root: components.filter((c) => c.category === 'root').length,
    }

    return NextResponse.json({
      components,
      total: components.length,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      totalLines,
      byCategory,
      inventoriedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Component inventory error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'inventaire des composants" },
      { status: 500 }
    )
  }
}
