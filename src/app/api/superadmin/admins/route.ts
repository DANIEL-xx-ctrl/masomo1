import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Admins are stored as Users with role='admin'. There is no separate Admin model.

export async function GET(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')

    if (userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé. Seul un SuperAdmin peut gérer les administrateurs.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const filterInstitutionId = searchParams.get('institutionId')
    // Only the super admin "Liste des administrateurs" tab asks for the
    // plaintext password column. Other callers (the editable admins list)
    // keep receiving admins WITHOUT the password.
    const includePassword = searchParams.get('includePassword') === 'true'

    const where: Record<string, unknown> = { role: 'admin' }

    if (filterInstitutionId) {
      where.institutionId = filterInstitutionId
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    const admins = await db.user.findMany({
      where,
      include: {
        institution: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (includePassword) {
      // Explicitly requested by the super admin list view. The endpoint is
      // already guarded by x-user-role === 'super_admin' above.
      const adminsWithPasswords = admins.map((admin) => ({
        ...admin,
        institution: admin.institution,
      }))
      return NextResponse.json({ admins: adminsWithPasswords })
    }

    // Default: strip passwords from response
    const adminsWithoutPasswords = admins.map(({ password: _password, ...admin }) => ({
      ...admin,
      institution: admin.institution,
    }))

    return NextResponse.json({ admins: adminsWithoutPasswords })
  } catch (error) {
    console.error('Get admins error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des administrateurs' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé. Seul un SuperAdmin peut créer un administrateur.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, email, password, avatar, phone, institutionId, active } = body

    if (!name || !email || !password || !institutionId) {
      return NextResponse.json(
        { error: 'Nom, email, mot de passe et institution requis' },
        { status: 400 }
      )
    }

    // Check institution exists
    const institution = await db.institution.findUnique({
      where: { id: institutionId },
    })

    if (!institution) {
      return NextResponse.json(
        { error: 'Institution non trouvée' },
        { status: 404 }
      )
    }

    // Check email uniqueness
    const existingAdmin = await db.user.findUnique({
      where: { email },
    })

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'Un utilisateur avec cet email existe déjà' },
        { status: 409 }
      )
    }

    const admin = await db.user.create({
      data: {
        name,
        email,
        password,
        role: 'admin',
        avatar,
        phone,
        institutionId,
        userCode: `ADM-${Date.now().toString().slice(-6)}`,
        active: active !== undefined ? active : true,
      },
      include: {
        institution: {
          select: { id: true, name: true },
        },
      },
    })

    const { password: _password, ...adminWithoutPassword } = admin

    return NextResponse.json({ admin: adminWithoutPassword }, { status: 201 })
  } catch (error) {
    console.error('Create admin error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'administrateur' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé. Seul un SuperAdmin peut modifier un administrateur.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, name, email, password, avatar, phone, institutionId, active } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID administrateur requis' },
        { status: 400 }
      )
    }

    const existing = await db.user.findFirst({
      where: { id, role: 'admin' },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Administrateur non trouvé' },
        { status: 404 }
      )
    }

    // Check email uniqueness if changing
    if (email && email !== existing.email) {
      const duplicate = await db.user.findUnique({
        where: { email },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Un utilisateur avec cet email existe déjà' },
          { status: 409 }
        )
      }
    }

    const admin = await db.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(password !== undefined && password && { password }),
        ...(avatar !== undefined && { avatar }),
        ...(phone !== undefined && { phone }),
        ...(institutionId !== undefined && { institutionId }),
        ...(active !== undefined && { active }),
      },
      include: {
        institution: {
          select: { id: true, name: true },
        },
      },
    })

    const { password: _password, ...adminWithoutPassword } = admin

    return NextResponse.json({ admin: adminWithoutPassword })
  } catch (error) {
    console.error('Update admin error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'administrateur' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé. Seul un SuperAdmin peut supprimer un administrateur.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID administrateur requis' },
        { status: 400 }
      )
    }

    const existing = await db.user.findFirst({
      where: { id, role: 'admin' },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Administrateur non trouvé' },
        { status: 404 }
      )
    }

    await db.user.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Administrateur supprimé avec succès' })
  } catch (error) {
    console.error('Delete admin error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'administrateur' },
      { status: 500 }
    )
  }
}
