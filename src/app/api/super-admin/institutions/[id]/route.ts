import { db } from '@/lib/db'
import { NextResponse, NextRequest } from 'next/server'

// PUT /api/super-admin/institutions/[id] - Update an institution (superAdmin only)
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
    const { name, password, address, phone, email, currentYear, active } = body

    // Check if institution exists
    const existing = await db.institution.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Institution non trouvée' }, { status: 404 })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined && name.trim()) updateData.name = name.trim()
    if (password !== undefined && password.trim()) {
      // Check password uniqueness if changing
      if (password.trim() !== existing.password) {
        const passwordTaken = await db.institution.findFirst({
          where: { password: password.trim(), NOT: { id } },
        })
        if (passwordTaken) {
          return NextResponse.json({ error: 'Ce mot de passe d\'institution est déjà utilisé' }, { status: 409 })
        }
      }
      updateData.password = password.trim()
    }
    if (address !== undefined) updateData.address = address || null
    if (phone !== undefined) updateData.phone = phone || null
    if (email !== undefined) updateData.email = email || null
    if (currentYear !== undefined && currentYear.trim()) updateData.currentYear = currentYear.trim()
    if (active !== undefined) updateData.active = active

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune modification à effectuer' }, { status: 400 })
    }

    const institution = await db.institution.update({
      where: { id },
      data: updateData,
    })

    // Also update SchoolConfig if relevant fields changed
    if (name || address || phone || email || currentYear || password) {
      const configUpdate: Record<string, unknown> = {}
      if (name) configUpdate.schoolName = name.trim()
      if (address !== undefined) configUpdate.address = address || null
      if (phone !== undefined) configUpdate.phone = phone || null
      if (email !== undefined) configUpdate.email = email || null
      if (currentYear) configUpdate.currentYear = currentYear.trim()
      if (password) configUpdate.institutionPassword = password.trim()

      await db.schoolConfig.updateMany({
        where: { institutionId: id },
        data: configUpdate,
      })
    }

    return NextResponse.json({ institution, message: 'Institution mise à jour avec succès' })
  } catch (error) {
    console.error('Update institution error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/super-admin/institutions/[id] - Deactivate/delete an institution (superAdmin only)
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

    // Check if institution exists
    const existing = await db.institution.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Institution non trouvée' }, { status: 404 })
    }

    // Don't allow deleting the last active institution
    const activeCount = await db.institution.count({ where: { active: true } })
    if (existing.active && activeCount <= 1) {
      return NextResponse.json(
        { error: 'Impossible de désactiver la dernière institution active. Il doit y avoir au moins une institution active.' },
        { status: 400 }
      )
    }

    const mode = request.headers.get('x-delete-mode') || 'deactivate'

    if (mode === 'permanent') {
      // Permanent delete — only if no users exist
      if (existing._count.users > 0) {
        return NextResponse.json(
          { error: `Impossible de supprimer définitivement cette institution : elle contient ${existing._count.users} utilisateur(s). Désactivez-la d'abord.` },
          { status: 400 }
        )
      }
      await db.institution.delete({ where: { id } })
      return NextResponse.json({ message: 'Institution supprimée définitivement' })
    } else {
      // Soft delete — deactivate
      await db.institution.update({
        where: { id },
        data: { active: false },
      })
      // Also deactivate all users in this institution
      await db.user.updateMany({
        where: { institutionId: id },
        data: { active: false },
      })
      // End all active sessions
      const usersInInst = await db.user.findMany({
        where: { institutionId: id },
        select: { id: true },
      })
      if (usersInInst.length > 0) {
        await db.userSession.updateMany({
          where: { userId: { in: usersInInst.map(u => u.id) }, isActive: true },
          data: { isActive: false },
        })
      }
      return NextResponse.json({ message: 'Institution désactivée avec succès. Tous ses utilisateurs ont été désactivés.' })
    }
  } catch (error) {
    console.error('Delete institution error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
