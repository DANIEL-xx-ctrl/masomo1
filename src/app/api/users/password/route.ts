import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

// Check if the user is admin or super admin (super admin has full CRUD power
// on every page, across all institutions)
function checkAdmin(request: Request): NextResponse | null {
  const userRole = request.headers.get('x-user-role')
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return NextResponse.json(
      { error: 'Accès non autorisé. Seul un administrateur peut gérer les mots de passe.' },
      { status: 403 }
    )
  }
  return null
}

// Default passwords when resetting
const DEFAULT_PASSWORDS: Record<string, string> = {
  student: 'eleve123',
  teacher: 'enseignant123',
  parent: 'parent123',
  admin: 'admin123',
  staff: 'personnel123',
}

const ROLE_LABELS: Record<string, string> = {
  student: 'élève(s)',
  teacher: 'enseignant(s)',
  parent: 'parent(s)',
  admin: 'administrateur(s)',
  staff: 'personnel(s)',
}

const VALID_ROLES = ['student', 'teacher', 'parent', 'admin', 'staff']

// PUT /api/users/password — Create / Modify password(s)
// Body: { userId, newPassword } for individual
//    OR { role, newPassword } for bulk by role
//    OR { userIds: [...], newPassword } for multiple specific users
export async function PUT(request: NextRequest) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const forbidden = checkAdmin(request)
    if (forbidden) return forbidden

    const body = await request.json()
    const { userId, role, userIds, newPassword } = body

    // Validate new password
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 3) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 3 caractères.' },
        { status: 400 }
      )
    }

    const trimmedPassword = newPassword.trim()
    let updatedCount = 0

    if (userId) {
      // Individual password create/modify
      const user = await db.user.findFirst({ where: { id: userId, institutionId } })
      if (!user) {
        return NextResponse.json(
          { error: 'Utilisateur non trouvé.' },
          { status: 404 }
        )
      }

      const wasDefault = user.password === (DEFAULT_PASSWORDS[user.role] || 'password123')
      await db.user.update({
        where: { id: userId },
        data: { password: trimmedPassword },
      })
      updatedCount = 1

      return NextResponse.json({
        message: wasDefault
          ? `Mot de passe créé pour "${user.name}" avec succès.`
          : `Mot de passe de "${user.name}" modifié avec succès.`,
        updatedCount,
        action: wasDefault ? 'created' : 'modified',
      })
    }

    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      // Multiple specific users
      const result = await db.user.updateMany({
        where: { id: { in: userIds }, institutionId },
        data: { password: trimmedPassword },
      })
      updatedCount = result.count

      return NextResponse.json({
        message: `Mot de passe défini pour ${updatedCount} utilisateur(s).`,
        updatedCount,
        action: 'modified',
      })
    }

    if (role) {
      // Bulk change by role
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json(
          { error: `Rôle invalide. Rôles valides : ${VALID_ROLES.join(', ')}` },
          { status: 400 }
        )
      }

      const result = await db.user.updateMany({
        where: { role, institutionId },
        data: { password: trimmedPassword },
      })
      updatedCount = result.count

      return NextResponse.json({
        message: `Mot de passe défini pour ${updatedCount} ${ROLE_LABELS[role] || 'utilisateur(s)'}.`,
        updatedCount,
        action: 'modified',
      })
    }

    return NextResponse.json(
      { error: 'Spécifiez un userId, userIds ou un role pour modifier les mots de passe.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Update password error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du mot de passe.' },
      { status: 500 }
    )
  }
}

// DELETE /api/users/password — Delete/Reset password(s)
// Body: { userId, mode } for individual  — mode: "delete" (clear password) or "reset" (reset to default)
//    OR { role, mode } for bulk by role
//    OR { userIds: [...], mode } for multiple specific users
export async function DELETE(request: NextRequest) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const forbidden = checkAdmin(request)
    if (forbidden) return forbidden

    const body = await request.json()
    const { userId, role, userIds, mode } = body
    const isDelete = mode === 'delete' // true = clear password (block login), false = reset to default

    let updatedCount = 0

    if (userId) {
      // Individual password delete/reset
      const user = await db.user.findFirst({ where: { id: userId, institutionId } })
      if (!user) {
        return NextResponse.json(
          { error: 'Utilisateur non trouvé.' },
          { status: 404 }
        )
      }

      if (isDelete) {
        // Delete: set password to empty string (user cannot login)
        await db.user.update({
          where: { id: userId },
          data: { password: '' },
        })

        return NextResponse.json({
          message: `Mot de passe de "${user.name}" supprimé. Cet utilisateur ne peut plus se connecter.`,
          updatedCount: 1,
          action: 'deleted',
        })
      } else {
        // Reset: set password to role default
        const defaultPwd = DEFAULT_PASSWORDS[user.role] || 'password123'
        await db.user.update({
          where: { id: userId },
          data: { password: defaultPwd },
        })

        return NextResponse.json({
          message: `Mot de passe de "${user.name}" réinitialisé à "${defaultPwd}".`,
          updatedCount: 1,
          defaultPassword: defaultPwd,
          action: 'reset',
        })
      }
    }

    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      if (isDelete) {
        // Delete passwords for multiple users
        const result = await db.user.updateMany({
          where: { id: { in: userIds }, institutionId },
          data: { password: '' },
        })
        updatedCount = result.count

        return NextResponse.json({
          message: `Mot de passe supprimé pour ${updatedCount} utilisateur(s). Ils ne peuvent plus se connecter.`,
          updatedCount,
          action: 'deleted',
        })
      } else {
        // Reset to default for multiple users
        const users = await db.user.findMany({
          where: { id: { in: userIds }, institutionId },
          select: { id: true, role: true },
        })

        for (const u of users) {
          const defaultPwd = DEFAULT_PASSWORDS[u.role] || 'password123'
          await db.user.update({
            where: { id: u.id },
            data: { password: defaultPwd },
          })
        }
        updatedCount = users.length

        return NextResponse.json({
          message: `Mot de passe réinitialisé pour ${updatedCount} utilisateur(s).`,
          updatedCount,
          action: 'reset',
        })
      }
    }

    if (role) {
      // Bulk delete/reset by role
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json(
          { error: `Rôle invalide. Rôles valides : ${VALID_ROLES.join(', ')}` },
          { status: 400 }
        )
      }

      if (isDelete) {
        const result = await db.user.updateMany({
          where: { role, institutionId },
          data: { password: '' },
        })
        updatedCount = result.count

        return NextResponse.json({
          message: `Mot de passe supprimé pour ${updatedCount} ${ROLE_LABELS[role] || 'utilisateur(s)'}. Ils ne peuvent plus se connecter.`,
          updatedCount,
          action: 'deleted',
        })
      } else {
        const defaultPwd = DEFAULT_PASSWORDS[role] || 'password123'
        const result = await db.user.updateMany({
          where: { role, institutionId },
          data: { password: defaultPwd },
        })
        updatedCount = result.count

        return NextResponse.json({
          message: `Mot de passe réinitialisé pour ${updatedCount} ${ROLE_LABELS[role] || 'utilisateur(s)'}. Nouveau mot de passe par défaut : "${defaultPwd}".`,
          updatedCount,
          defaultPassword: defaultPwd,
          action: 'reset',
        })
      }
    }

    return NextResponse.json(
      { error: 'Spécifiez un userId, userIds ou un role pour supprimer/réinitialiser les mots de passe.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Delete/Reset password error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression/réinitialisation du mot de passe.' },
      { status: 500 }
    )
  }
}
