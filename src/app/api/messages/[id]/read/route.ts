import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * PUT /api/messages/[id]/read
 *
 * Marks a single message as read. The `id` is the message id.
 * Optionally accepts a JSON body `{ fromUserId, receiverId }` to
 * mark ALL unread messages from `fromUserId` to `receiverId` as
 * read in one shot (used when opening a conversation).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    let fromUserId: string | null = null
    let receiverId: string | null = null
    try {
      const body = await request.json()
      fromUserId = body?.fromUserId || null
      receiverId = body?.receiverId || null
    } catch {
      /* body optional / not JSON */
    }

    // Bulk mark-read: every unread message from `fromUserId` to `receiverId`
    if (fromUserId && receiverId) {
      const result = await db.message.updateMany({
        where: {
          senderId: fromUserId,
          receiverId,
          read: false,
        },
        data: { read: true },
      })
      return NextResponse.json({ updated: result.count })
    }

    // Single-message mark-read path
    const updated = await db.message.update({
      where: { id },
      data: { read: true },
    })
    return NextResponse.json({ message: updated })
  } catch (error) {
    console.error('Mark message read error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du marquage du message' },
      { status: 500 }
    )
  }
}
