import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, institutionId } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }

    // The login form accepts an email OR a username OR a user code OR a full
    // name (the `name` field on User, e.g. "Jean Dupont") in the "email" field.
    // We resolve the actual account by trying, in order:
    //   1. SuperAdmin by email
    //   2. User by email
    //   3. User by username (case-insensitive)
    //   4. User by userCode (case-insensitive)
    //   5. User by full name (case-insensitive) — matches "Jean Dupont",
    //      "jean dupont", "JEAN DUPONT". Also matches a single token (first
    //      or last name): "Jean" or "Dupont".
    // SQLite's `equals` is case-sensitive, so the code/name lookups use
    // `contains` (LIKE) to fetch candidates, then a JS case-insensitive
    // compare for the exact match.

    // First, try SuperAdmin login (super admins always log in by email)
    const superAdmin = await db.superAdmin.findUnique({ where: { email } })
    if (superAdmin) {
      if (!superAdmin.active) {
        return NextResponse.json(
          { error: 'Compte super admin désactivé' },
          { status: 403 }
        )
      }
      if (superAdmin.password !== password) {
        return NextResponse.json(
          { error: 'Identifiants super admin incorrects' },
          { status: 401 }
        )
      }
      // Return as user with super_admin role for unified handling
      const { password: _, ...saWithoutPassword } = superAdmin
      return NextResponse.json({
        user: {
          ...saWithoutPassword,
          role: 'super_admin',
          phone: superAdmin.phone || null,
          avatar: superAdmin.avatar || null,
          userCode: null,
          institutionId: null,
          active: true,
          createdAt: superAdmin.createdAt,
          updatedAt: superAdmin.updatedAt,
          student: null,
          teacher: null,
          parent: null,
          staff: null,
        },
        message: 'Connexion réussie',
      })
    }

    // Then, try regular User login — by email first, then by id (cuid),
    // then by username, then by userCode, then by full name. The login form
    // sends whichever identifier the user typed in the `email` field.
    //
    // PostgreSQL note: Prisma's `equals` and `contains` are CASE-SENSITIVE
    // on Postgres by default, so we pass `mode: 'insensitive'` for all the
    // fallback lookups below. (On SQLite these were originally handled via
    // `contains` + a JS case-insensitive compare, which also works but is
    // less efficient.)
    let user = await db.user.findUnique({
      where: { email },
      include: {
        student: true,
        teacher: true,
        parent: true,
        staff: true,
        institution: {
          select: { id: true, name: true, active: true, currentYear: true },
        },
      },
    })

    // Fallback: try by primary key id (cuid, e.g. "cmr4nvhj3002hr1tzqd33rz99").
    // This lets users paste the database ID we list in admin exports and
    // still log in. findUnique on a non-existent id returns null, so this
    // is safe even for arbitrary strings.
    if (!user) {
      const trimmed = String(email).trim()
      if (trimmed) {
        try {
          user = await db.user.findUnique({
            where: { id: trimmed },
            include: {
              student: true,
              teacher: true,
              parent: true,
              staff: true,
              institution: {
                select: { id: true, name: true, active: true, currentYear: true },
              },
            },
          })
        } catch {
          // Invalid id format (not a valid cuid) — ignore and continue
          // to the next fallback. Prisma may throw on malformed ids.
        }
      }
    }

    // Fallback: try username (case-insensitive). PostgreSQL requires
    // `mode: 'insensitive'`; SQLite ignores it (but still works via lower()).
    if (!user) {
      const normalized = String(email).trim().toLowerCase()
      if (normalized) {
        user = await db.user.findFirst({
          where: { username: { equals: normalized, mode: 'insensitive' } },
          include: {
            student: true,
            teacher: true,
            parent: true,
            staff: true,
            institution: {
              select: { id: true, name: true, active: true, currentYear: true },
            },
          },
        })
      }
    }

    // Fallback: try userCode (case-insensitive). This is the main entry
    // point for students/staff who log in with their short ID (e.g. "ELV-001")
    // instead of their email. We use `mode: 'insensitive'` so "elv-001" matches
    // "ELV-001". We still do an exact JS compare afterward to avoid partial
    // matches (e.g. "ELV-001" should NOT match "ELV-0010").
    if (!user) {
      const normalized = String(email).trim().toLowerCase()
      if (normalized) {
        const codeCandidates = await db.user.findMany({
          where: { userCode: { contains: normalized, mode: 'insensitive' } },
          include: {
            student: true,
            teacher: true,
            parent: true,
            staff: true,
            institution: {
              select: { id: true, name: true, active: true, currentYear: true },
            },
          },
        })
        user =
          codeCandidates.find(
            (u) => (u.userCode || '').toLowerCase() === normalized
          ) || null
      }
    }

    // Fallback: try full name (the `name` field on User, e.g. "Jean Dupont").
    // The login form may receive "Jean Dupont" or just "Jean" or just "Dupont".
    // We normalize by trimming + collapsing whitespace + lowercasing.
    //
    // PostgreSQL note: `contains` with `mode: 'insensitive'` gives us a
    // case-insensitive LIKE. We then do an exact case-insensitive JS compare
    // to avoid false positives (e.g. "Jean" matching "Jean-Marc Dupont").
    if (!user) {
      const raw = String(email).trim().toLowerCase().replace(/\s+/g, ' ')
      if (raw && !raw.includes('@')) {
        const include = {
          student: true,
          teacher: true,
          parent: true,
          staff: true,
          institution: {
            select: { id: true, name: true, active: true, currentYear: true },
          },
        } as const

        const tokens = raw.split(' ')

        // 1. Full-name exact match (case-insensitive via JS compare).
        const candidates = await db.user.findMany({
          where: { name: { contains: tokens[0], mode: 'insensitive' } },
          include,
        })
        user = candidates.find((u) => u.name.toLowerCase() === raw) || null

        // 2. Single-token partial match (first or last name token).
        if (!user && tokens.length === 1) {
          user =
            candidates.find((u) => {
              const n = u.name.toLowerCase()
              return n.startsWith(raw + ' ') || n.endsWith(' ' + raw)
            }) || null
        }
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    if (user.password !== password) {
      return NextResponse.json(
        { error: 'Mot de passe incorrect' },
        { status: 401 }
      )
    }

    if (!user.active) {
      return NextResponse.json(
        { error: 'Compte désactivé' },
        { status: 403 }
      )
    }

    // ---- Institution-level block (super admin can disable an entire institution) ----
    // If the user's institution is inactive, refuse login — even if the user
    // record itself is active. This is the enforcement point for the super
    // admin "block institution" power.
    if (user.institution && user.institution.active === false) {
      return NextResponse.json(
        {
          error:
            'Votre établissement a été désactivé par le Super Admin. ' +
            'Contactez l\'administrateur général pour plus d\'informations.',
        },
        { status: 403 }
      )
    }

    // If institutionId is provided, verify user belongs to that institution.
    // This is a secondary safeguard — regular users can ONLY log in to their
    // own institution. Super admins don't go through this code path.
    if (institutionId && user.institutionId && user.institutionId !== institutionId) {
      return NextResponse.json(
        { error: 'Cet utilisateur n\'appartient pas à cette institution' },
        { status: 403 }
      )
    }

    const { password: _, institution: __, ...userWithoutPassword } = user

    return NextResponse.json({
      user: {
        ...userWithoutPassword,
        institutionName: user.institution?.name || null,
      },
      message: 'Connexion réussie',
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la connexion' },
      { status: 500 }
    )
  }
}
