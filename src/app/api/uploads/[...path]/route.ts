import { NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathParts } = await params
    const filePath = pathParts.join('/')

    // Security: prevent directory traversal
    if (filePath.includes('..')) {
      return NextResponse.json({ error: 'Chemin invalide' }, { status: 400 })
    }

    // Only allow serving files from uploads directory
    const fullPath = join(process.cwd(), 'public', 'uploads', filePath)

    // Check file exists
    let fileStat
    try {
      fileStat = await stat(fullPath)
    } catch {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
    }

    if (!fileStat.isFile()) {
      return NextResponse.json({ error: 'Pas un fichier' }, { status: 400 })
    }

    // Determine content type
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    // Read and serve the file
    const fileBuffer = await readFile(fullPath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': fileStat.size.toString(),
      },
    })
  } catch (error) {
    console.error('Serve file error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
