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
 *
 * FIX (migration SQLite → PostgreSQL) :
 * Le userId envoyé par le navigateur peut être stale (ancien ID SQLite resté
 * dans localStorage après la migration). On ne peut pas créer de UserSession
 * pour un userId inexistant (violation FK UserSession.userId → User).
 * On valide donc le userId avant tout create/update :
 *   - User valide     → 200 OK + upsert UserSession
 *   - SuperAdmin      → 200 OK SANS UserSession (la FK l'interdit, et le
 *                       compteur "online users" est institution-scoped)
 *   - userId stale    → 401 (le frontend nettoie localStorage et déconnecte)
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

    // Validate that the userId corresponds to a real User row.
    // Stale SQLite userIds (left in browser localStorage after the PostgreSQL
    // migration) would trigger a P2003 FK violation on UserSession.create.
    const userExists = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!userExists) {
      // Super admins live in the SuperAdmin table, not User. They cannot have
      // a UserSession row (FK constraint), and they don't need to be tracked
      // in the institution-scoped "online users" counter. Acknowledge the
      // heartbeat without creating a session.
      const superAdminExists = await db.superAdmin.findUnique({
        where: { id: userId },
        select: { id: true },
      })
      if (superAdminExists) {
        return NextResponse.json({ ok: true, institutionId, ts: Date.now() })
      }

      // Stale / unknown userId → 401 so the frontend logs out.
      return NextResponse.json(
        { error: 'Session expirée ou invalide.' },
        { status: 401 }
      )
    }

    // Upsert the user's session row (one row per user).
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
