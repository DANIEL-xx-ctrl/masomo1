import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

export async function GET(request: Request) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const { searchParams } = new URL(request.url)
    const schoolYear = searchParams.get('schoolYear')

    const where: Record<string, unknown> = {}
    if (schoolYear) where.schoolYear = schoolYear

    const announcements = await db.announcement.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
            institutionId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Filter announcements by the requesting user's institution via the author's
    // institution. The Announcement model does not have a direct institutionId
    // field, so we scope results through the author relation.
    const filtered = institutionId
      ? announcements.filter(
          (a) => a.author?.institutionId === institutionId
        )
      : announcements

    return NextResponse.json({ announcements: filtered })
  } catch (error) {
    console.error('Get announcements error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des annonces' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)

    const body = await request.json()
    const { title, content, type, target, authorId, priority, mediaUrl, mediaType, schoolYear } = body

    if (!title || !content || !authorId) {
      return NextResponse.json(
        { error: 'Titre, contenu et auteur requis' },
        { status: 400 }
      )
    }

    const validTypes = ['general', 'urgent', 'academic', 'event']
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type invalide. Types acceptés: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const validTargets = ['all', 'teachers', 'students', 'parents']
    if (target && !validTargets.includes(target)) {
      return NextResponse.json(
        { error: `Cible invalide. Cibles acceptées: ${validTargets.join(', ')}` },
        { status: 400 }
      )
    }

    const validMediaTypes = ['image', 'video']
    if (mediaType && !validMediaTypes.includes(mediaType)) {
      return NextResponse.json(
        { error: `Type de média invalide. Acceptés: ${validMediaTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const announcement = await db.announcement.create({
      data: {
        title,
        content,
        type: type || 'general',
        target: target || 'all',
        authorId,
        priority: priority || 0,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        schoolYear: schoolYear || '2024-2025',
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    // Generate a notification for the relevant audience of the institution
    // so the announcement appears in the notifications dropdown.
    try {
      const targetRoleMap: Record<string, string[]> = {
        all: ['admin', 'teacher', 'staff', 'student', 'parent'],
        teachers: ['teacher'],
        students: ['student'],
        parents: ['parent'],
      }
      const roles = targetRoleMap[announcement.target] || ['admin', 'teacher', 'staff']

      const recipients = await db.user.findMany({
        where: {
          institutionId,
          role: { in: roles },
          active: true,
        },
        select: { id: true },
      })

      // Make sure the author is ALWAYS in the recipient list, even when their
      // role does not match the target audience (e.g. an admin publishing an
      // announcement targeted at teachers only). This guarantees the author
      // gets a confirmation notification in their own bell.
      const authorInRecipients = recipients.some((r) => r.id === authorId)
      const finalRecipients = authorInRecipients
        ? recipients
        : [...recipients, { id: authorId }]

      const authorName = announcement.author?.name || 'Un utilisateur'
      const typeLabel =
        announcement.type === 'urgent'
          ? 'urgent'
          : announcement.type === 'event'
            ? 'événement'
            : announcement.type === 'academic'
              ? 'académique'
              : 'générale'

      // Build notifications for every recipient. We intentionally INCLUDE the
      // author so they get a confirmation in their own notification bell that
      // their announcement was published. The author receives a slightly
      // different message ("Votre annonce a été publiée") so they can
      // distinguish their own publications from those of other authors.
      const notifData = finalRecipients
        .map((r) => {
          const isAuthor = r.id === authorId
          return {
            userId: r.id,
            title: isAuthor
              ? `Votre annonce a été publiée: ${announcement.title}`
              : `Nouvelle annonce: ${announcement.title}`,
            message: isAuthor
              ? `Annonce ${typeLabel} publiée avec succès`
              : `Annonce ${typeLabel} publiée par ${authorName}`,
            type: 'announcement',
            category: 'announcement',
            link: 'communication',
            linkParams: announcement.id,
            icon: 'Megaphone',
            institutionId,
          }
        })

      if (notifData.length > 0) {
        await db.notification.createMany({ data: notifData })
      }
    } catch (notifError) {
      // Notification creation is best-effort; do not fail the announcement creation.
      console.error('Failed to generate announcement notifications:', notifError)
    }

    return NextResponse.json({ announcement }, { status: 201 })
  } catch (error) {
    console.error('Create announcement error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la création de l'annonce" },
      { status: 500 }
    )
  }
}
