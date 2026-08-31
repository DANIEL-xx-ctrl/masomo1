import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

// PUT /api/notifications/mark-all-read — Mark all notifications as read for a user
export async function PUT(request: NextRequest) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const userId = request.headers.get('x-user-id')
    const userRole = request.headers.get('x-user-role')
    if (!userId && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 })
    }

    // For super_admin, mark ALL notifications in the institution as read
    // (not just their own userId-scoped ones — the super admin sees all).
    const where: Record<string, unknown> = { read: false }
    if (institutionId && institutionId !== 'inst_default') {
      where.institutionId = institutionId
    }
    if (userRole !== 'super_admin' && userId) {
      where.userId = userId
    }

    const result = await db.notification.updateMany({
      where,
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
