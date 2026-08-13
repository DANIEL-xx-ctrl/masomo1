import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }

    const superAdmin = await db.superAdmin.findUnique({
      where: { email },
    })

    if (!superAdmin) {
      return NextResponse.json(
        { error: 'SuperAdmin non trouvé' },
        { status: 404 }
      )
    }

    if (superAdmin.password !== password) {
      return NextResponse.json(
        { error: 'Mot de passe incorrect' },
        { status: 401 }
      )
    }

    if (!superAdmin.active) {
      return NextResponse.json(
        { error: 'Compte désactivé' },
        { status: 403 }
      )
    }

    const { password: _, ...superAdminWithoutPassword } = superAdmin

    return NextResponse.json({
      superAdmin: superAdminWithoutPassword,
      message: 'Connexion réussie',
    })
  } catch (error) {
    console.error('SuperAdmin login error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la connexion' },
      { status: 500 }
    )
  }
}
