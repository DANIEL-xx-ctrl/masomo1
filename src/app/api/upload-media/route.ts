import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
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
    const maxBytes = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024

    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `Le fichier dépasse la limite de ${isVideo ? '50 Mo' : '10 Mo'}` },
        { status: 400 }
      )
    }

    // Generate unique filename
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`

    // Upload to Vercel Blob
    const blob = await put(uniqueName, file, {
      access: 'public',
      contentType: file.type || 'application/octet-stream',
    })

    return NextResponse.json({ 
      url: blob.url, 
      message: 'Fichier uploadé avec succès' 
    })
  } catch (error) {
    console.error('Upload media error:', error)
    return NextResponse.json(
      { error: `Erreur lors de l'upload: ${error instanceof Error ? error.message : 'inconnue'}` },
      { status: 500 }
    )
  }
}
