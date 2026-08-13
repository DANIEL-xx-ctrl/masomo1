import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })
    }

    const superAdmin = await db.superAdmin.findUnique({ where: { email } })

    if (!superAdmin) {
      return NextResponse.json({ error: 'Identifiants super admin incorrects' }, { status: 401 })
    }

    if (!superAdmin.active) {
      return NextResponse.json({ error: 'Compte super admin désactivé' }, { status: 403 })
    }

    if (superAdmin.password !== password) {
      return NextResponse.json({ error: 'Identifiants super admin incorrects' }, { status: 401 })
    }

    return NextResponse.json({
      superAdmin: {
        id: superAdmin.id,
        name: superAdmin.name,
        email: superAdmin.email,
        avatar: superAdmin.avatar,
        phone: superAdmin.phone,
        address: superAdmin.address,
        active: superAdmin.active,
      },
    })
  } catch (error) {
    console.error('Super admin login error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
