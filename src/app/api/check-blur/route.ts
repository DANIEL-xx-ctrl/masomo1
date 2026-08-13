import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageUrl } = body

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'URL de l\'image requise' },
        { status: 400 }
      )
    }

    let imageSource: string = imageUrl

    // If the image is stored in our database, convert to base64 data URL
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
    } else if (imageUrl.startsWith('/api/upload/')) {
      const id = imageUrl.split('/').pop()
      if (id) {
        const mediaFile = await db.mediaFile.findUnique({ where: { id } })
        if (!mediaFile) {
          return NextResponse.json(
            { error: 'Fichier média non trouvé' },
            { status: 404 }
          )
        }
        imageSource = `data:${mediaFile.mimeType};base64,${mediaFile.data}`
      }
    }

    const zai = await ZAI.create()
    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Is this image blurry? Analyze the sharpness and clarity of the image. Respond with ONLY a JSON object in this exact format: {"blurry": true/false, "score": 0-100, "reason": "brief explanation"}. A score of 0 means extremely blurry, 100 means perfectly sharp. Consider the image blurry if the score is below 50.',
            },
            {
              type: 'image_url',
              image_url: { url: imageSource },
            },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })

    const content = response.choices[0]?.message?.content || ''

    // Parse the VLM response
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        return NextResponse.json({
          blurry: result.blurry ?? false,
          score: result.score ?? 75,
          reason: result.reason || '',
        })
      }
    } catch {
      // Fallback: if we can't parse, check for keywords
      const isBlurry = content.toLowerCase().includes('blurry') || content.toLowerCase().includes('flou')
      return NextResponse.json({
        blurry: isBlurry,
        score: isBlurry ? 30 : 70,
        reason: 'Analyse basée sur le contenu de la réponse',
      })
    }

    return NextResponse.json({ blurry: false, score: 75, reason: 'Analyse indisponible' })
  } catch (error) {
    console.error('Check blur error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse de l\'image' },
      { status: 500 }
    )
  }
}
