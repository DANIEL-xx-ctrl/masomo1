import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

// Check if the user is admin or super admin (super admin has full CRUD power
// on every page, across all institutions)
function checkAdmin(request: Request): NextResponse | null {
  const userRole = request.headers.get('x-user-role')
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return NextResponse.json(
      { error: 'Accès non autorisé. Seul un administrateur peut accéder à cette ressource.' },
      { status: 403 }
    )
  }
  return null
}

export async function GET(request: Request) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const forbidden = checkAdmin(request)
    if (forbidden) return forbidden

    const DEFAULT_PASSWORDS: Record<string, string> = {
      student: 'eleve123',
      teacher: 'enseignant123',
      parent: 'parent123',
      admin: 'admin123',
      staff: 'personnel123',
    }

    const users = await db.user.findMany({
      where: { institutionId },
      select: {
        id: true,
        userCode: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        active: true,
        avatar: true,
        password: true,
        createdAt: true,
        student: {
          select: {
            firstName: true,
            lastName: true,
            image: true,
            class: { select: { name: true } },
          },
        },
        teacher: {
          select: {
            firstName: true,
            lastName: true,
            subject: true,
            image: true,
          },
        },
        staff: {
          select: {
            firstName: true,
            lastName: true,
            fonction: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Add password status for each user
    const usersWithStatus = users.map((u) => {
      const defaultPwd = DEFAULT_PASSWORDS[u.role] || 'password123'
      const hasCustomPassword = u.password !== defaultPwd
      return {
        ...u,
        passwordStatus: u.password === '' ? 'none' : hasCustomPassword ? 'custom' : 'default',
      }
    })

    return NextResponse.json({ users: usersWithStatus })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des utilisateurs' },
      { status: 500 }
    )
  }
}
