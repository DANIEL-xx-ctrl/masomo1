import { db } from '@/lib/db'
import { NextResponse, NextRequest } from 'next/server'

// POST /api/super-admin/switch-institution - Switch the superAdmin's active institution
export async function POST(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role')
    const userId = request.headers.get('x-user-id')

    if (userRole !== 'superAdmin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })
    }

    const body = await request.json()
    const { institutionId } = body

    if (!institutionId) {
      return NextResponse.json({ error: 'ID de l\'institution requis' }, { status: 400 })
    }

    // Verify the institution exists and is active
    const institution = await db.institution.findFirst({
      where: { id: institutionId, active: true },
    })

    if (!institution) {
      return NextResponse.json({ error: 'Institution non trouvée ou inactive' }, { status: 404 })
    }

    // Update the superAdmin's institutionId in the database
    await db.user.update({
      where: { id: userId },
      data: { institutionId: institution.id },
    })

    return NextResponse.json({
      institutionId: institution.id,
      institutionName: institution.name,
      institutionPassword: institution.password,
      message: `Institution changée vers ${institution.name}`,
    })
  } catch (error) {
    console.error('Switch institution error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
