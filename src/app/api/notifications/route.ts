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
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

    // ---- Fetch notifications with privacy rules ----
    //
    // Privacy rules:
    // 1. Announcements, homework, events, payments → visible to ALL users
    //    in the institution (deduplicated by title+message+type+category).
    // 2. Private messages (category = 'message') → visible ONLY to the
    //    sender and receiver (userId matches). NOT visible institution-wide.
    //
    // We achieve this with an OR clause:
    //   - category != 'message' (institution-wide, deduplicated)
    //   - category = 'message' AND userId = currentUser (private to user)
    const where: Record<string, unknown> = {}

    if (institutionId && institutionId !== 'inst_default') {
      where.institutionId = institutionId
    }

    // For non-super_admin users: restrict private messages to their own
    if (userId && userRole !== 'super_admin') {
      where.OR = [
        { category: { not: 'message' } },
        { category: 'message', userId },
      ]
    }
    // For super_admin: no restriction (they see all, including private messages)

    const allNotifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    // Deduplicate by title+message+type+category — but ONLY for
    // institution-wide notifications (not private messages, which are
    // unique per user and must not be deduplicated).
    const seen = new Set<string>()
    const dedupedNotifications = allNotifications.filter((n) => {
      // Don't deduplicate private messages — each one is unique to its user
      if (n.category === 'message') return true

      const key = `${n.title}|${n.message}|${n.type}|${n.category}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Get unread count — for non-super_admin, count only their own
    // unread notifications. For super_admin, count all unread in the
    // institution (since they see all notifications).
    const unreadWhere: Record<string, unknown> = { read: false }
    if (institutionId && institutionId !== 'inst_default') {
      unreadWhere.institutionId = institutionId
    }
    if (userId && userRole !== 'super_admin') {
      unreadWhere.userId = userId
    }
    const unreadCount = await db.notification.count({ where: unreadWhere })

    const res = NextResponse.json({
      notifications: dedupedNotifications,
      unreadCount,
    })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
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
