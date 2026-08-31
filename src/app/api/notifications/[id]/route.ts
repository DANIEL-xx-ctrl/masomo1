import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

// PUT /api/notifications/[id] — Mark notification as read/unread or update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id')
    const userRole = request.headers.get('x-user-role')
    if (!userId && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Find the notification by ID. For super_admin, we don't filter by
    // userId because the super admin sees all institution notifications
    // and should be able to mark any of them as read.
    const where: Record<string, unknown> = { id }
    if (userRole !== 'super_admin' && userId) {
      where.userId = userId
    }

    const notification = await db.notification.findFirst({ where })
    if (!notification) {
      return NextResponse.json({ error: 'Notification non trouvée' }, { status: 404 })
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
    const userId = request.headers.get('x-user-id')
    const userRole = request.headers.get('x-user-role')
    if (!userId && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 })
    }

    const { id } = await params

    const where: Record<string, unknown> = { id }
    if (userRole !== 'super_admin' && userId) {
      where.userId = userId
    }

    const notification = await db.notification.findFirst({ where })
    if (!notification) {
      return NextResponse.json({ error: 'Notification non trouvée' }, { status: 404 })
    }

    await db.notification.delete({ where: { id } })
    return NextResponse.json({ message: 'Notification supprimée' })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
