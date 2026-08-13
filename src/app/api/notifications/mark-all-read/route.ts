import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

// PUT /api/notifications/mark-all-read — Mark all notifications as read for a user
export async function PUT(request: NextRequest) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 })
    }

    const result = await db.notification.updateMany({
      where: { userId, institutionId, read: false },
      data: { read: true },
    })

    return NextResponse.json({
      data: { updatedCount: result.count },
      message: `${result.count} notification(s) marquée(s) comme lue(s)`,
    })
  } catch (error) {
    console.error('Error marking all as read:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }
}
