import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * PUT /api/users/usercode — Modify a user's login ID (userCode)
 *
 * Body: { userId, newUserCode }
 *
 * Only admin and super_admin can call this route. The userCode is
 * validated to be non-empty and unique within the institution.
 */
export async function PUT(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé. Seul un administrateur peut modifier les identifiants.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userId, newUserCode } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId est requis.' },
        { status: 400 }
      )
    }

    if (!newUserCode || typeof newUserCode !== 'string') {
      return NextResponse.json(
        { error: 'Le nouvel identifiant est requis.' },
        { status: 400 }
      )
    }

    const trimmedCode = newUserCode.trim()
    if (trimmedCode.length < 2) {
      return NextResponse.json(
        { error: "L'identifiant doit contenir au moins 2 caractères." },
        { status: 400 }
      )
    }

    // Find the user (without institutionId filter — same fix as the
    // password route, to avoid blocking legitimate updates when the
    // fallback institutionId doesn't match).
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé.' },
        { status: 404 }
      )
    }

    // Check GLOBAL uniqueness — userCode must be unique across ALL
    // institutions to prevent login confusion (two users with "TCH-001"
    // in different institutions would both match the login search).
    const existing = await db.user.findFirst({
      where: {
        userCode: trimmedCode,
        NOT: { id: userId },
      },
      select: { id: true, name: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: `L'identifiant "${trimmedCode}" est déjà utilisé par un autre utilisateur (${existing.name}).` },
        { status: 409 }
      )
    }

    await db.user.update({
      where: { id: userId },
      data: { userCode: trimmedCode },
    })

    return NextResponse.json({
      message: `Identifiant de "${user.name}" modifié en "${trimmedCode}" avec succès.`,
      userCode: trimmedCode,
    })
  } catch (error) {
    console.error('Update userCode error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la modification de l'identifiant." },
      { status: 500 }
    )
  }
}
