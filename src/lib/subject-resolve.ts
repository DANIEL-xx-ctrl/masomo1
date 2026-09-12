import { db } from '@/lib/db'

/**
 * Resolve a Subject id from either an existing subjectId or a free-text
 * subject name.
 *
 * Resolution order:
 *  1. If `subjectId` is provided and exists in the database, use it.
 *  2. Else if `subjectName` is provided (non-empty after trim):
 *      a. Try to find an existing subject whose name matches
 *         case-insensitively. SQLite does not support Prisma's
 *         `mode: 'insensitive'`, so we fetch the subjects and match in JS.
 *      b. If none matches, create a new Subject with an auto-generated
 *         unique code derived from the name.
 *  3. Otherwise return null (no subject).
 *
 * This lets the homework form let users freely type a subject name
 * (e.g. "Histoire-Géo") instead of only picking from a fixed list.
 */
export async function resolveSubjectId(
  subjectId: string | null | undefined,
  subjectName: string | null | undefined
): Promise<string | null> {
  if (subjectId) {
    const existing = await db.subject.findUnique({ where: { id: subjectId } })
    if (existing) return existing.id
  }

  const name = subjectName?.trim()
  if (!name) return null

  const all = await db.subject.findMany({ select: { id: true, name: true, code: true } })

  const found = all.find(s => s.name.toLowerCase() === name.toLowerCase())
  if (found) return found.id

  // Build a unique code from the name (strip accents, keep alnum, uppercase).
  const baseCode =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6) || 'SUB'

  const existingCodes = new Set(all.map(s => s.code.toUpperCase()))
  let code = baseCode
  let suffix = 1
  while (existingCodes.has(code.toUpperCase())) {
    code = `${baseCode}${suffix}`
    suffix += 1
    if (suffix > 1000) break // safety guard
  }

  const created = await db.subject.create({
    data: { name, code, coefficient: 1 },
  })
  return created.id
}
