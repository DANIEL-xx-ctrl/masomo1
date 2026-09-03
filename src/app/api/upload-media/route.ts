import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

export const maxDuration = 120

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

    if (!isVideo && !isImage) {
      return NextResponse.json(
        { error: 'Type de fichier non supporté. Utilisez des images ou des vidéos.' },
        { status: 400 }
      )
    }

    // Vercel Hobby plan limits request body to ~4.5MB
    const maxBytes = 4 * 1024 * 1024
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: 'Le fichier dépasse la limite de 4 Mo. Veuillez compresser le fichier.' },
        { status: 400 }
      )
    }

    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff']
    const validVideoTypes = [
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
      'video/x-msvideo', 'video/avi', 'video/x-matroska', 'video/x-flv',
      'video/3gpp', 'video/x-m4v', 'video/MP2T', 'video/x-ms-wmv',
    ]
    const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff']
    const validVideoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.3gp', '.m4v', '.ts', '.wmv']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    const isValidMime = [...validImageTypes, ...validVideoTypes].includes(file.type)
    const isValidExtension = [...validImageExtensions, ...validVideoExtensions].includes(ext)

    if (!isValidMime && !isValidExtension) {
      return NextResponse.json(
        { error: `Type de fichier non supporté. Utilisez des images (JPEG, PNG, GIF, WebP) ou vidéos (MP4, WebM, MOV).` },
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

    // Store in PostgreSQL database as base64
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
  } catch (error) {
    console.error('Upload media error:', error)
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json(
      { error: `Erreur lors de l'upload du fichier: ${msg}` },
      { status: 500 }
    )
  }
}
