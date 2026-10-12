import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'
import { generateExcelBuffer, generatePdfBuffer, generateWordBuffer } from '@/lib/bulletin-export'
import type { BulletinStructure } from '@/lib/bulletin-parser'

/**
 * GET /api/settings/bulletin-templates/[id]/export?format=xlsx|pdf|word
 * Exporte un modèle de bulletin au format demandé.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const institutionId = await getInstitutionIdWithFallback(request)
    const format = (request.nextUrl.searchParams.get('format') || 'xlsx').toLowerCase()

    if (!['xlsx', 'pdf', 'word'].includes(format)) {
      return NextResponse.json(
        { error: 'Format non supporté. Utilisez xlsx, pdf ou word.' },
        { status: 400 }
      )
    }

    const template = await db.bulletinTemplate.findFirst({
      where: { id, institutionId },
    })

    if (!template) {
      return NextResponse.json({ error: 'Modèle non trouvé' }, { status: 404 })
    }

    const structure = template.structure as unknown as BulletinStructure
    if (!structure) {
      return NextResponse.json(
        { error: 'Structure du bulletin introuvable' },
        { status: 400 }
      )
    }

    const safeName = (template.name || 'bulletin').replace(/[^a-zA-Z0-9_-]/g, '_')

    // ---- Excel ----
    if (format === 'xlsx') {
      // Si on a le fichier original, on le renvoie direct ; sinon on régénère
      if (template.mediaFileId) {
        const media = await db.mediaFile.findUnique({
          where: { id: template.mediaFileId },
        })
        if (media) {
          const buffer = Buffer.from(media.data, 'base64')
          return new NextResponse(buffer as any, {
            status: 200,
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'Content-Disposition': `attachment; filename="${safeName}.xlsx"`,
            },
          })
        }
      }
      // Fallback: régénérer
      const buffer = await generateExcelBuffer(structure)
      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${safeName}.xlsx"`,
        },
      })
    }

    // ---- PDF ----
    if (format === 'pdf') {
      const buffer = generatePdfBuffer(structure)
      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
        },
      })
    }

    // ---- Word ----
    if (format === 'word') {
      const buffer = await generateWordBuffer(structure)
      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${safeName}.docx"`,
        },
      })
    }

    return NextResponse.json({ error: 'Format inconnu' }, { status: 400 })
  } catch (error) {
    console.error('[bulletin-templates] export error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
