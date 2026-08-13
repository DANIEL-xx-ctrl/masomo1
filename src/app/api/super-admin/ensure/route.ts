import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/super-admin/ensure
 * Ensures the default SuperAdmin account exists in the database.
 * If it doesn't exist, creates it with default credentials.
 * If it already exists, preserves all user modifications (name, password, avatar).
 * This endpoint is called automatically on app startup to guarantee
 * the SuperAdmin account is always available.
 */
export async function GET() {
  try {
    const existing = await db.superAdmin.findUnique({
      where: { email: 'superadmin@edugest.com' },
    })

    if (existing) {
      return NextResponse.json({
        ensured: true,
        created: false,
        superAdmin: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          avatar: existing.avatar,
          phone: existing.phone,
          address: existing.address,
          active: existing.active,
        },
      })
    }

    // Create the default SuperAdmin account
    const superAdmin = await db.superAdmin.create({
      data: {
        name: 'Super Administrateur',
        email: 'superadmin@edugest.com',
        password: 'superadmin2024',
        active: true,
      },
    })

    console.log('[ENSURE] Created default SuperAdmin account')

    return NextResponse.json({
      ensured: true,
      created: true,
      superAdmin: {
        id: superAdmin.id,
        name: superAdmin.name,
        email: superAdmin.email,
        avatar: superAdmin.avatar,
        phone: superAdmin.phone,
        address: superAdmin.address,
        active: superAdmin.active,
      },
    })
  } catch (error) {
    console.error('Ensure SuperAdmin error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la vérification du compte Super Admin' },
      { status: 500 }
    )
  }
}
