import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ============================================================
// /api/auth/demo-accounts
// Public endpoint used by the login page to render the quick-login
// "Compte" panel. Returns the list of well-known demo accounts
// (super admin + one admin / teacher / student / parent / staff per
// institution) with their ACTUAL current password as stored in the
// database. This way, when an admin changes their password (or an
// institution's password) from the Settings page, the login page
// immediately reflects the new password — quick-login keeps working.
//
// This is intended for demo / development convenience only: the
// login page already displays institution passwords in plain text,
// so exposing the demo user passwords is consistent with that UX.
// ============================================================

interface DemoAccountDTO {
  role: 'super_admin' | 'admin' | 'teacher' | 'student' | 'parent' | 'staff'
  label: string
  email: string
  password: string
  institutionName: string | null
  institutionKey: 'super' | 'inst1' | 'inst2' | 'inst3' | string
}

// Demo email registry — these are the addresses seeded by /api/seed
// and used by the login page's quick-login panel.
const DEMO_EMAILS_BY_ROLE: Record<'admin' | 'teacher' | 'student' | 'parent' | 'staff', string[]> = {
  admin: ['admin@ecole.com', 'admin2@lycee.com', 'admin3@polytech.com'],
  teacher: ['amadou.diallo@ecole.com', 'joseph.kamga@lycee.com', 'pierre.ekambi@polytech.com'],
  student: ['moussa.keita@ecole.com', 'aristide.kamga@lycee.com', 'elie.ekambi@polytech.com'],
  parent: ['parent@ecole.com', 'parent2@lycee.com', 'parent3@polytech.com'],
  staff: ['staff@ecole.com', 'staff2@lycee.com', 'staff3@polytech.com'],
}

const SUPER_ADMIN_EMAIL = 'superadmin@edugest.com'

function institutionKeyFromName(name: string | null): string {
  if (!name) return 'inst1'
  const n = name.toLowerCase()
  if (n.includes('lycée')) return 'inst2'
  if (n.includes('polytech') || n.includes('institut polytechnique')) return 'inst3'
  return 'inst1'
}

function labelForRole(role: 'admin' | 'teacher' | 'student' | 'parent' | 'staff'): string {
  switch (role) {
    case 'admin': return 'Admin'
    case 'teacher': return 'Enseignant'
    case 'student': return 'Élève'
    case 'parent': return 'Parent'
    case 'staff': return 'Personnel'
  }
}

export async function GET() {
  try {
    const accounts: DemoAccountDTO[] = []

    // 1) Super admin (single record in SuperAdmin table)
    try {
      const sa = await db.superAdmin.findUnique({ where: { email: SUPER_ADMIN_EMAIL } })
      if (sa) {
        accounts.push({
          role: 'super_admin',
          label: 'Super Admin',
          email: sa.email,
          password: sa.password || '',
          institutionName: null,
          institutionKey: 'super',
        })
      }
    } catch {
      // SuperAdmin model might not exist yet — skip silently
    }

    // 2) Demo users — fetch by email so we always get the live password
    const allEmails = Object.values(DEMO_EMAILS_BY_ROLE).flat()
    const users = await db.user.findMany({
      where: { email: { in: allEmails } },
      select: {
        email: true,
        password: true,
        role: true,
        active: true,
        institution: { select: { name: true } },
      },
    })

    // Index for quick lookup
    const usersByEmail = new Map(users.map((u) => [u.email, u]))

    // Build accounts grouped by institution for stable ordering
    const orderedRoles: Array<'admin' | 'teacher' | 'student' | 'parent' | 'staff'> = [
      'admin', 'teacher', 'student', 'parent', 'staff',
    ]

    for (const role of orderedRoles) {
      for (const email of DEMO_EMAILS_BY_ROLE[role]) {
        const u = usersByEmail.get(email)
        if (!u) continue
        // Skip users whose password has been "deleted" (empty string) — they can't log in
        if (u.password === '' || !u.active) continue
        accounts.push({
          role: u.role as DemoAccountDTO['role'],
          label: labelForRole(role),
          email: u.email,
          password: u.password,
          institutionName: u.institution?.name || null,
          institutionKey: institutionKeyFromName(u.institution?.name || null),
        })
      }
    }

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Get demo accounts error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des comptes démo.' },
      { status: 500 }
    )
  }
}
