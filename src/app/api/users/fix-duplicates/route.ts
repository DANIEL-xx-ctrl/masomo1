import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { ROLE_PREFIX } from '@/lib/user-code'

/**
 * POST /api/users/fix-duplicates
 *
 * Finds and fixes duplicate userCodes across the entire database.
 * For each set of duplicates, keeps the first user's code and regenerates
 * a unique code for the others.
 *
 * Also fixes duplicate emails (appends a suffix to make them unique).
 *
 * Super admin only.
 */
export async function POST(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé. Seul un SuperAdmin peut exécuter cette action.' },
        { status: 403 }
      )
    }

    const results: { fixed: number; details: string[] } = { fixed: 0, details: [] }

    // ---- Fix duplicate userCodes ----
    const allUsers = await db.user.findMany({
      where: { userCode: { not: null } },
      select: { id: true, userCode: true, name: true, role: true, institutionId: true },
      orderBy: { createdAt: 'asc' },
    })

    // Group by userCode to find duplicates
    const codeGroups = new Map<string, typeof allUsers>()
    for (const u of allUsers) {
      if (!u.userCode) continue
      const group = codeGroups.get(u.userCode) || []
      group.push(u)
      codeGroups.set(u.userCode, group)
    }

    // For each duplicate group, keep the first user's code and regenerate for the rest
    for (const [code, users] of codeGroups.entries()) {
      if (users.length <= 1) continue // no duplicate

      // Keep the first user's code, fix the rest
      for (let i = 1; i < users.length; i++) {
        const user = users[i]
        const prefix = ROLE_PREFIX[user.role] || 'USR'

        // Find the next available number for this prefix globally
        const existingCodes = await db.user.findMany({
          where: { userCode: { startsWith: `${prefix}-` } },
          select: { userCode: true },
        })
        const usedNumbers = new Set(
          existingCodes
            .map((u) => {
              const m = u.userCode?.match(new RegExp(`^${prefix}-(\\d+)$`))
              return m ? parseInt(m[1], 10) : 0
            })
            .filter((n) => n > 0)
        )
        let nextNum = 1
        while (usedNumbers.has(nextNum)) nextNum++
        const newCode = `${prefix}-${String(nextNum).padStart(3, '0')}`

        await db.user.update({
          where: { id: user.id },
          data: { userCode: newCode },
        })

        results.fixed++
        results.details.push(`${user.name}: ${code} → ${newCode}`)
      }
    }

    // ---- Fix duplicate emails ----
    const emailGroups = new Map<string, typeof allUsers>()
    const allUsersWithEmail = await db.user.findMany({
      select: { id: true, email: true, name: true },
      orderBy: { createdAt: 'asc' },
    })
    for (const u of allUsersWithEmail) {
      const group = emailGroups.get(u.email) || []
      group.push(u)
      emailGroups.set(u.email, group)
    }

    for (const [email, users] of emailGroups.entries()) {
      if (users.length <= 1) continue

      for (let i = 1; i < users.length; i++) {
        const user = users[i]
        const newEmail = `${email.split('@')[0]}_${i}@${email.split('@')[1] || 'edugest.local'}`

        await db.user.update({
          where: { id: user.id },
          data: { email: newEmail },
        })

        results.fixed++
        results.details.push(`${user.name} email: ${email} → ${newEmail}`)
      }
    }

    return NextResponse.json({
      message: `${results.fixed} doublon(s) corrigé(s).`,
      fixedCount: results.fixed,
      details: results.details,
    })
  } catch (error) {
    console.error('Fix duplicates error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la correction des doublons', detail: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}

