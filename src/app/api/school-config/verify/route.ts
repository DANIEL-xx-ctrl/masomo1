import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { institutionPassword } = body

    if (!institutionPassword) {
      return NextResponse.json(
        { error: 'Mot de passe d\'institution requis' },
        { status: 400 }
      )
    }

    const institution = await db.institution.findFirst({
      where: {
        password: institutionPassword,
        active: true,
      },
    })

    if (!institution) {
      return NextResponse.json(
        { valid: false, error: 'Institution non trouvée ou mot de passe incorrect' },
        { status: 200 }
      )
    }

    return NextResponse.json({
      valid: true,
      schoolName: institution.name,
      institutionId: institution.id,
      institutionName: institution.name,
      currentYear: institution.currentYear,
    })
  } catch (error) {
    console.error('Verify institution error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la vérification de l\'institution' },
      { status: 500 }
    )
  }
}
