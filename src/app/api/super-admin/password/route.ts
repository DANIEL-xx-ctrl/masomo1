import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { id, currentPassword, newPassword } = await request.json()

    if (!id || !currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Tous les champs sont requis' }, { status: 400 })
    }

    const superAdmin = await db.superAdmin.findUnique({ where: { id } })

    if (!superAdmin) {
      return NextResponse.json({ error: 'Super admin introuvable' }, { status: 404 })
    }

    if (superAdmin.password !== currentPassword) {
      return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 401 })
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ error: 'Le nouveau mot de passe doit contenir au moins 4 caractères' }, { status: 400 })
    }

    await db.superAdmin.update({
      where: { id },
      data: { password: newPassword },
    })

    return NextResponse.json({ success: true, message: 'Mot de passe modifié avec succès' })
  } catch (error) {
    console.error('Change super admin password error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { id, newPassword } = await request.json()

    if (!id || !newPassword) {
      return NextResponse.json({ error: 'ID et nouveau mot de passe requis' }, { status: 400 })
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 4 caractères' }, { status: 400 })
    }

    await db.superAdmin.update({
      where: { id },
      data: { password: newPassword },
    })

    return NextResponse.json({ success: true, message: 'Mot de passe réinitialisé avec succès' })
  } catch (error) {
    console.error('Reset super admin password error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
