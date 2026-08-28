import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/superadmin/all-users
 *
 * Returns ALL users across ALL institutions (super admin only).
 * Includes: id, userCode, name, email, role, phone, password (plaintext),
 * institution name, active status.
 *
 * Query params:
 *   - search: filter by name/email/userCode/phone
 *   - role: filter by role (admin, teacher, student, parent, staff)
 *   - institutionId: filter by institution
 */
export async function GET(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')

    if (userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé. Seul un SuperAdmin peut voir tous les utilisateurs.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const roleFilter = searchParams.get('role') || 'all'
    const institutionFilter = searchParams.get('institutionId')

    const where: Record<string, unknown> = {}

    // Exclude super_admin from the list (they're in a separate table)
    where.NOT = { role: 'super_admin' }

    if (roleFilter !== 'all') {
      where.role = roleFilter
    }

    if (institutionFilter) {
      where.institutionId = institutionFilter
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { userCode: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        userCode: true,
        name: true,
        email: true,
        password: true,
        role: true,
        phone: true,
        active: true,
        institutionId: true,
        createdAt: true,
        updatedAt: true,
        institution: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ institution: { name: 'asc' } }, { role: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Get all users error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des utilisateurs' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/all-users
 *
 * Update any user's fields (super admin only).
 * Body: { id, name?, email?, password?, userCode?, phone?, role?, active? }
 */
export async function PUT(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')

    if (userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé. Seul un SuperAdmin peut modifier les utilisateurs.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, name, email, password, userCode, phone, role, active } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID utilisateur requis' },
        { status: 400 }
      )
    }

    const existing = await db.user.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    // Check email uniqueness if changing
    if (email && email !== existing.email) {
      const duplicate = await db.user.findUnique({ where: { email } })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Un utilisateur avec cet email existe déjà' },
          { status: 409 }
        )
      }
    }

    // Check userCode uniqueness within institution if changing
    if (userCode && userCode !== existing.userCode && existing.institutionId) {
      const duplicateCode = await db.user.findFirst({
        where: {
          userCode,
          institutionId: existing.institutionId,
          NOT: { id },
        },
      })
      if (duplicateCode) {
        return NextResponse.json(
          { error: `L'identifiant "${userCode}" est déjà utilisé dans cette institution.` },
          { status: 409 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (password !== undefined && password) updateData.password = password
    if (userCode !== undefined) updateData.userCode = userCode
    if (phone !== undefined) updateData.phone = phone
    if (role !== undefined) updateData.role = role
    if (active !== undefined) updateData.active = active

    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        userCode: true,
        name: true,
        email: true,
        password: true,
        role: true,
        phone: true,
        active: true,
        institutionId: true,
        institution: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ user: updated })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'utilisateur' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/all-users?id=...
 *
 * Delete any user (super admin only).
 */
export async function DELETE(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')

    if (userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé. Seul un SuperAdmin peut supprimer les utilisateurs.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID utilisateur requis' },
        { status: 400 }
      )
    }

    const existing = await db.user.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    // Delete related records first (cascade)
    await db.grade.deleteMany({ where: { student: { userId: id } } }).catch(() => {})
    await db.attendance.deleteMany({ where: { student: { userId: id } } }).catch(() => {})
    await db.bulletin.deleteMany({ where: { student: { userId: id } } }).catch(() => {})
    await db.payment.deleteMany({ where: { student: { userId: id } } }).catch(() => {})
    await db.notification.deleteMany({ where: { userId: id } }).catch(() => {})
    await db.message.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } }).catch(() => {})

    // Delete role-specific records
    if (existing.role === 'teacher') {
      await db.teacher.deleteMany({ where: { userId: id } }).catch(() => {})
    } else if (existing.role === 'student') {
      await db.student.deleteMany({ where: { userId: id } }).catch(() => {})
    } else if (existing.role === 'parent') {
      await db.parent.deleteMany({ where: { userId: id } }).catch(() => {})
    } else if (existing.role === 'staff') {
      await db.staff.deleteMany({ where: { userId: id } }).catch(() => {})
    }

    await db.user.delete({ where: { id } })

    return NextResponse.json({ message: 'Utilisateur supprimé avec succès' })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'utilisateur' },
      { status: 500 }
    )
  }
}

