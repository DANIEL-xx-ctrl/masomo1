import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

// POST /api/notifications/generate — Generate notifications for all admin users
// Called when key events happen (new payment, new announcement, etc.)
export async function POST(request: NextRequest) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json()
    const { type, title, message, category, link, linkParams, icon } = body

    if (!type || !title || !message) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    // Send to all admin users
    const admins = await db.user.findMany({
      where: { institutionId, role: 'admin', active: true },
      select: { id: true },
    })

    if (admins.length === 0) {
      return NextResponse.json({ message: 'Aucun administrateur trouvé' })
    }

    const notifications = await db.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title,
        message,
        type,
        category: category || 'general',
        link: link || null,
        linkParams: linkParams || null,
        icon: icon || null,
        institutionId,
      })),
    })

    return NextResponse.json({
      data: { createdCount: notifications.count },
      message: `Notification envoyée à ${notifications.count} administrateur(s)`,
    })
  } catch (error) {
    console.error('Error generating notifications:', error)
    return NextResponse.json({ error: 'Erreur lors de la génération' }, { status: 500 })
  }
}
