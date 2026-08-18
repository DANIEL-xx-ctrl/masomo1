import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import {
  resolveInstitutionScope,
  requireInstitutionScope,
} from '@/lib/institution-scope'
import { generateUserCode } from '@/lib/user-code'

export async function GET(request: Request) {
  try {
    // Lecture ouverte à tout utilisateur authentifié (admin, super_admin,
    // teacher, parent, student, staff). On filtre simplement par institution
    // pour isoler les données, sauf le super_admin qui voit tout.
    // Les écritures (POST/PUT/DELETE) restent réservées aux admins plus bas.

    // STRICT institution isolation: institutionId is read from the user's DB
    // record (NOT from the forgeable x-institution-id header). SuperAdmin in
    // overview mode gets institutionId = null (sees all institutions).
    const scope = await resolveInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)))

    const where: Record<string, unknown> = {}

    // Filter by institution when a context is provided (see note above).
    if (institutionId) {
      where.user = { institutionId }
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { fonction: { contains: search } },
        { phone: { contains: search } },
        { user: { email: { contains: search } } },
        { user: { phone: { contains: search } } },
      ]
    }

    const [staff, total] = await Promise.all([
      db.staff.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, phone: true, active: true, institutionId: true, userCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.staff.count({ where }),
    ])

    return NextResponse.json({
      staff,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get staff error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du personnel' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      )
    }

    // STRICT institution isolation: the new staff member's institution is read
    // from the authenticated user's DB record (or the super admin's browsed
    // institution). The client-sent `x-institution-id` header is IGNORED for
    // regular users to prevent cross-institution forgery.
    const scope = await requireInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId

    const body = await request.json()
    const {
      email,
      password,
      firstName,
      lastName,
      fonction,
      phone,
      image,
    } = body

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'Prénom et nom requis' },
        { status: 400 }
      )
    }

    // Auto-generate email if not provided
    const userEmail = email || `${firstName.toLowerCase().replace(/\s+/g, '')}.${lastName.toLowerCase().replace(/\s+/g, '')}${Date.now().toString(36)}@masomo.local`
    // Auto-generate a random password
    const userPassword = password || Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase()

    const existingUser = await db.user.findUnique({
      where: { email: userEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Un utilisateur avec cet email existe déjà' },
        { status: 409 }
      )
    }

    const user = await db.user.create({
      data: {
        email: userEmail,
        password: userPassword,
        name: `${firstName} ${lastName}`,
        role: 'staff',
        phone,
        institutionId: institutionId || null,
        // Auto-generate a unique, human-friendly login ID (e.g. "STF-001")
        // so the staff member can log in with their ID instead of just their email.
        userCode: await generateUserCode('staff', institutionId || null),
      },
    })

    const staff = await db.staff.create({
      data: {
        userId: user.id,
        firstName,
        lastName,
        fonction,
        phone,
        image,
      },
      include: {
        user: {
          select: { id: true, email: true, phone: true, active: true, userCode: true },
        },
      },
    })

    return NextResponse.json({ staff }, { status: 201 })
  } catch (error) {
    console.error('Create staff error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du personnel' },
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

    // STRICT institution isolation: institutionId is read from the user's DB
    // record (or the super admin's browsed institution). Regular admins can
    // only update staff from their OWN institution.
    const scope = await requireInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId

    const body = await request.json()
    const { id, firstName, lastName, fonction, phone, image, email, active } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID du personnel requis' },
        { status: 400 }
      )
    }

    const existing = await db.staff.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Personnel non trouvé' },
        { status: 404 }
      )
    }

    // Admin can only update staff from their institution
    if (userRole === 'admin' && existing.user.institutionId !== institutionId) {
      return NextResponse.json(
        { error: 'Accès non autorisé à ce personnel' },
        { status: 403 }
      )
    }

    // Update staff record
    const staff = await db.staff.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(fonction !== undefined && { fonction }),
        ...(phone !== undefined && { phone }),
        ...(image !== undefined && { image }),
      },
      include: {
        user: {
          select: { id: true, email: true, phone: true, active: true, userCode: true },
        },
      },
    })

    // Update user record if needed
    if (email !== undefined || active !== undefined) {
      await db.user.update({
        where: { id: existing.userId },
        data: {
          ...(email !== undefined && { email }),
          ...(active !== undefined && { active }),
          ...(firstName !== undefined || lastName !== undefined) && {
            name: `${firstName ?? existing.firstName} ${lastName ?? existing.lastName}`,
          },
        },
      })
    }

    return NextResponse.json({ staff })
  } catch (error) {
    console.error('Update staff error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du personnel' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      )
    }

    // STRICT institution isolation: institutionId is read from the user's DB
    // record (or the super admin's browsed institution). Regular admins can
    // only delete staff from their OWN institution.
    const scope = await requireInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID du personnel requis' },
        { status: 400 }
      )
    }

    const existing = await db.staff.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Personnel non trouvé' },
        { status: 404 }
      )
    }

    // Admin can only delete staff from their institution
    if (userRole === 'admin' && existing.user.institutionId !== institutionId) {
      return NextResponse.json(
        { error: 'Accès non autorisé à ce personnel' },
        { status: 403 }
      )
    }

    // Delete staff and associated user
    await db.staff.delete({ where: { id } })
    await db.user.delete({ where: { id: existing.userId } })

    return NextResponse.json({ message: 'Personnel supprimé avec succès' })
  } catch (error) {
    console.error('Delete staff error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du personnel' },
      { status: 500 }
    )
  }
}
