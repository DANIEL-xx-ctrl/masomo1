import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/settings/subjects
 * Returns all subjects, optionally filtered by `level` query param.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level')

    const where: Record<string, unknown> = {}
    if (level) where.level = level

    const subjects = await db.subject.findMany({
      where,
      orderBy: [{ domain: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ subjects })
  } catch (error) {
    console.error('Get subjects error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/settings/subjects
 * Body: { name, code, coefficient, maxTJ, maxEX, maxTRIM, maxAnnuel, domain, level }
 * Creates a new subject with optional maxima.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, code, coefficient, maxTJ, maxEX, maxTRIM, maxAnnuel, domain, level } = body

    if (!name || !code) {
      return NextResponse.json({ error: 'Nom et code requis' }, { status: 400 })
    }

    const existing = await db.subject.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: 'Une matière avec ce code existe déjà' }, { status: 409 })
    }

    const subject = await db.subject.create({
      data: {
        name,
        code,
        coefficient: coefficient || 1,
        maxTJ: maxTJ || null,
        maxEX: maxEX || null,
        maxTRIM: maxTRIM || null,
        maxAnnuel: maxAnnuel || null,
        domain: domain || null,
        level: level || null,
      },
    })

    return NextResponse.json({ subject }, { status: 201 })
  } catch (error) {
    console.error('Create subject error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

