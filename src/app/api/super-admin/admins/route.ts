import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const admins = await db.user.findMany({
      where: { role: 'admin' },
      include: {
        institution: {
          select: { id: true, name: true, password: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const formattedAdmins = admins.map((a) => ({
      id: a.id,
      userCode: a.userCode,
      email: a.email,
      name: a.name,
      avatar: a.avatar,
      phone: a.phone,
      active: a.active,
      institutionId: a.institutionId,
      institutionName: a.institution?.name || 'N/A',
      institutionPassword: a.institution?.password || '',
      createdAt: a.createdAt,
    }))

    return NextResponse.json({ admins: formattedAdmins })
  } catch (error) {
    console.error('Get admins error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name, email, password, institutionId } = await request.json()

    if (!name || !email || !password || !institutionId) {
      return NextResponse.json({ error: 'Tous les champs sont requis (nom, email, mot de passe, institution)' }, { status: 400 })
    }

    if (password.length < 4) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 4 caractères' }, { status: 400 })
    }

    const institution = await db.institution.findUnique({ where: { id: institutionId } })
    if (!institution) {
      return NextResponse.json({ error: 'Institution introuvable' }, { status: 404 })
    }

    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Un utilisateur avec cet email existe déjà' }, { status: 409 })
    }

    const adminCount = await db.user.count({
      where: { role: 'admin', institutionId },
    })
    const userCode = `ADM-${String(adminCount + 1).padStart(3, '0')}`

    const admin = await db.user.create({
      data: {
        userCode,
        name,
        email,
        password,
        role: 'admin',
        institutionId,
        active: true,
      },
      include: {
        institution: {
          select: { id: true, name: true, password: true },
        },
      },
    })

    return NextResponse.json({
      admin: {
        id: admin.id,
        userCode: admin.userCode,
        name: admin.name,
        email: admin.email,
        active: admin.active,
        institutionId: admin.institutionId,
        institutionName: admin.institution?.name || 'N/A',
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Create admin error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { id, password, active, name, email, phone } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (password !== undefined) updateData.password = password
    if (active !== undefined) updateData.active = active
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone

    const admin = await db.user.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        active: admin.active,
      },
    })
  } catch (error) {
    console.error('Update admin error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    await db.user.update({
      where: { id },
      data: { active: false },
    })

    return NextResponse.json({ success: true, message: 'Admin désactivé avec succès' })
  } catch (error) {
    console.error('Delete admin error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
