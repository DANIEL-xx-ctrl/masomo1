import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * PUT /api/settings/subjects/[id]
 * Updates a subject (including maxima fields).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, code, coefficient, maxTJ, maxEX, maxTRIM, maxAnnuel, domain, level, degree } = body

    const existing = await db.subject.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Matière non trouvée' }, { status: 404 })
    }

    // Check code uniqueness if changing
    if (code && code !== existing.code) {
      const conflict = await db.subject.findUnique({ where: { code } })
      if (conflict) {
        return NextResponse.json({ error: 'Ce code est déjà utilisé' }, { status: 409 })
      }
    }

    const subject = await db.subject.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(coefficient !== undefined && { coefficient }),
        ...(maxTJ !== undefined && { maxTJ }),
        ...(maxEX !== undefined && { maxEX }),
        ...(maxTRIM !== undefined && { maxTRIM }),
        ...(maxAnnuel !== undefined && { maxAnnuel }),
        ...(domain !== undefined && { domain }),
        ...(level !== undefined && { level }),
        ...(degree !== undefined && { degree }),
      },
    })

    return NextResponse.json({ subject })
  } catch (error) {
    console.error('Update subject error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/subjects/[id]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.subject.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Matière non trouvée' }, { status: 404 })
    }

    await db.subject.delete({ where: { id } })

    return NextResponse.json({ message: 'Matière supprimée avec succès' })
  } catch (error) {
    console.error('Delete subject error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

