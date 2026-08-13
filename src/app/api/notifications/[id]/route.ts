import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

// PUT /api/notifications/[id] — Mark notification as read/unread or update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Verify notification belongs to user
    const notification = await db.notification.findFirst({ where: { id, institutionId } })
    if (!notification) {
      return NextResponse.json({ error: 'Notification non trouvée' }, { status: 404 })
    }
    if (notification.userId !== userId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const updated = await db.notification.update({
      where: { id },
      data: { read: body.read !== undefined ? body.read : true },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating notification:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }
}

// DELETE /api/notifications/[id] — Delete a notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 })
    }

    const { id } = await params

    const notification = await db.notification.findFirst({ where: { id, institutionId } })
    if (!notification) {
      return NextResponse.json({ error: 'Notification non trouvée' }, { status: 404 })
    }
    if (notification.userId !== userId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    await db.notification.delete({ where: { id } })
    return NextResponse.json({ message: 'Notification supprimée' })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
