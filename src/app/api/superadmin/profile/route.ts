import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const superAdminId = request.headers.get('x-super-admin-id')

    if (!superAdminId) {
      return NextResponse.json(
        { error: 'ID SuperAdmin requis' },
        { status: 400 }
      )
    }

    const superAdmin = await db.superAdmin.findUnique({
      where: { id: superAdminId },
    })

    if (!superAdmin) {
      return NextResponse.json(
        { error: 'SuperAdmin non trouvé' },
        { status: 404 }
      )
    }

    const { password: _, ...superAdminWithoutPassword } = superAdmin

    return NextResponse.json({ superAdmin: superAdminWithoutPassword })
  } catch (error) {
    console.error('Get SuperAdmin profile error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du profil' },
      { status: 500 }
    )
  }
}

// PUT /api/superadmin/profile — Update the SuperAdmin's own profile.
//
// Supports:
//   - name, email, phone, address, avatar (basic profile fields)
//   - removeAvatar: 'true' to clear the avatar
//   - currentPassword + newPassword: change password (requires current password)
//   - currentPassword + deletePassword: 'true' to clear password (blocks login)
//
// Identified via the `x-super-admin-id` header (set by the FetchInterceptor
// when the logged-in user's role is `super_admin`). This is the SuperAdmin
// equivalent of /api/auth/profile — the two tables (User vs SuperAdmin) have
// separate ID spaces, so the regular /api/auth/profile endpoint cannot be
// used by a super admin.
export async function PUT(request: Request) {
  try {
    const superAdminId = request.headers.get('x-super-admin-id')

    if (!superAdminId) {
      return NextResponse.json(
        { error: 'ID SuperAdmin requis' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      name,
      email,
      avatar,
      phone,
      address,
      removeAvatar,
      currentPassword,
      newPassword,
      deletePassword,
    } = body as {
      name?: string
      email?: string
      avatar?: string | null
      phone?: string | null
      address?: string | null
      removeAvatar?: string
      currentPassword?: string
      newPassword?: string
      deletePassword?: string
    }

    const superAdmin = await db.superAdmin.findUnique({
      where: { id: superAdminId },
    })

    if (!superAdmin) {
      return NextResponse.json(
        { error: 'SuperAdmin non trouvé' },
        { status: 404 }
      )
    }

    // ---- Email uniqueness check ----
    if (email && email !== superAdmin.email) {
      const existing = await db.superAdmin.findUnique({
        where: { email },
      })
      if (existing) {
        return NextResponse.json(
          { error: 'Un SuperAdmin avec cet email existe déjà' },
          { status: 409 }
        )
      }
    }

    // ---- Build update data ----
    const updateData: Record<string, unknown> = {}

    if (name !== undefined && name.trim()) {
      updateData.name = name.trim()
    }
    if (email !== undefined && email.trim()) {
      updateData.email = email.trim()
    }
    if (phone !== undefined) {
      updateData.phone = phone?.trim() || null
    }
    if (address !== undefined) {
      updateData.address = address?.trim() || null
    }

    // Avatar: removal takes precedence over setting a new one.
    if (removeAvatar === 'true') {
      updateData.avatar = null
    } else if (avatar !== undefined && avatar !== null && avatar !== '') {
      updateData.avatar = avatar
    }

    // ---- Password change / deletion ----
    // Both require the current password to be verified first.
    const wantsPasswordChange = newPassword !== undefined && newPassword.trim().length > 0
    const wantsPasswordDelete = deletePassword === 'true'

    if (wantsPasswordChange || wantsPasswordDelete) {
      if (!currentPassword) {
        return NextResponse.json(
          {
            error: wantsPasswordDelete
              ? 'Veuillez saisir votre mot de passe actuel pour le supprimer.'
              : 'Veuillez saisir votre mot de passe actuel pour le modifier.',
          },
          { status: 400 }
        )
      }
      if (superAdmin.password !== currentPassword) {
        return NextResponse.json(
          { error: 'Mot de passe actuel incorrect.' },
          { status: 401 }
        )
      }
      if (wantsPasswordDelete) {
        updateData.password = ''
      } else {
        if (newPassword!.trim().length < 3) {
          return NextResponse.json(
            { error: 'Le nouveau mot de passe doit contenir au moins 3 caractères.' },
            { status: 400 }
          )
        }
        updateData.password = newPassword!.trim()
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Aucune modification à effectuer.' },
        { status: 400 }
      )
    }

    const updatedSuperAdmin = await db.superAdmin.update({
      where: { id: superAdminId },
      data: updateData,
    })

    const { password: _, ...superAdminWithoutPassword } = updatedSuperAdmin

    const action =
      updateData.password === ''
        ? 'password-deleted'
        : updateData.password
          ? 'password-changed'
          : 'profile-updated'

    return NextResponse.json({
      superAdmin: superAdminWithoutPassword,
      // Also expose the updated record under `user` so the Settings UI can
      // treat /api/superadmin/profile and /api/auth/profile uniformly (both
      // return the record under a `user` key in the response).
      user: superAdminWithoutPassword,
      message:
        action === 'password-deleted'
          ? 'Votre mot de passe a été supprimé. Vous ne pouvez plus vous connecter tant qu\'un nouveau mot de passe ne sera pas défini.'
          : action === 'password-changed'
            ? 'Profil et mot de passe mis à jour avec succès.'
            : 'Profil mis à jour avec succès.',
      action,
    })
  } catch (error) {
    console.error('Update SuperAdmin profile error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du profil' },
      { status: 500 }
    )
  }
}
