import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const institutions = await db.institution.findMany({
      include: {
        users: {
          where: { role: 'admin' },
          select: { id: true, name: true, email: true, active: true },
        },
        _count: {
          select: { users: true, classes: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const formatted = institutions.map((inst) => ({
      id: inst.id,
      name: inst.name,
      address: inst.address,
      phone: inst.phone,
      email: inst.email,
      password: inst.password,
      currentYear: inst.currentYear,
      active: inst.active,
      adminCount: inst.users.length,
      admins: inst.users,
      totalUsers: inst._count.users,
      totalClasses: inst._count.classes,
      createdAt: inst.createdAt,
    }))

    return NextResponse.json({ institutions: formatted })
  } catch (error) {
    console.error('Get institutions error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
