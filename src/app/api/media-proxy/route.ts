import { NextRequest, NextResponse } from 'next/server'
import { head } from '@vercel/blob'

// Vercel Blob token — same as in upload-media route
const BLOB_TOKEN = 'vercel_blob_rw_r8JmjzAFADRUjfFp_k1VHgwDe3FSaMoH1tYZqad5miz7ku9'

// GET /api/media-proxy?path=... — Serve a file from Vercel Blob private store
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')

    if (!path) {
      return NextResponse.json({ error: 'Chemin du fichier requis' }, { status: 400 })
    }

    // Fetch the blob metadata (includes a download URL)
    const blob = await head(path, { token: BLOB_TOKEN })

    if (!blob) {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
    }

    // Fetch the actual file content
    const fileResponse = await fetch(blob.url)

    if (!fileResponse.ok) {
      return NextResponse.json({ error: 'Impossible de récupérer le fichier' }, { status: 500 })
    }

    const contentType = blob.contentType || 'application/octet-stream'
    const arrayBuffer = await fileResponse.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    console.error('Media proxy error:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération du fichier' }, { status: 500 })
  }
}

