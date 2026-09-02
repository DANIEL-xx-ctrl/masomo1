import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// GET /api/media-file/[name] — Serve a media file from /tmp/uploads/communications/
// This route is needed because Vercel's filesystem is read-only except for /tmp,
// so uploaded files are stored there and served via this API route.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params

    // Prevent path traversal — only allow alphanumeric, dots, dashes, underscores
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '')
    if (!safeName || safeName !== name) {
      return NextResponse.json({ error: 'Nom de fichier invalide' }, { status: 400 })
    }

    const filePath = join('/tmp', 'uploads', 'communications', safeName)

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
    }

    const buffer = await readFile(filePath)

    // Determine content type from extension
    const ext = safeName.substring(safeName.lastIndexOf('.')).toLowerCase()
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp', '.tiff': 'image/tiff',
      '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg',
      '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska', '.flv': 'video/x-flv',
      '.3gp': 'video/3gpp', '.m4v': 'video/x-m4v',
      '.ts': 'video/MP2T', '.wmv': 'video/x-ms-wmv',
    }
    const contentType = mimeMap[ext] || 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    console.error('Serve media file error:', error)
    return NextResponse.json({ error: 'Erreur lors de la lecture du fichier' }, { status: 500 })
  }
}

