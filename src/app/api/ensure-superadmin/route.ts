import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/ensure-superadmin
 *
 * Idempotent endpoint that guarantees a SuperAdmin account exists in the
 * database with the known demo credentials:
 *   email:    superadmin@edugest.com
 *   password: super123
 *
 * This is a safety net for fresh VSCode installs where the bundled SQLite
 * database might be missing or empty. Calling this endpoint will:
 *   1. Create the SuperAdmin if it doesn't exist
 *   2. Reset the password to "super123" if it exists but has a different password
 *   3. Activate the account if it was deactivated
 *
 * This endpoint is PUBLIC (no auth required) so it can be called during
 * the first bootstrap.
 */
export async function GET() {
  try {
    const existing = await db.superAdmin.findUnique({
      where: { email: 'superadmin@edugest.com' },
    })

    if (existing) {
      // Reset password + activate to be safe
      if (existing.password !== 'super123' || !existing.active) {
        await db.superAdmin.update({
          where: { email: 'superadmin@edugest.com' },
          data: {
            password: 'super123',
            active: true,
            name: existing.name || 'Super Administrateur',
          },
        })
        return NextResponse.json({
          ok: true,
          action: 'updated',
          message: 'SuperAdmin mis à jour (mot de passe réinitialisé à super123, compte activé).',
          superAdmin: {
            email: 'superadmin@edugest.com',
            password: 'super123',
            active: true,
          },
        })
      }
      return NextResponse.json({
        ok: true,
        action: 'noop',
        message: 'SuperAdmin déjà présent et correctement configuré.',
        superAdmin: {
          email: 'superadmin@edugest.com',
          password: 'super123',
          active: true,
        },
      })
    }

    // Create the SuperAdmin
    await db.superAdmin.create({
      data: {
        name: 'Super Administrateur',
        email: 'superadmin@edugest.com',
        password: 'super123',
        active: true,
      },
    })

    return NextResponse.json({
      ok: true,
      action: 'created',
      message: 'SuperAdmin créé avec succès.',
      superAdmin: {
        email: 'superadmin@edugest.com',
        password: 'super123',
        active: true,
      },
    })
  } catch (error) {
    console.error('[ensure-superadmin] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    )
  }
}
