import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

// ============================================================
// /api/settings/institution
// Allows an admin (or super_admin) to read, define, modify and
// delete their OWN institution. Unlike /api/institutions which
// is reserved to super_admin for cross-institution management,
// this endpoint is scoped to the admin's current institution.
// ============================================================

function checkAdminOrSuper(request: Request): NextResponse | null {
  const role = request.headers.get('x-user-role')
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Accès non autorisé. Seul un administrateur peut gérer son institution.' },
      { status: 403 }
    )
  }
  return null
}

// GET — current admin's institution details
export async function GET(request: NextRequest) {
  try {
    const forbidden = checkAdminOrSuper(request)
    if (forbidden) return forbidden

    const institutionId = await getInstitutionIdWithFallback(request)
    if (!institutionId || institutionId === 'inst_default') {
      return NextResponse.json(
        { error: 'Aucune institution associée à ce compte.' },
        { status: 404 }
      )
    }

    const institution = await db.institution.findUnique({
      where: { id: institutionId },
      include: {
        _count: {
          select: { users: true, classes: true },
        },
      },
    })

    if (!institution) {
      return NextResponse.json(
        { error: 'Institution non trouvée.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ institution })
  } catch (error) {
    console.error('Get institution error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'institution.' },
      { status: 500 }
    )
  }
}

// POST — Define / create a NEW institution for the admin (if they don't have one yet)
// If the admin already belongs to an institution, we refuse — they should use PUT instead.
export async function POST(request: NextRequest) {
  try {
    const forbidden = checkAdminOrSuper(request)
    if (forbidden) return forbidden

    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }

    // Check if admin already belongs to an institution
    const currentUser = await db.user.findUnique({
      where: { id: userId },
      select: { institutionId: true, name: true },
    })
    if (!currentUser) {
      return NextResponse.json({ error: 'Utilisateur non trouvé.' }, { status: 404 })
    }
    if (currentUser.institutionId) {
      return NextResponse.json(
        {
          error:
            'Vous appartenez déjà à une institution. Utilisez la modification pour la mettre à jour.',
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, password, address, phone, email, logo, currentYear } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Le nom de l\'institution est requis.' }, { status: 400 })
    }
    if (!password || !password.trim()) {
      return NextResponse.json({ error: 'Le mot de passe de l\'institution est requis.' }, { status: 400 })
    }

    // Check password uniqueness
    const existing = await db.institution.findFirst({ where: { password: password.trim() } })
    if (existing) {
      return NextResponse.json(
        { error: 'Ce mot de passe d\'institution est déjà utilisé par une autre institution.' },
        { status: 409 }
      )
    }

    const institution = await db.institution.create({
      data: {
        name: name.trim(),
        password: password.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        logo: logo || null,
        currentYear: currentYear?.trim() || '2024-2025',
        active: true,
      },
    })

    // Link admin to the new institution
    await db.user.update({
      where: { id: userId },
      data: { institutionId: institution.id },
    })

    // Create a default SchoolConfig entry for this institution
    await db.schoolConfig.create({
      data: {
        schoolName: institution.name,
        address: institution.address,
        phone: institution.phone,
        email: institution.email,
        logo: institution.logo,
        currentYear: institution.currentYear,
        institutionId: institution.id,
        institutionPassword: institution.password,
      },
    })

    return NextResponse.json(
      { institution, message: `Institution « ${institution.name} » créée et associée à votre compte.` },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create institution error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'institution.' },
      { status: 500 }
    )
  }
}

// PUT — Modify the admin's institution (name, address, phone, email, logo, currentYear, password)
export async function PUT(request: NextRequest) {
  try {
    const forbidden = checkAdminOrSuper(request)
    if (forbidden) return forbidden

    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }

    const currentUser = await db.user.findUnique({
      where: { id: userId },
      select: { institutionId: true },
    })
    if (!currentUser?.institutionId) {
      return NextResponse.json(
        { error: 'Vous n\'avez pas d\'institution. Créez-en une d\'abord.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, password, address, phone, email, logo, currentYear, active } = body

    const existing = await db.institution.findUnique({
      where: { id: currentUser.institutionId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Institution non trouvée.' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined && name.trim()) updateData.name = name.trim()
    if (address !== undefined) updateData.address = address?.trim() || null
    if (phone !== undefined) updateData.phone = phone?.trim() || null
    if (email !== undefined) updateData.email = email?.trim() || null
    if (logo !== undefined) updateData.logo = logo || null
    if (currentYear !== undefined && currentYear.trim()) updateData.currentYear = currentYear.trim()
    if (active !== undefined) updateData.active = active

    // Password change for institution: check uniqueness
    if (password !== undefined && password.trim() && password.trim() !== existing.password) {
      const conflict = await db.institution.findFirst({
        where: { password: password.trim(), NOT: { id: existing.id } },
      })
      if (conflict) {
        return NextResponse.json(
          { error: 'Ce mot de passe d\'institution est déjà utilisé.' },
          { status: 409 }
        )
      }
      updateData.password = password.trim()
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune modification à effectuer.' }, { status: 400 })
    }

    const institution = await db.institution.update({
      where: { id: existing.id },
      data: updateData,
    })

    // Mirror the changes into SchoolConfig so school-wide display stays in sync
    const configUpdate: Record<string, unknown> = {}
    if (updateData.name) configUpdate.schoolName = updateData.name
    if ('address' in updateData) configUpdate.address = updateData.address
    if ('phone' in updateData) configUpdate.phone = updateData.phone
    if ('email' in updateData) configUpdate.email = updateData.email
    if ('logo' in updateData) configUpdate.logo = updateData.logo
    if (updateData.currentYear) configUpdate.currentYear = updateData.currentYear
    if (updateData.password) configUpdate.institutionPassword = updateData.password

    if (Object.keys(configUpdate).length > 0) {
      await db.schoolConfig.updateMany({
        where: { institutionId: existing.id },
        data: configUpdate,
      })
    }

    return NextResponse.json({
      institution,
      message: 'Institution mise à jour avec succès.',
    })
  } catch (error) {
    console.error('Update institution error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'institution.' },
      { status: 500 }
    )
  }
}

// DELETE — Delete the admin's institution
// Body: { mode: 'permanent' | 'deactivate' } (default: 'deactivate')
// Safety: prevent deletion of the last active institution.
export async function DELETE(request: NextRequest) {
  try {
    const forbidden = checkAdminOrSuper(request)
    if (forbidden) return forbidden

    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }

    const currentUser = await db.user.findUnique({
      where: { id: userId },
      select: { institutionId: true, name: true },
    })
    if (!currentUser?.institutionId) {
      return NextResponse.json(
        { error: 'Vous n\'avez pas d\'institution à supprimer.' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { mode } = body as { mode?: 'permanent' | 'deactivate' }
    const deleteMode = mode || 'deactivate'

    const existing = await db.institution.findUnique({
      where: { id: currentUser.institutionId },
      include: { _count: { select: { users: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Institution non trouvée.' }, { status: 404 })
    }

    // Don't allow deleting the last active institution
    const activeCount = await db.institution.count({ where: { active: true } })
    if (existing.active && activeCount <= 1) {
      return NextResponse.json(
        { error: 'Impossible de supprimer la dernière institution active.' },
        { status: 400 }
      )
    }

    const institutionId = existing.id

    if (deleteMode === 'permanent') {
      // Permanent delete — cascade-delete everything attached to this institution.
      const usersInInst = await db.user.findMany({
        where: { institutionId },
        select: { id: true },
      })
      const userIds = usersInInst.map((u) => u.id)

      if (userIds.length > 0) {
        await db.userSession.deleteMany({ where: { userId: { in: userIds } } })
      }
      await db.student.deleteMany({ where: { user: { institutionId } } })
      await db.teacher.deleteMany({ where: { user: { institutionId } } })
      await db.parent.deleteMany({ where: { user: { institutionId } } })
      await db.staff.deleteMany({ where: { user: { institutionId } } })
      await db.class.deleteMany({ where: { institutionId } })
      await db.schoolEvent.deleteMany({ where: { institutionId } })
      await db.homework.deleteMany({ where: { institutionId } })
      if (userIds.length > 0) {
        await db.announcement.deleteMany({ where: { authorId: { in: userIds } } })
        await db.notification.deleteMany({ where: { institutionId } })
      }
      await db.schoolConfig.deleteMany({ where: { institutionId } })
      await db.schoolYear.deleteMany({ where: { institutionId } })
      await db.mediaFile.deleteMany({ where: { institutionId } })
      await db.user.deleteMany({ where: { institutionId } })
      await db.institution.delete({ where: { id: institutionId } })

      return NextResponse.json({
        message: `Institution « ${existing.name} » supprimée définitivement avec toutes ses données.`,
      })
    } else {
      // Soft delete — deactivate institution + its users + end sessions
      await db.institution.update({
        where: { id: institutionId },
        data: { active: false },
      })
      await db.user.updateMany({
        where: { institutionId },
        data: { active: false },
      })
      const usersInInst = await db.user.findMany({
        where: { institutionId },
        select: { id: true },
      })
      if (usersInInst.length > 0) {
        await db.userSession.updateMany({
          where: { userId: { in: usersInInst.map((u) => u.id) }, isActive: true },
          data: { isActive: false },
        })
      }
      return NextResponse.json({
        message: `Institution « ${existing.name} » désactivée. Tous ses utilisateurs ont été désactivés.`,
      })
    }
  } catch (error) {
    console.error('Delete institution error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'institution.' },
      { status: 500 }
    )
  }
}
