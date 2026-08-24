import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkAdminOrSuperAdmin } from '@/lib/auth-guards'
import {
  resolveInstitutionScope,
  requireInstitutionScope,
} from '@/lib/institution-scope'
import { generateUserCode } from '@/lib/user-code'
import { backfillNotificationsForNewUser } from '@/lib/notifications'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const schoolYear = searchParams.get('schoolYear')
    const hireDateFrom = searchParams.get('hireDateFrom')
    const hireDateTo = searchParams.get('hireDateTo')
    // status filter: 'active' by default, 'all' to disable filtering
    const statusParam = searchParams.get('status') || 'active'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)))

    // Institution filtering — STRICT server-side isolation.
    // - Regular admin/teacher/parent/student/staff: institutionId is read from
    //   the user's DB record (NOT from the forgeable x-institution-id header).
    // - SuperAdmin browsing an institution: institutionId = the browsed
    //   institution → they see only that institution's teachers.
    // - SuperAdmin overview (no active institution): institutionId = null →
    //   they see ALL teachers across all institutions (no filter).
    const scope = await resolveInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId

    // Build a list of AND conditions so multiple filters compose correctly
    // (avoids one `OR` overwriting another when both schoolYear and search are set).
    const andConditions: Record<string, unknown>[] = []

    // Filter by institution when a context is provided (see note above).
    if (institutionId) {
      andConditions.push({ user: { institutionId } })
    }

    // Filter teachers by school year through their assigned classes (ClassTeacher → Class).
    // IMPORTANT: A newly created teacher has no classes yet, so we must NOT hide them.
    // We show teachers who either have at least one class in this school year, OR have
    // no classes at all (recently added, not yet assigned). Teachers whose only classes
    // belong to a different school year are hidden.
    if (schoolYear) {
      andConditions.push({
        OR: [
          { classes: { some: { class: { schoolYear } } } },
          { classes: { none: {} } },
        ],
      })
    }

    if (search) {
      andConditions.push({
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { subject: { contains: search } },
          { phone: { contains: search } },
          { qualification: { contains: search } },
          { user: { email: { contains: search } } },
          { user: { phone: { contains: search } } },
        ],
      })
    }

    // Filter by hire date range.
    // hireDate is stored as an ISO date string (YYYY-MM-DD), so lexicographic
    // gte/lte comparisons match chronological order correctly.
    if (hireDateFrom || hireDateTo) {
      const hireDateFilter: Record<string, string> = {}
      if (hireDateFrom) hireDateFilter.gte = hireDateFrom
      if (hireDateTo) hireDateFilter.lte = hireDateTo
      andConditions.push({ hireDate: hireDateFilter })
    }

    // Filter by status (default: only active teachers).
    if (statusParam && statusParam !== 'all') {
      andConditions.push({ status: statusParam })
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {}

    const [teachers, total] = await Promise.all([
      db.teacher.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, phone: true, active: true, userCode: true },
          },
          classes: {
            include: {
              class: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.teacher.count({ where }),
    ])

    return NextResponse.json({
      teachers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get teachers error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des enseignants' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const forbidden = checkAdminOrSuperAdmin(request)
    if (forbidden) return forbidden

    // STRICT institution isolation: the new teacher's institution is read from
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
      subject,
      phone,
      qualification,
      hireDate,
      status,
      statusDate,
      image,
    } = body

    if (!firstName || !lastName || !subject) {
      return NextResponse.json(
        { error: 'Prénom, nom et matière requis' },
        { status: 400 }
      )
    }

    // Règle métier : si le statut est "active", on efface statusDate (pas de date de constat).
    // Sinon (abandoned/migrated/deceased), on accepte la date fournie (ou la date du jour par défaut).
    let resolvedStatusDate: string | null = null
    const finalStatus = status || 'active'
    if (finalStatus !== 'active') {
      resolvedStatusDate =
        typeof statusDate === 'string' && statusDate.trim()
          ? statusDate.trim()
          : new Date().toISOString().split('T')[0]
    }

    // Auto-generate email if not provided
    const userEmail = email || `${firstName.toLowerCase().replace(/\s+/g, '')}.${lastName.toLowerCase().replace(/\s+/g, '')}${Date.now().toString(36)}@edugest.local`
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
        role: 'teacher',
        phone,
        institutionId: institutionId || null,
        // Auto-generate a unique, human-friendly login ID (e.g. "TCH-001")
        // so the teacher can log in with their ID instead of just their email.
        userCode: await generateUserCode('teacher', institutionId || null),
      },
    })

    const teacher = await db.teacher.create({
      data: {
        userId: user.id,
        firstName,
        lastName,
        subject,
        phone,
        qualification,
        hireDate: hireDate || new Date().toISOString().split('T')[0],
        status: status || 'active',
        statusDate: resolvedStatusDate,
        image,
      },
      include: {
        user: {
          select: { id: true, email: true, phone: true, active: true, userCode: true },
        },
      },
    })

    // Backfill all existing institution + schoolYear notifications to the
    // new teacher so they immediately see previously published announcements,
    // homework, events, etc.
    if (institutionId) {
      const effectiveSchoolYear = body.schoolYear || '2024-2025'
      await backfillNotificationsForNewUser(user.id, institutionId, effectiveSchoolYear)
    }

    return NextResponse.json({ teacher }, { status: 201 })
  } catch (error) {
    console.error('Create teacher error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la création de l'enseignant" },
      { status: 500 }
    )
  }
}
