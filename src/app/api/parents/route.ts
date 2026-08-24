import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import {
  resolveInstitutionScope,
  requireInstitutionScope,
} from '@/lib/institution-scope'
import { generateUserCode } from '@/lib/user-code'
import { backfillNotificationsForNewUser } from '@/lib/notifications'

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
        { phone: { contains: search } },
        { address: { contains: search } },
        { user: { email: { contains: search } } },
        { user: { phone: { contains: search } } },
      ]
    }

    const [parents, total] = await Promise.all([
      db.parent.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, phone: true, active: true, institutionId: true, avatar: true, userCode: true },
          },
          children: {
            include: {
              class: { select: { id: true, name: true, level: true, section: true, schoolYear: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.parent.count({ where }),
    ])

    return NextResponse.json({
      parents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get parents error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des parents' },
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

    // STRICT institution isolation: the new parent's institution is read from
    // the authenticated user's DB record (or the super admin's browsed
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
      phone,
      address,
      image,
      childrenIds,
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
        role: 'parent',
        avatar: image || null,
        phone,
        institutionId: institutionId || null,
        // Auto-generate a unique, human-friendly login ID (e.g. "PAR-001")
        // so the parent can log in with their ID instead of just their email.
        userCode: await generateUserCode('parent', institutionId || null),
      },
    })

    const parent = await db.parent.create({
      data: {
        userId: user.id,
        firstName,
        lastName,
        phone,
        address,
        image,
      },
      include: {
        user: {
          select: { id: true, email: true, phone: true, active: true },
        },
      },
    })

    // ---- Link children (students) to this parent ----
    // A parent can be in charge of several students. We only link students
    // from the same institution as the admin creating the parent, to avoid
    // cross-institution data leakage.
    if (Array.isArray(childrenIds) && childrenIds.length > 0 && institutionId) {
      const parentName = `${firstName} ${lastName}`
      // First, unlink these students from any previous parent
      await db.student.updateMany({
        where: { id: { in: childrenIds }, user: { institutionId } },
        data: { parentId: null, parentContact: null, parentPhone: null },
      })
      // Then link them to the new parent
      await db.student.updateMany({
        where: { id: { in: childrenIds }, user: { institutionId } },
        data: {
          parentId: parent.id,
          parentContact: parentName,
          parentPhone: phone || null,
        },
      })
    }

    // Backfill all existing institution + schoolYear notifications to the
    // new parent so they immediately see previously published announcements,
    // homework, events, etc.
    if (institutionId) {
      const effectiveSchoolYear = body.schoolYear || '2024-2025'
      await backfillNotificationsForNewUser(user.id, institutionId, effectiveSchoolYear)
    }

    return NextResponse.json({ parent }, { status: 201 })
  } catch (error) {
    console.error('Create parent error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du parent' },
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
    // only update parents from their OWN institution.
    const scope = await requireInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId

    const body = await request.json()
    const { id, firstName, lastName, phone, address, image, email, active } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID du parent requis' },
        { status: 400 }
      )
    }

    const existing = await db.parent.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Parent non trouvé' },
        { status: 404 }
      )
    }

    // Admin can only update parents from their institution
    if (userRole === 'admin' && existing.user.institutionId !== institutionId) {
      return NextResponse.json(
        { error: 'Accès non autorisé à ce parent' },
        { status: 403 }
      )
    }

    const parent = await db.parent.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
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

    return NextResponse.json({ parent })
  } catch (error) {
    console.error('Update parent error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du parent' },
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
    // only delete parents from their OWN institution.
    const scope = await requireInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID du parent requis' },
        { status: 400 }
      )
    }

    const existing = await db.parent.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Parent non trouvé' },
        { status: 404 }
      )
    }

    // Admin can only delete parents from their institution
    if (userRole === 'admin' && existing.user.institutionId !== institutionId) {
      return NextResponse.json(
        { error: 'Accès non autorisé à ce parent' },
        { status: 403 }
      )
    }

    // Delete parent and associated user
    await db.parent.delete({ where: { id } })
    await db.user.delete({ where: { id: existing.userId } })

    return NextResponse.json({ message: 'Parent supprimé avec succès' })
  } catch (error) {
    console.error('Delete parent error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du parent' },
      { status: 500 }
    )
  }
}
