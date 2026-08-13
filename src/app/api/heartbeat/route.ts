import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

/**
 * POST /api/heartbeat
 * Called periodically by the frontend (every ~2 minutes) to signal that
 * the user is online. Creates or updates a UserSession row with
 * isActive=true and updatedAt=now().
 *
 * The dashboard counts UserSession rows with updatedAt >= now - 5 min
 * to determine "online users".
 */
export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json(
        { error: 'Utilisateur non identifié' },
        { status: 401 }
      )
    }

    const institutionId = await getInstitutionIdWithFallback(request)

    // Upsert the user's session row (one row per user).
    // Find existing active session for this user
    const existing = await db.userSession.findFirst({
      where: { userId, isActive: true },
    })

    if (existing) {
      await db.userSession.update({
        where: { id: existing.id },
        data: { updatedAt: new Date(), isActive: true },
      })
    } else {
      await db.userSession.create({
        data: { userId, isActive: true },
      })
    }

    return NextResponse.json({ ok: true, institutionId, ts: Date.now() })
  } catch (error) {
    console.error('Heartbeat error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du heartbeat' },
      { status: 500 }
    )
  }
}
