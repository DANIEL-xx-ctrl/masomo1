import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'Paramètre userId requis' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        student: {
          include: { class: true },
        },
        teacher: true,
        parent: true,
        staff: true,
        institution: {
          select: { id: true, name: true, institutionType: true, currentYear: true, active: true },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    const { password: _, institution: __, ...userWithoutPassword } = user

    return NextResponse.json({
      user: {
        ...userWithoutPassword,
        institutionName: user.institution?.name || null,
        institutionType: user.institution?.institutionType || null,
      },
    })
  } catch (error) {
    console.error('Get current user error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des données utilisateur' },
      { status: 500 }
    )
  }
}
