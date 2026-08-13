// Helper: Send notification to all admin users
// Used by API routes when key events occur
//
// IMPORTANT: The Notification model requires a non-null `institutionId`.
// Always pass `institutionId` so createMany() doesn't silently fail
// (the error is caught and logged, which previously masked the bug
//  where school-calendar event notifications were never created).

import { db } from '@/lib/db'

interface CreateNotificationParams {
  title: string
  message: string
  type: string // NotificationType
  category: string // NotificationCategory
  link?: string // ModuleKey
  linkParams?: string // e.g. event.id / homework.id for deep linking
  icon?: string
  institutionId: string
  schoolYear?: string
}

export async function notifyAdmins(params: CreateNotificationParams) {
  try {
    if (!params.institutionId) {
      console.error('notifyAdmins: institutionId is required but was not provided')
      return
    }

    // Query only the admins of the SAME institution (multi-tenant safety).
    const admins = await db.user.findMany({
      where: { role: 'admin', active: true, institutionId: params.institutionId },
      select: { id: true },
    })

    if (admins.length === 0) return

    await db.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: params.title,
        message: params.message,
        type: params.type,
        category: params.category,
        link: params.link || null,
        linkParams: params.linkParams || null,
        icon: params.icon || null,
        institutionId: params.institutionId,
        schoolYear: params.schoolYear || '2024-2025',
      })),
    })
  } catch (error) {
    console.error('Error sending admin notification:', error)
  }
}

// Helper: Send notification to a specific user
export async function notifyUser(userId: string, params: CreateNotificationParams) {
  try {
    if (!params.institutionId) {
      console.error('notifyUser: institutionId is required but was not provided')
      return
    }

    await db.notification.create({
      data: {
        userId,
        title: params.title,
        message: params.message,
        type: params.type,
        category: params.category,
        link: params.link || null,
        linkParams: params.linkParams || null,
        icon: params.icon || null,
        institutionId: params.institutionId,
        schoolYear: params.schoolYear || '2024-2025',
      },
    })
  } catch (error) {
    console.error('Error sending user notification:', error)
  }
}

// Helper: Send a notification to many users at once (used by event/homework
// routes that need to fan out to teachers, students, parents, etc.).
// `userIds` should already be de-duplicated.
export async function notifyUsers(
  userIds: string[],
  params: CreateNotificationParams
) {
  try {
    if (!params.institutionId) {
      console.error('notifyUsers: institutionId is required but was not provided')
      return
    }
    if (userIds.length === 0) return

    await db.notification.createMany({
      data: userIds.map((uid) => ({
        userId: uid,
        title: params.title,
        message: params.message,
        type: params.type,
        category: params.category,
        link: params.link || null,
        linkParams: params.linkParams || null,
        icon: params.icon || null,
        institutionId: params.institutionId,
        schoolYear: params.schoolYear || '2024-2025',
      })),
    })
  } catch (error) {
    console.error('Error sending bulk notifications:', error)
  }
}
