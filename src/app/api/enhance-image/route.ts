import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageUrl, prompt } = body

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'URL de l\'image requise' },
        { status: 400 }
      )
    }

    let imageSource: string = imageUrl

    if (imageUrl.startsWith('/api/media/')) {
      const match = imageUrl.match(/^\/api\/media\/([^/.]+)/)
      if (match) {
        const mediaId = match[1]
        const mediaFile = await db.mediaFile.findUnique({ where: { id: mediaId } })
        if (!mediaFile) {
          return NextResponse.json(
            { error: 'Fichier média non trouvé' },
            { status: 404 }
          )
        }
        imageSource = `data:${mediaFile.mimeType};base64,${mediaFile.data}`
      }
    }

    const enhancePrompt = prompt || 'Enhance this portrait photo: make it clearer, sharper, and more visible. Improve brightness, contrast, and detail while preserving the person\'s facial features and appearance. Fix any blurriness or poor lighting.'

    const zai = await ZAI.create()
    const response = await zai.images.generations.edit({
      prompt: enhancePrompt,
      images: [{ url: imageSource }],
      size: '1024x1024',
    })

    if (!response.data || !response.data[0] || !response.data[0].base64) {
      return NextResponse.json(
        { error: 'L\'amélioration de l\'image a échoué' },
        { status: 500 }
      )
    }

    const enhancedBase64 = response.data[0].base64
    const buffer = Buffer.from(enhancedBase64, 'base64')
    const ext = '.png'
    const uniqueName = `enhanced_${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`

    const mediaFile = await db.mediaFile.create({
      data: {
        filename: uniqueName,
        mimeType: 'image/png',
        data: enhancedBase64,
        size: buffer.length,
      },
    })

    const newUrl = `/api/media/${mediaFile.id}${ext}`

    return NextResponse.json({
      url: newUrl,
      message: 'Image améliorée avec succès par l\'IA',
    })
  } catch (error) {
    console.error('Enhance image error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'amélioration de l\'image' },
      { status: 500 }
    )
  }
}
