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

/**
 * Backfill all existing institution + schoolYear notifications to a newly
 * created user.
 *
 * When a new user (teacher, student, parent, staff, or admin) is created,
 * they should immediately see ALL notifications that were already published
 * in their institution for the current school year — not just the ones
 * created after their account.
 *
 * This function:
 *   1. Finds all existing notifications where institutionId + schoolYear
 *      match (regardless of which userId they were originally targeted to).
 *   2. Filters out the ones already assigned to the new user.
 *   3. Creates copies with the new user's userId, preserving all fields
 *      (title, message, type, category, link, icon, institutionId,
 *      schoolYear) and marking them as unread.
 *
 * This gives each user their own independent read/unread state while
 * ensuring no one misses previously published announcements/homework/etc.
 *
 * @param userId        The newly created user's id
 * @param institutionId The institution the user belongs to
 * @param schoolYear    The school year to scope (defaults to '2024-2025')
 */
export async function backfillNotificationsForNewUser(
  userId: string,
  institutionId: string,
  schoolYear: string = '2024-2025'
) {
  try {
    if (!userId || !institutionId) {
      console.error('backfillNotificationsForNewUser: userId and institutionId are required')
      return
    }

    // Find all existing notifications in this institution + school year.
    // We don't filter by userId here because we want to copy notifications
    // that were targeted to OTHER users (admins, other teachers, etc.)
    // so the new user can see them too.
    const existingNotifications = await db.notification.findMany({
      where: {
        institutionId,
        schoolYear,
        // Exclude notifications already assigned to this user (idempotency)
        NOT: { userId },
      },
      select: {
        title: true,
        message: true,
        type: true,
        category: true,
        link: true,
        linkParams: true,
        icon: true,
      },
    })

    if (existingNotifications.length === 0) return

    // Deduplicate by title+message+type — multiple existing users may have
    // received the same notification (e.g. all admins got the same
    // announcement). We only want to create ONE copy per unique notification
    // for the new user.
    const seen = new Set<string>()
    const toCreate = existingNotifications.filter((n) => {
      const key = `${n.title}|${n.message}|${n.type}|${n.category}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (toCreate.length === 0) return

    await db.notification.createMany({
      data: toCreate.map((n) => ({
        userId,
        title: n.title,
        message: n.message,
        type: n.type,
        category: n.category,
        link: n.link || null,
        linkParams: n.linkParams || null,
        icon: n.icon || null,
        institutionId,
        schoolYear,
      })),
    })
  } catch (error) {
    console.error('Error backfilling notifications for new user:', error)
  }
}
