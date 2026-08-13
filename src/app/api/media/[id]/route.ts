import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionId } from '@/lib/api-auth'

const VIDEO_MIME_TYPES = new Set([
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  'video/x-msvideo', 'video/x-matroska', 'video/x-flv',
  'video/3gpp', 'video/x-m4v', 'video/MP2T', 'video/x-ms-wmv',
])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params

    // Strip file extension from ID if present (e.g., "abc123.jpg" -> "abc123")
    // This allows frontend to use /api/media/{id}.jpg for type detection via isVideoUrl()
    const id = rawId.includes('.') ? rawId.substring(0, rawId.lastIndexOf('.')) : rawId

    // For GET requests, look up by ID only (no institutionId filter).
    // Browser <img> tags can't send custom headers (x-institution-id),
    // so we can't enforce institution-scoping for public media reads.
    // The cuid IDs are unique and unguessable, providing sufficient access control.
    // Institution-scoping is still enforced for DELETE operations.
    const mediaFile = await db.mediaFile.findUnique({
      where: { id },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        data: true,
        size: true,
      },
    })

    if (!mediaFile) {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
    }

    // Decode base64 data
    const buffer = Buffer.from(mediaFile.data, 'base64')
    const isVideo = VIDEO_MIME_TYPES.has(mediaFile.mimeType)

    // Handle Range requests for video files (critical for video playback)
    const rangeHeader = request.headers.get('range')

    if (isVideo && rangeHeader) {
      const fileSize = buffer.length
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (!match) {
        return new NextResponse('Invalid Range', { status: 416 })
      }

      const start = parseInt(match[1], 10)
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1

      if (start >= fileSize || end >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        })
      }

      const chunkSize = end - start + 1
      const chunk = buffer.subarray(start, end + 1)

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          'Content-Type': mediaFile.mimeType,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunkSize.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    // Non-range request or non-video file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mediaFile.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': buffer.length.toString(),
        // Always advertise range support for videos
        ...(isVideo ? { 'Accept-Ranges': 'bytes' } : {}),
      },
    })
  } catch (error) {
    console.error('Serve media error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE: Remove a media file from the database
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const institutionId = await getInstitutionId(request)
    const { id: rawId } = await params
    const id = rawId.includes('.') ? rawId.substring(0, rawId.lastIndexOf('.')) : rawId

    if (!institutionId) {
      return NextResponse.json({ error: 'Institution non trouvée' }, { status: 400 })
    }

    const mediaFile = await db.mediaFile.findFirst({ where: { id, institutionId } })
    if (!mediaFile) {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
    }

    await db.mediaFile.delete({ where: { id } })

    return NextResponse.json({ message: 'Fichier supprimé avec succès' })
  } catch (error) {
    console.error('Delete media error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
