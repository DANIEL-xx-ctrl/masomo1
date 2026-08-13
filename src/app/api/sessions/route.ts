import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

/**
 * GET /api/sessions
 *
 * Returns user sessions (online presence rows from the DB).
 *
 * Query params:
 *   - active=true          : only rows with isActive=true
 *   - online=true          : only rows with updatedAt within the last 5 min (truly online)
 *   - institutionId=...    : scope to one institution (super admin only)
 *
 * Headers (added by the FetchInterceptor):
 *   - x-user-id, x-user-role, x-institution-id, x-super-admin-id
 *
 * Access control:
 *   - super_admin: can see all sessions across all institutions
 *   - admin:       sees only sessions of users in their own institution
 *   - other roles: see only their own sessions
 */
export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id')
    const userRole = request.headers.get('x-user-role')

    if (!userId && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'
    const onlineOnly = searchParams.get('online') === 'true'

    const where: Record<string, unknown> = {}

    // ---- Scope by role ----
    if (userRole === 'super_admin') {
      // Super admin can see everything; optional institutionId filter
      const instFilter = searchParams.get('institutionId')
      if (instFilter) {
        where.user = { institutionId: instFilter }
      }
    } else if (userRole === 'admin') {
      // Admin sees only users of their own institution
      const instId = await getInstitutionIdWithFallback(request)
      if (instId) {
        where.user = { institutionId: instId }
      }
    } else {
      // Other roles: only their own sessions
      where.userId = userId!
    }

    if (activeOnly) {
      where.isActive = true
    }

    if (onlineOnly) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
      where.updatedAt = { gte: fiveMinAgo }
    }

    const sessions = await db.userSession.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            userCode: true,
            avatar: true,
            institutionId: true,
            institution: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Get sessions error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des sessions' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')
    const userId = request.headers.get('x-user-id')

    if (!userId && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, isActive } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID de session requis' },
        { status: 400 }
      )
    }

    const session = await db.userSession.findUnique({
      where: { id },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session non trouvée' },
        { status: 404 }
      )
    }

    // Non-super_admin can only update their own sessions
    if (userRole !== 'super_admin' && session.userId !== userId) {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      )
    }

    const updatedSession = await db.userSession.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ session: updatedSession })
  } catch (error) {
    console.error('Update session error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la session' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')
    const userId = request.headers.get('x-user-id')

    if (!userId && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID de session requis' },
        { status: 400 }
      )
    }

    const session = await db.userSession.findUnique({
      where: { id },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session non trouvée' },
        { status: 404 }
      )
    }

    // Non-super_admin can only delete their own sessions
    if (userRole !== 'super_admin' && session.userId !== userId) {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      )
    }

    await db.userSession.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Session supprimée avec succès' })
  } catch (error) {
    console.error('Delete session error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la session' },
      { status: 500 }
    )
  }
}
