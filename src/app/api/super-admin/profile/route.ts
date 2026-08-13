import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const superAdmin = await db.superAdmin.findFirst({ where: { active: true } })

    if (!superAdmin) {
      return NextResponse.json({ error: 'Aucun super admin trouvé' }, { status: 404 })
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
    console.error('Get super admin profile error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, avatar, phone, address } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const updateData: { name?: string; avatar?: string; phone?: string | null; address?: string | null } = {}
    if (name !== undefined) updateData.name = name
    if (avatar !== undefined) updateData.avatar = avatar
    if (phone !== undefined) updateData.phone = phone
    if (address !== undefined) updateData.address = address

    const superAdmin = await db.superAdmin.update({
      where: { id },
      data: updateData,
    })

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
    console.error('Update super admin profile error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
