import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkAdminOrSuperAdmin } from '@/lib/auth-guards'
import {
  resolveInstitutionScope,
  requireInstitutionScope,
} from '@/lib/institution-scope'
import { generateUserCode } from '@/lib/user-code'

// Smart gender mapping: user may type "Masculin"/"Féminin" or "M"/"F" or "masculin"/"féminin"
function mapGenderSearch(search: string): string[] {
  const lower = search.toLowerCase().trim()
  const genderValues: string[] = []
  if (lower.includes('masc') || lower.includes('garçon') || lower === 'm' || lower.includes('homme')) {
    genderValues.push('M')
  }
  if (lower.includes('fém') || lower.includes('femi') || lower.includes('fille') || lower === 'f' || lower.includes('femme')) {
    genderValues.push('F')
  }
  return genderValues
}

/**
 * Resolve the `statusDate` to persist for a student based on the requested
 * status and the date provided by the client.
 *
 * Business rules (mirrors the teachers API):
 *   - status = "active"             → statusDate is always cleared (no date
 *                                     makes sense for an active student).
 *   - status = abandoned/migrated/  → use the explicit date if provided,
 *     deceased                        otherwise default to today's date.
 *
 * The `existingDate` argument lets PATCH/PUT preserve an already-recorded
 * date when the client does not send a new one (not used on POST).
 */
function resolveStatusDate(
  status: string | undefined,
  statusDate: string | undefined,
  existingDate: string | null = null,
): string | null {
  const finalStatus = status || 'active'
  if (finalStatus === 'active') {
    return null
  }
  if (typeof statusDate === 'string' && statusDate.trim()) {
    return statusDate.trim()
  }
  if (existingDate) {
    return existingDate
  }
  return new Date().toISOString().split('T')[0]
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const search = searchParams.get('search')
    const schoolYear = searchParams.get('schoolYear')
    const genderFilter = searchParams.get('gender')
    // status filter: 'all' by default (show all statuses including abandoned/migrated/deceased),
    // matching the teachers list page behaviour. Specific statuses can be requested explicitly.
    const statusParam = searchParams.get('status') || 'all'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)))

    // Institution filtering — STRICT server-side isolation.
    // - Regular admin/teacher/student/parent/staff: institutionId is read from
    //   the user's DB record (NOT from the forgeable x-institution-id header).
    //   They can ONLY see their own institution's students.
    // - SuperAdmin browsing an institution: institutionId = the browsed
    //   institution → they see only that institution's students.
    // - SuperAdmin overview (no active institution): institutionId = null →
    //   they see ALL students across all institutions (no filter).
    const scope = await resolveInstitutionScope(request)
    if (scope instanceof NextResponse) return scope
    const institutionId = scope.institutionId

    const where: Record<string, unknown> = {}

    // Filter by institution when a context is provided (see note above).
    if (institutionId) {
      where.user = { institutionId }
    }

    if (classId) {
      where.classId = classId
    }

    if (schoolYear) {
      where.class = { schoolYear }
    }

    if (genderFilter) {
      where.gender = genderFilter
    }

    // Filter by status. 'all' = no filter (default), otherwise filter by the specific status.
    if (statusParam && statusParam !== 'all') {
      where.status = statusParam
    }

    if (search) {
      const genderMatches = mapGenderSearch(search)

      const orConditions: Record<string, unknown>[] = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { parentContact: { contains: search } },
        { parentPhone: { contains: search } },
        { address: { contains: search } },
        { user: { email: { contains: search } } },
        { user: { phone: { contains: search } } },
        { class: { name: { contains: search } } },
        { class: { level: { contains: search } } },
      ]

      // Add gender matches if the search term looks like a gender keyword
      if (genderMatches.length > 0) {
        orConditions.push({ gender: { in: genderMatches } })
      }

      where.OR = orConditions
    }

    const [students, total] = await Promise.all([
      db.student.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, phone: true, active: true, userCode: true },
          },
          class: true,
          parent: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.student.count({ where }),
    ])

    return NextResponse.json({
      students,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get students error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des étudiants' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const forbidden = checkAdminOrSuperAdmin(request)
    if (forbidden) return forbidden

    // STRICT institution isolation: the new student's institution is read from
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
      dateOfBirth,
      gender,
      address,
      enrollmentDate,
      parentContact,
      classId,
      parentPhone,
      phone,
      status,
      statusDate,
      image,
    } = body

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'Prénom et nom requis' },
        { status: 400 }
      )
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
        role: 'student',
        phone,
        institutionId: institutionId || null,
        // Auto-generate a unique, human-friendly login ID (e.g. "ELV-001")
        // so the student can log in with their ID instead of just their email.
        userCode: await generateUserCode('student', institutionId || null),
      },
    })

    const student = await db.student.create({
      data: {
        userId: user.id,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        address,
        enrollmentDate: enrollmentDate || new Date().toISOString().split('T')[0],
        parentContact,
        classId,
        parentPhone,
        status: status || 'active',
        statusDate: resolveStatusDate(status, statusDate),
        image,
      },
      include: {
        user: {
          select: { id: true, email: true, phone: true, active: true, userCode: true },
        },
        class: true,
      },
    })

    return NextResponse.json({ student }, { status: 201 })
  } catch (error) {
    console.error('Create student error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'étudiant' },
      { status: 500 }
    )
  }
}
