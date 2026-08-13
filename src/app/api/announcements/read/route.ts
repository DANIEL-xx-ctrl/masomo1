import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

// POST /api/announcements/read — Mark an announcement as read by the current user
export async function POST(request: NextRequest) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { announcementId } = body

    if (!announcementId) {
      return NextResponse.json({ error: 'ID de l\'annonce requis' }, { status: 400 })
    }

    // Check announcement exists (Announcement has no institutionId field —
    // scope through the author relation)
    const announcement = await db.announcement.findFirst({
      where: { id: announcementId },
      include: { author: { select: { institutionId: true } } },
    })
    if (!announcement || (institutionId && announcement.author?.institutionId !== institutionId)) {
      return NextResponse.json({ error: 'Annonce introuvable' }, { status: 404 })
    }

    // Create read record (uses @@unique to avoid duplicates)
    try {
      await db.announcementRead.create({
        data: { announcementId, userId },
      })
    } catch {
      // Already read — ignore duplicate
    }

    // Also mark the corresponding notification as read
    await db.notification.updateMany({
      where: {
        userId,
        institutionId,
        category: 'announcement',
        linkParams: announcementId,
        read: false,
      },
      data: { read: true },
    })

    return NextResponse.json({ message: 'Annonce marquée comme lue' })
  } catch (error) {
    console.error('Mark announcement read error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du marquage de l\'annonce' },
      { status: 500 }
    )
  }
}
