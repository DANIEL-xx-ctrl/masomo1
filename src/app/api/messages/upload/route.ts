import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

/**
 * POST /api/messages/upload
 *
 * Upload a single attachment (image / video / audio / generic file) for a
 * chat message. The file is stored in the `MediaFile` table (base64) and
 * served back via `/api/media/{id}{ext}`.
 *
 * Form data:
 *   file  (required) — the File to upload
 *
 * Response:
 *   { url, attachmentType, name, size }
 *     url             — "/api/media/<id><ext>"
 *     attachmentType  — "image" | "video" | "audio" | "file"
 *     name            — original filename
 *     size            — file size in bytes
 *
 * Limits: 25 MB max. The route accepts any MIME type so users can share
 * PDFs, documents, archives, etc. in addition to media.
 */
const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.ico']
const VIDEO_EXTS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.3gp', '.m4v', '.ts', '.wmv']
const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.weba', '.wma', '.aiff']

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.substring(i).toLowerCase() : ''
}

function classifyAttachment(mime: string, ext: string): 'image' | 'video' | 'audio' | 'file' {
  if (mime.startsWith('image/') || IMAGE_EXTS.includes(ext)) return 'image'
  if (mime.startsWith('video/') || VIDEO_EXTS.includes(ext)) return 'video'
  if (mime.startsWith('audio/') || AUDIO_EXTS.includes(ext)) return 'audio'
  return 'file'
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp', '.tiff': 'image/tiff', '.ico': 'image/x-icon',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg',
    '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska', '.flv': 'video/x-flv',
    '.3gp': 'video/3gpp', '.m4v': 'video/x-m4v',
    '.ts': 'video/MP2T', '.wmv': 'video/x-ms-wmv',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
    '.aac': 'audio/aac', '.flac': 'audio/flac', '.opus': 'audio/opus',
    '.weba': 'audio/webm', '.wma': 'audio/x-ms-wma', '.aiff': 'audio/aiff',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain', '.csv': 'text/csv', '.json': 'application/json',
    '.zip': 'application/zip', '.rar': 'application/vnd.rar', '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar', '.gz': 'application/gzip',
  }
  return map[ext] || 'application/octet-stream'
}

export async function POST(request: NextRequest) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `Le fichier dépasse la limite de 25 Mo` },
        { status: 400 }
      )
    }

    const ext = extOf(file.name)
    const rawMime = file.type || ''
    const mimeType = rawMime || mimeFromExt(ext)
    const attachmentType = classifyAttachment(rawMime, ext)

    // Read file and convert to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Data = buffer.toString('base64')

    // Generate unique filename
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext || ''}`

    // Store in database
    const mediaFile = await db.mediaFile.create({
      data: {
        filename: uniqueName,
        mimeType,
        data: base64Data,
        size: buffer.length,
        institutionId,
      },
    })

    const url = `/api/media/${mediaFile.id}${ext}`

    return NextResponse.json({
      url,
      attachmentType,
      name: file.name,
      size: buffer.length,
      message: 'Fichier uploadé avec succès',
    })
  } catch (error) {
    console.error('Upload message attachment error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'upload du fichier" },
      { status: 500 }
    )
  }
}
