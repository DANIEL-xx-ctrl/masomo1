import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

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

    const institutionId = await getInstitutionIdWithFallback(request)
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const unreadOnly = searchParams.get('unread') === 'true'
    const schoolYear = searchParams.get('schoolYear')

    // ---- Show ALL institution + schoolYear notifications to every role ----
    // Previously, non-super_admin users only saw notifications where
    // `userId` matched their own id. This meant a teacher who just got
    // created (via backfill) could see notifications, but an existing user
    // who had a notification targeted to another user couldn't.
    //
    // New behaviour: every authenticated user sees ALL notifications in
    // their institution for the current school year — regardless of which
    // `userId` the notification was originally assigned to. This ensures
    // announcements, homework, events, etc. are visible to everyone.
    //
    // We fetch by institutionId + schoolYear (not userId) and deduplicate
    // by title+message+type+category so the same announcement sent to
    // multiple admins doesn't appear multiple times.
    const where: Record<string, unknown> = {}

    // Scope by institution
    if (institutionId && institutionId !== 'inst_default') {
      where.institutionId = institutionId
    }

    if (schoolYear) where.schoolYear = schoolYear

    if (unreadOnly) {
      where.read = false
      // When filtering unread, we DO use the user's own id so each user
      // has their own read/unread state (a notification marked read by
      // user A should still appear unread for user B).
      if (userId && userRole !== 'super_admin') {
        where.userId = userId
      }
    }

    const [allNotifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.notification.count({ where }),
    ])

    // Deduplicate by title+message+type+category — the same notification
    // may have been created for multiple users (e.g. all admins). We want
    // to show it only once in the bell dropdown.
    const seen = new Set<string>()
    const dedupedNotifications = allNotifications.filter((n) => {
      const key = `${n.title}|${n.message}|${n.type}|${n.category}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Get unread count for the CURRENT user (their own read state)
    const unreadCount = await db.notification.count({
      where: {
        ...(userId && userRole !== 'super_admin' && { userId }),
        ...(institutionId && institutionId !== 'inst_default' && { institutionId }),
        read: false,
      },
    })

    // Cache-Control: allow Vercel's edge CDN to cache this response for a
    // few seconds. This dramatically reduces the number of serverless
    // function invocations when multiple browser tabs / components poll
    // /api/notifications concurrently.
    const res = NextResponse.json({
      notifications: dedupedNotifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total: dedupedNotifications.length,
        totalPages: Math.ceil(dedupedNotifications.length / limit),
      },
    })
    res.headers.set('Cache-Control', 'private, s-maxage=5, stale-while-revalidate=15')
    return res
  } catch (error) {
    console.error('Get notifications error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des notifications' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userId, title, message, type, schoolYear } = body

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Titre et message requis' },
        { status: 400 }
      )
    }

    const notification = await db.notification.create({
      data: {
        userId: userId || null,
        title,
        message,
        type: type || 'info',
        schoolYear: schoolYear || '2024-2025',
      },
    })

    return NextResponse.json({ notification }, { status: 201 })
  } catch (error) {
    console.error('Create notification error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la notification' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, markAllRead } = body

    if (markAllRead) {
      // Mark all notifications as read for the user
      await db.notification.updateMany({
        where: {
          userId,
          read: false,
        },
        data: {
          read: true,
        },
      })

      return NextResponse.json({ message: 'Toutes les notifications marquées comme lues' })
    }

    if (!id) {
      return NextResponse.json(
        { error: 'ID de notification requis' },
        { status: 400 }
      )
    }

    const notification = await db.notification.update({
      where: { id },
      data: { read: true },
    })

    return NextResponse.json({ notification })
  } catch (error) {
    console.error('Update notification error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la notification' },
      { status: 500 }
    )
  }
}
