import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/messages/users?userId=...&role=...&institutionId=...&q=...
 *
 * Returns the list of users the current user is allowed to message.
 *
 * Scoping:
 *   - super_admin  -> every active User (optionally filtered by institutionId)
 *   - admin        -> every active User in the same institution
 *   - other roles  -> every active User in the same institution (so a student
 *                     can message a teacher, a parent can message an admin, …)
 *
 * The current user (userId) is always excluded from the list.
 *
 * Query params:
 *   userId         (required) current user id
 *   role           (required) current user role
 *   institutionId  (optional) current user institution (required for non-super_admin)
 *   q              (optional) search string on name/email/userCode (case-insensitive)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const role = searchParams.get('role') || ''
    const institutionId = searchParams.get('institutionId')
    const q = searchParams.get('q')?.trim()

    if (!userId) {
      return NextResponse.json(
        { error: 'Paramètre userId requis' },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {
      active: true,
      id: { not: userId },
    }

    if (role !== 'super_admin') {
      // Scope to same institution. If no institutionId is provided, return
      // empty rather than leaking users from other institutions.
      if (!institutionId || institutionId === 'inst_default') {
        return NextResponse.json({ users: [] })
      }
      where.institutionId = institutionId
    } else if (institutionId && institutionId !== 'inst_default') {
      // super_admin can optionally filter by institution
      where.institutionId = institutionId
    }

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
        { userCode: { contains: q } },
        { username: { contains: q } },
      ]
    }

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        userCode: true,
        institutionId: true,
        institution: { select: { name: true } },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      take: 200,
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Get messageable users error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des utilisateurs' },
      { status: 500 }
    )
  }
}
