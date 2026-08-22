import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

// GET /api/auth/profile — Get current user profile
export async function GET(request: NextRequest) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const user = await db.user.findFirst({
      where: { id: userId, institutionId },
      select: {
        id: true,
        userCode: true,
        email: true,
        username: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        active: true,
        institutionId: true,
        createdAt: true,
        updatedAt: true,
        institution: { select: { name: true } },
        student: { select: { image: true } },
        teacher: { select: { image: true } },
        parent: { select: { image: true } },
        staff: { select: { image: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Resolve avatar: user.avatar → role-specific image
    const resolvedAvatar = user.avatar
      || user.teacher?.image
      || user.student?.image
      || user.parent?.image
      || user.staff?.image
      || null

    return NextResponse.json({
      user: {
        ...user,
        // Flatten institution.name → institutionName so the frontend
        // Zustand store keeps the institution name after a profile refresh
        // (app-shell.tsx merges this response into currentUser, and without
        // this field the institution name was being cleared to undefined).
        institutionName: user.institution?.name || null,
        resolvedAvatar,
      },
    })
  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération du profil' }, { status: 500 })
  }
}

// PUT /api/auth/profile — Update current user profile
// Supports: name, email, phone, avatar (data URL), removeAvatar, role,
//           newPassword (with currentPassword verification), deletePassword.
// Accepts both JSON and FormData for flexibility.
export async function PUT(request: NextRequest) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') || ''
    let fields: Record<string, string | null> = {}

    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      formData.forEach((value, key) => {
        fields[key] = value instanceof File ? value.name : String(value)
      })
    } else {
      // JSON body
      try {
        const body = await request.json()
        fields = Object.fromEntries(
          Object.entries(body).map(([k, v]) => [k, v === null || v === undefined ? null : String(v)])
        )
      } catch {
        // Empty body
        fields = {}
      }
    }

    const name = fields.name ?? null
    const email = fields.email ?? null
    const phone = fields.phone ?? null
    const avatar = fields.avatar ?? null
    const role = fields.role ?? null
    const newPassword = fields.newPassword ?? null
    const currentPassword = fields.currentPassword ?? null
    const removeAvatar = fields.removeAvatar === 'true'
    const deletePassword = fields.deletePassword === 'true'

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (name !== null && name.trim()) {
      updateData.name = name.trim()
    }

    if (email !== null && email.trim()) {
      // Check if email is already used by another user
      const existingUser = await db.user.findFirst({
        where: { email: email.trim(), institutionId },
      })
      if (existingUser && existingUser.id !== userId) {
        return NextResponse.json(
          { error: 'Cet email est déjà utilisé par un autre utilisateur.' },
          { status: 409 }
        )
      }
      updateData.email = email.trim()
    }

    if (phone !== null) {
      updateData.phone = phone.trim() || null
    }

    if (role !== null && role.trim()) {
      const validRoles = ['admin', 'teacher', 'student', 'parent', 'staff', 'super_admin']
      if (!validRoles.includes(role.trim())) {
        return NextResponse.json(
          { error: `Rôle invalide. Rôles valides : ${validRoles.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.role = role.trim()
    }

    if (removeAvatar) {
      updateData.avatar = null
    } else if (avatar !== null && avatar !== '') {
      updateData.avatar = avatar
    }

    // Password deletion: block login (set to empty string).
    // For security, require current password verification.
    if (deletePassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Veuillez saisir votre mot de passe actuel pour le supprimer.' },
          { status: 400 }
        )
      }
      const user = await db.user.findFirst({
        where: { id: userId, institutionId },
        select: { password: true },
      })
      if (!user || user.password !== currentPassword) {
        return NextResponse.json(
          { error: 'Mot de passe actuel incorrect.' },
          { status: 401 }
        )
      }
      updateData.password = ''
    } else if (newPassword !== null && newPassword.trim()) {
      // Password change: require current password verification
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Veuillez saisir votre mot de passe actuel pour le modifier.' },
          { status: 400 }
        )
      }
      const user = await db.user.findFirst({
        where: { id: userId, institutionId },
        select: { password: true },
      })
      if (!user || user.password !== currentPassword) {
        return NextResponse.json(
          { error: 'Mot de passe actuel incorrect.' },
          { status: 401 }
        )
      }
      if (newPassword.trim().length < 3) {
        return NextResponse.json(
          { error: 'Le nouveau mot de passe doit contenir au moins 3 caractères.' },
          { status: 400 }
        )
      }
      updateData.password = newPassword.trim()
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune modification à effectuer.' }, { status: 400 })
    }

    // ---- Sync avatar to role-specific table ----
    // The settings page updates `User.avatar`, but the Teachers/Students/
    // Parents/Staff list modules display `Teacher.image` / `Student.image`
    // etc. (NOT user.avatar). Without syncing here, a teacher who changes
    // their avatar in Settings would see it update in the header but NOT
    // in the teachers list grid.
    const avatarChanged = 'avatar' in updateData
    if (avatarChanged) {
      // Fetch the user's role to know which table to update.
      const userBeforeUpdate = await db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })
      const newAvatarValue = removeAvatar ? null : (avatar || null)
      if (userBeforeUpdate?.role === 'teacher') {
        const existingTeacher = await db.teacher.findUnique({ where: { userId }, select: { id: true } })
        if (existingTeacher) {
          await db.teacher.update({ where: { userId }, data: { image: newAvatarValue } })
        }
      } else if (userBeforeUpdate?.role === 'staff') {
        const existingStaff = await db.staff.findUnique({ where: { userId }, select: { id: true } })
        if (existingStaff) {
          await db.staff.update({ where: { userId }, data: { image: newAvatarValue } })
        }
      } else if (userBeforeUpdate?.role === 'student') {
        const existingStudent = await db.student.findUnique({ where: { userId }, select: { id: true } })
        if (existingStudent) {
          await db.student.update({ where: { userId }, data: { image: newAvatarValue } })
        }
      } else if (userBeforeUpdate?.role === 'parent') {
        const existingParent = await db.parent.findUnique({ where: { userId }, select: { id: true } })
        if (existingParent) {
          await db.parent.update({ where: { userId }, data: { image: newAvatarValue } })
        }
      }
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        userCode: true,
        email: true,
        username: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        active: true,
        institutionId: true,
        createdAt: true,
        updatedAt: true,
        institution: { select: { name: true } },
      },
    })

    const action =
      updateData.password === ''
        ? 'password-deleted'
        : updateData.password
          ? 'password-changed'
          : 'profile-updated'

    return NextResponse.json({
      user: {
        ...updatedUser,
        institutionName: updatedUser.institution?.name || null,
      },
      message:
        action === 'password-deleted'
          ? 'Votre mot de passe a été supprimé. Vous ne pouvez plus vous connecter tant qu\'un nouveau mot de passe ne sera pas défini.'
          : action === 'password-changed'
            ? 'Profil et mot de passe mis à jour avec succès.'
            : 'Profil mis à jour avec succès.',
      action,
    })
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du profil' }, { status: 500 })
  }
}
