// ============================================================
// Teacher → Class resolution helpers
//
// Used by API routes to scope data to a teacher's own classes.
// A teacher is linked to classes through the ClassTeacher join
// table (teacherId). Each ClassTeacher row also carries the
// subject the teacher teaches in that class, plus the class
// itself has a schoolYear field.
// ============================================================

import { db } from './db'

/**
 * Resolve the Teacher record id from a User id.
 * Returns null when the user is not a teacher (or not found).
 */
export async function getTeacherIdFromUserId(userId: string): Promise<string | null> {
  const teacher = await db.teacher.findUnique({
    where: { userId },
    select: { id: true },
  })
  return teacher?.id ?? null
}

/**
 * Return the list of class IDs a teacher is assigned to.
 *
 * @param userId        The User id (from x-user-id header)
 * @param schoolYear    Optional school year filter. When provided, only
 *                      classes whose `schoolYear` matches are returned.
 *                      This keeps a teacher locked to the active year.
 */
export async function getTeacherClassIds(
  userId: string,
  schoolYear?: string | null,
): Promise<string[]> {
  const teacherId = await getTeacherIdFromUserId(userId)
  if (!teacherId) return []

  const assignments = await db.classTeacher.findMany({
    where: { teacherId },
    select: {
      classId: true,
      class: { select: { schoolYear: true } },
    },
  })

  const filtered = schoolYear
    ? assignments.filter((a) => a.class?.schoolYear === schoolYear)
    : assignments

  // Deduplicate (a teacher may have multiple ClassTeacher rows for the
  // same class if they teach different subjects there — though our schema
  // uses one row per subject, the class itself is the same).
  return Array.from(new Set(filtered.map((a) => a.classId)))
}
