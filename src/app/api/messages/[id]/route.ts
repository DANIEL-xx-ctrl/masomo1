import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * DELETE /api/messages/[id]
 *
 * Deletes a single message. Authorization rules:
 *  - Any role can delete a message THEY sent (senderId === x-user-id).
 *  - Only admin / super_admin can delete messages sent by OTHER users.
 *
 * Related "message" notifications are also cleaned up best-effort.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.message.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Message non trouvé' }, { status: 404 })
    }

    // ---- Authorization: sender-based deletion ----
    const requesterUserId = request.headers.get('x-user-id')
    const requesterRole = request.headers.get('x-user-role')
    const isAdmin = requesterRole === 'admin' || requesterRole === 'super_admin'
    const isSender = !!requesterUserId && existing.senderId === requesterUserId
    if (!isAdmin && !isSender) {
      return NextResponse.json(
        {
          error:
            'Vous ne pouvez supprimer que vos propres messages. Seul un administrateur peut supprimer ceux des autres.',
        },
        { status: 403 }
      )
    }

    // Best-effort cleanup of any "message" notification tied to this message
    try {
      await db.notification.deleteMany({
        where: {
          category: 'message',
          linkParams: existing.senderId,
        },
      })
    } catch {
      /* non-blocking */
    }

    await db.message.delete({ where: { id } })

    return NextResponse.json({ message: 'Message supprimé avec succès' })
  } catch (error) {
    console.error('Delete message error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du message' },
      { status: 500 }
    )
  }
}
