import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * DELETE /api/bulletins/[id]
 *
 * Supprime un bulletin édité. Les notes de l'élève ne sont PAS affectées —
 * seuls l'enregistrement bulletin (et les rangs/appréciations calculés à la
 * génération) disparaissent. L'admin peut ensuite regénérer le bulletin
 * si besoin.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'ID du bulletin requis' },
        { status: 400 }
      )
    }

    // Vérifie que le bulletin existe avant de le supprimer.
    const existing = await db.bulletin.findUnique({
      where: { id },
      select: { id: true, studentId: true, trimester: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Bulletin introuvable' },
        { status: 404 }
      )
    }

    await db.bulletin.delete({ where: { id } })

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('Delete bulletin error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du bulletin' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/bulletins/[id]
 * Renvoie un bulletin par son ID (avec l'élève rattaché).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const bulletin = await db.bulletin.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            class: true,
          },
        },
      },
    })

    if (!bulletin) {
      return NextResponse.json(
        { error: 'Bulletin introuvable' },
        { status: 404 }
      )
    }

    return NextResponse.json({ bulletin })
  } catch (error) {
    console.error('Get bulletin error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du bulletin' },
      { status: 500 }
    )
  }
}
