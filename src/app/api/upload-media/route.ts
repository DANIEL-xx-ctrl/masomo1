import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Increase the function duration for large file uploads
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')

    // Validate file size — images: max 10MB, videos: max 50MB
    const maxBytes = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024
    const maxLabel = isVideo ? '50 Mo' : '10 Mo'
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `Le fichier dépasse la limite de ${maxLabel}` },
        { status: 400 }
      )
    }

    // Validate file type by MIME type OR by extension (fallback)
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff']
    const validVideoTypes = [
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
      'video/x-msvideo', 'video/avi', 'video/x-matroska', 'video/x-flv',
      'video/3gpp', 'video/x-m4v', 'video/mp4v-es', 'video/MP2T',
      'video/x-ms-wmv',
    ]
    const isValidMime = [...validImageTypes, ...validVideoTypes].includes(file.type)

    // Fallback: check by file extension if MIME type is empty or unrecognized
    const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff']
    const validVideoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.3gp', '.m4v', '.ts', '.wmv']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    const isValidExtension = [...validImageExtensions, ...validVideoExtensions].includes(ext)

    if (!isValidMime && !isValidExtension) {
      return NextResponse.json(
        { error: `Type de fichier non supporté (${file.type || 'inconnu'}). Utilisez des images (JPEG, PNG, GIF, WebP) ou vidéos (MP4, WebM, MOV, AVI).` },
        { status: 400 }
      )
    }

    // Determine MIME type
    let mimeType = file.type
    if (!mimeType || !isValidMime) {
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
      mimeType = mimeMap[ext] || 'application/octet-stream'
    }

    // Generate unique filename
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`

    // ---- Storage strategy ----
    // For images (≤ 10MB): store in DB as base64 (works everywhere including Vercel)
    // For videos (> 4.5MB likely to exceed Vercel's body limit): save to filesystem
    //   → public/uploads/communications/ directory (works in local dev)
    //   → On Vercel, use Vercel Blob or external storage for production

    if (isVideo) {
      // Save to filesystem to avoid DB bloat and memory issues with base64
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'communications')
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
      }
      const filePath = join(uploadDir, uniqueName)
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)
      // Return the public URL (served by /api/uploads/[...path] or directly)
      const url = `/uploads/communications/${uniqueName}`
      return NextResponse.json({ url, message: 'Vidéo uploadée avec succès' })
    } else {
      // For images, keep the DB approach (they're small enough)
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const base64Data = buffer.toString('base64')

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
      return NextResponse.json({ url, message: 'Fichier uploadé avec succès' })
    }
  } catch (error) {
    console.error('Upload media error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'upload du fichier' },
      { status: 500 }
    )
  }
}
