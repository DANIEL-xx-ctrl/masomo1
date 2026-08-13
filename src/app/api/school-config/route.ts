import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const config = await db.schoolConfig.findFirst()

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration non trouvée' },
        { status: 404 }
      )
    }

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Get school config error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la configuration' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, address, phone, email, logo, currentYear } = body

    const config = await db.schoolConfig.findFirst()

    if (!config) {
      // Create if not exists
      const newConfig = await db.schoolConfig.create({
        data: {
          schoolName: name || 'École Internationale',
          address,
          phone,
          email,
          logo,
          currentYear: currentYear || '2024-2025',
        },
      })
      return NextResponse.json({ config: newConfig })
    }

    const updatedConfig = await db.schoolConfig.update({
      where: { id: config.id },
      data: {
        ...(name !== undefined && { schoolName: name }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(logo !== undefined && { logo }),
        ...(currentYear !== undefined && { currentYear }),
      },
    })

    return NextResponse.json({ config: updatedConfig })
  } catch (error) {
    console.error('Update school config error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la configuration' },
      { status: 500 }
    )
  }
}
