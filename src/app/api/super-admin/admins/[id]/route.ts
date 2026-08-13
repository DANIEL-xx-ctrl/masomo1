import { db } from '@/lib/db'
import { NextResponse, NextRequest } from 'next/server'

// PUT /api/super-admin/admins/[id] - Update an admin (superAdmin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'superAdmin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, email, password, institutionId } = body

    // Check if admin exists
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Administrateur non trouvé' }, { status: 404 })
    }

    if (existing.role !== 'admin') {
      return NextResponse.json({ error: 'Cet utilisateur n\'est pas un administrateur' }, { status: 400 })
    }

    // Check email uniqueness if changing
    if (email && email !== existing.email) {
      const emailTaken = await db.user.findUnique({ where: { email } })
      if (emailTaken) {
        return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 409 })
      }
    }

    // Verify institution exists if changing
    if (institutionId && institutionId !== existing.institutionId) {
      const institution = await db.institution.findUnique({ where: { id: institutionId } })
      if (!institution) {
        return NextResponse.json({ error: 'Institution non trouvée' }, { status: 404 })
      }
    }

    const updateData: Record<string, string> = {}
    if (name) updateData.name = name
    if (email) updateData.email = email
    if (password) updateData.password = password
    if (institutionId) updateData.institutionId = institutionId

    const admin = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        institution: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({ admin })
  } catch (error) {
    console.error('Update admin error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/super-admin/admins/[id] - Deactivate an admin (superAdmin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'superAdmin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = await params

    // Check if admin exists
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Administrateur non trouvé' }, { status: 404 })
    }

    if (existing.role !== 'admin') {
      return NextResponse.json({ error: 'Cet utilisateur n\'est pas un administrateur' }, { status: 400 })
    }

    // Soft delete - deactivate the admin
    await db.user.update({
      where: { id },
      data: { active: false },
    })

    // Also end all active sessions for this admin
    await db.userSession.updateMany({
      where: { userId: id, isActive: true },
      data: { isActive: false },
    })

    return NextResponse.json({ message: 'Administrateur désactivé avec succès' })
  } catch (error) {
    console.error('Delete admin error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
